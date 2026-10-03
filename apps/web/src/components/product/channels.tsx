'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plug,
  Plus,
  ShieldCheck,
  ExternalLink,
  FlaskConical,
  RefreshCw,
  History,
  Send,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { ProductHeader, ProductDialog, EmptyProduct, statusLabel } from './shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChannelIcon, channelLabel } from '@/components/channel-icon';
import { productRequest, workspaceUrl } from '@/lib/product-client';
import type { Connection, BotRecord } from './types';
export function Channels({
  workspaceId,
  connections,
  bots,
  canEdit,
}: {
  workspaceId: string;
  connections: Connection[];
  bots: BotRecord[];
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: currentConnections = connections } = useQuery({
    queryKey: ['connections', workspaceId],
    queryFn: () => productRequest<Connection[]>(workspaceUrl('/api/connections', workspaceId)),
    initialData: connections,
  });
  const [channel, setChannel] = useState<'simulator' | 'telegram' | 'whatsapp' | 'sms' | null>(
      null,
    ),
    [name, setName] = useState(''),
    [botId, setBotId] = useState(bots[0]?.id ?? ''),
    [token, setToken] = useState(''),
    [mode, setMode] = useState<'fake' | 'real'>('fake'),
    [credentials, setCredentials] = useState<Record<string, string>>({}),
    [smsPrice, setSmsPrice] = useState('0.10'),
    [busy, setBusy] = useState(false),
    [logs, setLogs] = useState<
      { id: string; status: string; createdAt: string; lastError: string | null }[] | null
    >(null),
    [testing, setTesting] = useState<Connection | null>(null),
    [message, setMessage] = useState(''),
    [contactId, setContactId] = useState(''),
    [testNote, setTestNote] = useState('');
  async function connect() {
    setBusy(true);
    try {
      const c = await productRequest<Connection>(
        workspaceUrl('/api/connections', workspaceId),
        'POST',
        {
          channel,
          name,
          botId,
          ...(channel === 'telegram' ? { token } : {}),
          ...(['whatsapp', 'sms'].includes(channel ?? '')
            ? {
                mode,
                ...(mode === 'real' ? { credentials } : {}),
                smsPriceCents: Math.round(Number(smsPrice) * 100),
              }
            : {}),
        },
      );
      setToken('');
      setCredentials({});
      setChannel(null);
      toast.success(
        c.status === 'connected'
          ? 'Canal conectado.'
          : 'Dados validados. Conclua a verificação da conexão com sua URL pública HTTPS.',
      );
      queryClient.setQueryData<Connection[]>(['connections', workspaceId], (old) => [
        ...(old ?? connections),
        c,
      ]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function test(c: Connection) {
    setBusy(true);
    try {
      const result = await productRequest<{ valid: boolean; status: string }>(
        workspaceUrl(`/api/connections/${c.id}`, workspaceId),
        'POST',
      );
      toast[result.valid ? 'success' : 'error'](
        result.valid ? statusLabel(result.status) : 'Não conseguimos validar a conexão.',
      );
      queryClient.setQueryData<Connection[]>(['connections', workspaceId], (old) =>
        (old ?? connections).map((item) =>
          item.id === c.id ? { ...item, status: result.status } : item,
        ),
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function simulate() {
    if (!testing) return;
    setBusy(true);
    try {
      await productRequest(
        workspaceUrl(`/api/connections/${testing.id}/simulate`, workspaceId),
        'POST',
        { text: message, externalContactId: contactId, externalMessageId: crypto.randomUUID() },
      );
      setMessage('');
      setTestNote(
        'Mensagem recebida. O bot responderá na Caixa de entrada quando o worker processar.',
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ProductHeader
        eyebrow="UM FLUXO, VÁRIOS LUGARES"
        title="Converse onde seu cliente está"
        description="Conecte suas contas existentes do WhatsApp e Telegram, adicione SMS ou experimente na demonstração."
      />
      <div className="connection-options">
        {(['telegram', 'simulator', 'whatsapp', 'sms'] as const).map((c) => (
          <article className="card connection-option" key={c}>
            <span className={`connection-option-icon channel-${c}`}>
              <ChannelIcon channel={c} size={27} />
            </span>
            <h2>{channelLabel(c)}</h2>
            <p>
              {c === 'telegram'
                ? 'Use o token do seu bot existente.'
                : c === 'simulator'
                  ? 'Teste o fluxo completo, com Inbox.'
                  : c === 'whatsapp'
                    ? 'Sua conta Business, pela API oficial.'
                    : 'Envie mensagens pela Twilio.'}
            </p>
            {
              <Button
                variant="outline"
                disabled={!canEdit || !bots.length}
                onClick={() => {
                  setChannel(c);
                  setName(c === 'simulator' ? 'Simulador de teste' : `Meu ${channelLabel(c)}`);
                  setCredentials({});
                  setMode('fake');
                }}
              >
                <Plus size={15} />
                {c === 'simulator' ? 'Adicionar simulador' : `Conectar ${channelLabel(c)}`}
              </Button>
            }
          </article>
        ))}
      </div>
      {!bots.length && (
        <div className="product-notice">
          <Plug size={17} />
          <span>Crie seu primeiro bot para conectar um canal.</span>
          <Link href="/app/templates">
            Escolher template
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
      <div className="product-notice">
        <ShieldCheck size={17} />
        <span>WhatsApp pela API oficial da Meta. Nenhum bot ou conta externa será criado.</span>
        <Link href="/app/whatsapp-templates">
          Templates do WhatsApp
          <ArrowRight size={14} />
        </Link>
      </div>
      <div className="product-section-heading">
        <h2>
          Suas conexões <span>{currentConnections.length}</span>
        </h2>
        <span>
          <ShieldCheck size={15} />
          Credenciais protegidas
        </span>
      </div>
      {currentConnections.length ? (
        <div className="connection-list">
          {currentConnections.map((c) => (
            <article className="card connection-row" key={c.id}>
              <ChannelIcon channel={c.channel} size={23} />
              <div>
                <h3>{c.name}</h3>
                <p>
                  {channelLabel(c.channel)} ·{' '}
                  {bots.find((b) => b.id === c.botId)?.name ?? 'Conexão ilustrativa'}
                </p>
              </div>
              <Badge
                tone={
                  c.status === 'connected'
                    ? 'success'
                    : c.status === 'error'
                      ? 'neutral'
                      : 'primary'
                }
              >
                {c.mode === 'fake' ? 'Demonstração' : statusLabel(c.status)}
              </Badge>
              <div className="connection-row-actions">
                {(c.channel === 'simulator' || c.mode === 'fake') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!canEdit}
                    onClick={() => {
                      setTesting(c);
                      setContactId(
                        c.channel === 'sms'
                          ? '+5511998887777'
                          : c.channel === 'whatsapp'
                            ? '5511998887777'
                            : `test-${crypto.randomUUID()}`,
                      );
                      setTestNote('');
                    }}
                  >
                    <FlaskConical size={14} />
                    Testar conversa
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !canEdit || c.status === 'demo'}
                  onClick={() => test(c)}
                >
                  <RefreshCw size={14} />
                  Testar conexão
                </Button>
                <button
                  className="icon-control"
                  aria-label={`Ver eventos de ${c.name}`}
                  onClick={async () => {
                    try {
                      setLogs(
                        await productRequest(workspaceUrl(`/api/connections/${c.id}`, workspaceId)),
                      );
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  <History size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyProduct
          title="Escolha o primeiro lugar para conversar"
          description="O simulador funciona sem token. Conexões reais usam suas contas existentes."
        />
      )}
      <ProductDialog
        open={!!channel}
        onOpenChange={(v) => {
          if (!v) {
            setChannel(null);
            setToken('');
            setCredentials({});
          }
        }}
        title={
          channel === 'simulator'
            ? 'Adicionar um simulador'
            : `Conectar seu ${channelLabel(channel ?? 'simulator')}`
        }
        description={
          channel === 'telegram'
            ? 'Você já tem seu bot. Vamos conectá-lo com segurança.'
            : channel === 'simulator'
              ? 'Um canal de teste que passa pelo mesmo motor e pela Inbox.'
              : 'Use sua conta existente ou experimente com dados fictícios.'
        }
      >
        <form
          className="product-form"
          onSubmit={(e) => {
            e.preventDefault();
            connect();
          }}
        >
          <label>
            Nome da conexão
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={80}
            />
          </label>
          <label>
            Bot que irá responder
            <select value={botId} onChange={(e) => setBotId(e.target.value)} required>
              {bots.map((b) => (
                <option value={b.id} key={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          {channel === 'telegram' && (
            <>
              <label>
                Token do bot
                <input
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  placeholder="Cole o token do seu bot existente"
                />
              </label>
              <p className="product-help">
                O token será criptografado e nunca aparecerá no painel. O ambiente precisa de uma
                URL pública HTTPS para receber mensagens.
              </p>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="product-external"
              >
                Abrir BotFather para consultar seu bot
                <ExternalLink size={13} />
              </a>
            </>
          )}
          {(channel === 'whatsapp' || channel === 'sms') && (
            <>
              <label>
                Como deseja conectar?
                <select value={mode} onChange={(e) => setMode(e.target.value as 'real' | 'fake')}>
                  <option value="fake">Demonstração · sem credenciais ou envios reais</option>
                  <option value="real">Minha conta existente · conexão real</option>
                </select>
              </label>
              {mode === 'fake' ? (
                <div className="crm-demo-notice">
                  <FlaskConical size={17} />
                  Teste com dados fictícios. Este canal não envia mensagens reais.
                </div>
              ) : (
                <>
                  {(channel === 'whatsapp'
                    ? [
                        ['phoneNumberId', 'ID do número'],
                        ['wabaId', 'ID da conta WhatsApp Business'],
                        ['accessToken', 'Token de acesso'],
                        ['verifyToken', 'Token de verificação'],
                        ['appSecret', 'Segredo do aplicativo Meta'],
                      ]
                    : [
                        ['accountSid', 'Account SID da Twilio'],
                        ['authToken', 'Auth Token'],
                        ['from', 'Número Twilio (opcional com Messaging Service)'],
                        ['messagingServiceSid', 'Messaging Service SID (opcional)'],
                      ]
                  ).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        type={
                          ['accessToken', 'verifyToken', 'appSecret', 'authToken'].includes(key!)
                            ? 'password'
                            : 'text'
                        }
                        autoComplete="off"
                        required={key !== 'from' && key !== 'messagingServiceSid'}
                        value={credentials[key!] ?? ''}
                        onChange={(e) =>
                          setCredentials((old) => {
                            const next = { ...old };
                            if (e.target.value) next[key!] = e.target.value;
                            else delete next[key!];
                            return next;
                          })
                        }
                      />
                    </label>
                  ))}
                  <p className="product-help">
                    Use os dados da sua conta existente. Credenciais são criptografadas e nunca
                    reaparecem no painel. Para receber mensagens, configure uma URL pública HTTPS e
                    verifique o canal.
                  </p>
                </>
              )}
              {channel === 'sms' && (
                <label>
                  Preço estimado por segmento (R$)
                  <input
                    required
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={smsPrice}
                    onChange={(e) => setSmsPrice(e.target.value)}
                  />
                </label>
              )}
            </>
          )}
          <Button disabled={busy}>
            {busy ? 'Validando...' : 'Conectar canal'}
            <Plug size={15} />
          </Button>
        </form>
      </ProductDialog>
      <ProductDialog
        open={logs !== null}
        onOpenChange={(v) => {
          if (!v) setLogs(null);
        }}
        title="Últimos eventos recebidos"
        description="Veja o processamento sem expor tokens ou conteúdo das mensagens."
      >
        {logs?.length ? (
          <ul className="event-list">
            {logs.map((log) => (
              <li key={log.id}>
                <span>{new Date(log.createdAt).toLocaleString('pt-BR')}</span>
                <Badge tone="neutral">
                  {log.status === 'processed'
                    ? 'Processado'
                    : log.status === 'pending'
                      ? 'Na fila'
                      : 'Falhou'}
                </Badge>
                {log.lastError && <small>Não processado. Revise a conexão.</small>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="product-help">Ainda não recebemos mensagens nesta conexão.</p>
        )}
      </ProductDialog>
      <ProductDialog
        open={!!testing}
        onOpenChange={(v) => {
          if (!v) setTesting(null);
        }}
        title="Converse como um cliente"
        description="A mensagem entra pelo canal simulado e aparece na Inbox. Publique o bot antes de testar."
      >
        <form
          className="product-form"
          onSubmit={(e) => {
            e.preventDefault();
            simulate();
          }}
        >
          <label>
            Identificador do cliente
            <input
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              required
              maxLength={80}
            />
          </label>
          <label>
            Mensagem
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              maxLength={2000}
              placeholder="Digite /start para começar"
            />
          </label>
          <Button disabled={busy}>
            <Send size={15} />
            {busy ? 'Enviando...' : 'Enviar mensagem de teste'}
          </Button>
          {testNote && (
            <p role="status" className="product-help">
              {testNote}
            </p>
          )}
          <Button variant="outline" asChild>
            <Link href="/app/inbox">
              Acompanhar na Caixa de entrada
              <ArrowRight size={15} />
            </Link>
          </Button>
        </form>
      </ProductDialog>
    </>
  );
}
