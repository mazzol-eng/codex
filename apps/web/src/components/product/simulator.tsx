'use client';
import { useState } from 'react';
import {
  initialState,
  runFlow,
  type FlowGraph,
  type SessionState,
  type EngineResult,
} from '@bothub/flow-engine';
import type { Channel, OutboundMessage } from '@bothub/channels';
import { degradeMessage } from '@bothub/channels';
import { FlaskConical, RotateCcw, Send, Check, Variable, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChannelIcon } from '@/components/channel-icon';
type ChatItem = { id: number; direction: 'inbound' | 'outbound'; message: OutboundMessage };
export function Simulator({
  graph,
  onTrace,
  onClose,
}: {
  graph: FlowGraph;
  onTrace: (trace: EngineResult['trace']) => void;
  onClose: () => void;
}) {
  const [channel, setChannel] = useState<Channel>('simulator'),
    [state, setState] = useState<SessionState>(initialState),
    [chat, setChat] = useState<ChatItem[]>([]),
    [input, setInput] = useState('');
  function submit(text: string, payload?: string, now = Date.now()) {
    const result = runFlow(
      graph,
      state,
      {
        channel,
        connectionId: 'preview',
        externalContactId: 'preview-client',
        externalMessageId: crypto.randomUUID(),
        type: payload ? 'button_reply' : 'text',
        text,
        payload,
        timestamp: new Date(now).toISOString(),
      },
      { now, contact: { first_name: 'Cliente' } },
    );
    setState(result.state);
    setChat((old) => [
      ...old,
      { id: Date.now(), direction: 'inbound', message: { type: 'text', text } },
      ...result.actions.flatMap((a, i) =>
        a.type === 'send'
          ? [
              {
                id: Date.now() + i + 1,
                direction: 'outbound' as const,
                message: degradeMessage(channel, a.message),
              },
            ]
          : [],
      ),
    ]);
    setInput('');
    onTrace(result.trace);
  }
  return (
    <aside className="flow-simulator" aria-label="Simulador do fluxo">
      <div className="flow-panel-heading">
        <span>
          <FlaskConical size={17} />
          <strong>Teste sua conversa</strong>
        </span>
        <button className="icon-control" onClick={onClose} aria-label="Fechar simulador">
          <X size={16} />
        </button>
      </div>
      <div className="simulator-channel">
        <ChannelIcon channel={channel} />
        <select
          value={channel}
          aria-label="Canal do simulador"
          onChange={(e) => {
            setChannel(e.target.value as Channel);
            setState(initialState());
            setChat([]);
            onTrace([]);
          }}
        >
          <option value="simulator">Simulador</option>
          <option value="telegram">Telegram</option>
          <option value="whatsapp">Prévia WhatsApp</option>
          <option value="sms">Prévia SMS</option>
        </select>
        <button
          className="icon-control"
          onClick={() => {
            setState(initialState());
            setChat([]);
            onTrace([]);
          }}
          aria-label="Reiniciar conversa"
        >
          <RotateCcw size={15} />
        </button>
      </div>
      <div className="simulator-chat" aria-live="polite">
        {!chat.length && (
          <div className="simulator-empty">
            <FlaskConical size={30} />
            <strong>Uma conversa de verdade, em um teste.</strong>
            <p>Envie “oi” ou /start. Nenhuma mensagem sai para um canal real.</p>
            <Button variant="secondary" size="sm" onClick={() => submit('/start')}>
              Começar teste
              <Send size={13} />
            </Button>
          </div>
        )}
        {chat.map((item, index) => (
          <div className={`simulator-bubble ${item.direction}`} key={`${item.id}-${index}`}>
            <p>{item.message.text}</p>
            {item.message.mediaUrl && (
              <a target="_blank" rel="noopener noreferrer" href={item.message.mediaUrl}>
                Abrir mídia
              </a>
            )}
            {item.direction === 'outbound' &&
              item.message.choices?.map((c) => (
                <button key={c.id} onClick={() => submit(c.label, c.id)} disabled={!state.waiting}>
                  {c.label}
                </button>
              ))}
            {item.direction === 'outbound' && <Check size={11} />}
          </div>
        ))}
        {state.mode === 'human' && (
          <div className="simulator-status">
            Conversa transferida para a equipe. O bot está pausado.
          </div>
        )}
        {state.optedOut && (
          <div className="simulator-status">Contato descadastrado neste canal.</div>
        )}
        {state.waiting?.kind === 'delay' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => submit('⏱ Avançar espera', undefined, state.waiting!.expiresAt!)}
          >
            Avançar tempo de espera
          </Button>
        )}
      </div>
      <form
        className="simulator-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) submit(input);
        }}
      >
        <input
          aria-label="Mensagem no simulador"
          placeholder="Escreva sua mensagem..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
        />
        <Button size="icon" aria-label="Enviar no simulador" disabled={!input.trim()}>
          <Send size={16} />
        </Button>
      </form>
      <div className="simulator-variables">
        <h3>
          <Variable size={14} />
          Variáveis da conversa
        </h3>
        {Object.entries(state.variables).length ? (
          Object.entries(state.variables).map(([key, value]) => (
            <div key={key}>
              <code>{key}</code>
              <span>{value}</span>
            </div>
          ))
        ) : (
          <p>As respostas salvas aparecerão aqui.</p>
        )}
        <small>
          {state.tags.length ? `Tags: ${state.tags.join(', ')}` : 'Sem tags nesta conversa'}
        </small>
      </div>
    </aside>
  );
}
