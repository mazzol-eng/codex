'use client';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MessagesSquare,
  Search,
  UserRound,
  Bot,
  Send,
  Check,
  CheckCheck,
  StickyNote,
  Tag,
  Clock,
  ArrowLeft,
  ShieldCheck,
  MoreHorizontal,
  ArrowRight,
  AlertCircle,
  MessageCircle,
  Inbox as InboxIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { ProductHeader } from './shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChannelIcon, channelLabel } from '@/components/channel-icon';
import { productRequest, workspaceUrl } from '@/lib/product-client';
import type { ConversationRecord } from './types';
const quickReplies = [
  { key: '/ola', text: 'Olá! Sou da equipe de atendimento. Como posso ajudar você?' },
  { key: '/aguarde', text: 'Vou verificar para você. Pode aguardar um instante?' },
  { key: '/obrigado', text: 'Obrigado pela conversa! Se precisar, estamos por aqui.' },
];
export function Inbox({
  workspaceId,
  initialConversations,
  userId,
  canRespond,
  timeZone,
}: {
  workspaceId: string;
  initialConversations: ConversationRecord[];
  userId: string;
  canRespond: boolean;
  timeZone: string;
}) {
  const queryClient = useQueryClient(),
    [selected, setSelected] = useState<string | null>(initialConversations[0]?.id ?? null),
    [filter, setFilter] = useState('all'),
    [search, setSearch] = useState(''),
    [text, setText] = useState(''),
    [note, setNote] = useState(false),
    [busy, setBusy] = useState(false),
    [live, setLive] = useState(false),
    [mobileChat, setMobileChat] = useState(false);
  const tail = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(clock);
  }, []);
  const conversationsQuery = useQuery({
    queryKey: ['inbox', workspaceId],
    queryFn: () => productRequest<ConversationRecord[]>(workspaceUrl('/api/inbox', workspaceId)),
    initialData: initialConversations,
  });
  const detailQuery = useQuery({
    queryKey: ['conversation', workspaceId, selected],
    queryFn: () =>
      productRequest<ConversationRecord>(workspaceUrl(`/api/inbox/${selected}`, workspaceId)),
    enabled: !!selected,
  });
  const conversations = conversationsQuery.data ?? [],
    conversation = detailQuery.data;
  const filtered = conversations.filter(
    (c) =>
      c.contact.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'all' ||
        (filter === 'unread' && c.unread > 0) ||
        (filter === 'mine' && c.assignedUserId === userId) ||
        (filter === 'bot' && c.mode === 'bot') ||
        (filter === 'human' && c.mode === 'human') ||
        (filter === 'closed' && c.status === 'closed') ||
        c.channel === filter),
  );
  useEffect(() => {
    const events = new EventSource(workspaceUrl('/api/inbox/stream', workspaceId));
    events.onopen = () => setLive(true);
    events.onerror = () => setLive(false);
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['inbox', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['conversation', workspaceId] });
    };
    events.addEventListener('changed', refresh);
    return () => {
      events.close();
    };
  }, [workspaceId, queryClient]);
  useEffect(() => {
    if (conversation?.messages.length) tail.current?.scrollIntoView({ block: 'nearest' });
  }, [conversation?.messages.length]);
  useEffect(() => {
    if (selected && canRespond)
      productRequest(workspaceUrl(`/api/inbox/${selected}`, workspaceId), 'POST', {
        action: 'read',
      }).catch(() => {});
  }, [selected, workspaceId, canRespond]);
  async function act(action: 'take' | 'return' | 'close' | 'reply' | 'note') {
    if (!selected) return;
    setBusy(true);
    try {
      await productRequest(workspaceUrl(`/api/inbox/${selected}`, workspaceId), 'POST', {
        action,
        ...(action === 'reply' || action === 'note' ? { text } : {}),
      });
      if (action === 'reply' || action === 'note') setText('');
      await queryClient.invalidateQueries({ queryKey: ['conversation', workspaceId, selected] });
      await queryClient.invalidateQueries({ queryKey: ['inbox', workspaceId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const expired =
    conversation?.channel === 'whatsapp' &&
    (!conversation.lastInboundAt ||
      now - new Date(conversation.lastInboundAt).getTime() > 86400000);
  const time = (value: string) =>
    new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone }).format(
      new Date(value),
    );
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(new Date(value));
  return (
    <>
      <ProductHeader
        eyebrow="CADA CONVERSA IMPORTA"
        title="Sua caixa de entrada"
        description="Bot e equipe, juntos para atender melhor."
      >
        <span className={`inbox-live ${live ? 'connected' : ''}`}>
          <i />
          {live ? 'Atualização em tempo real' : 'Reconectando...'}
        </span>
      </ProductHeader>
      <div className={`inbox-workspace ${mobileChat ? 'mobile-chat-active' : ''}`}>
        <aside className="inbox-list">
          <div className="inbox-list-top">
            <strong>
              Conversas <span>{conversations.length}</span>
            </strong>
            <MessagesSquare size={17} />
          </div>
          <label className="product-search">
            <Search size={16} />
            <input
              aria-label="Buscar conversas"
              placeholder="Buscar uma conversa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            className="inbox-filter"
            aria-label="Filtrar conversas"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              ['all', 'Todas as conversas'],
              ['unread', 'Não lidas'],
              ['mine', 'Minhas'],
              ['bot', 'Com o bot'],
              ['human', 'Aguardando equipe'],
              ['closed', 'Encerradas'],
              ['telegram', 'Telegram'],
              ['simulator', 'Simulador'],
              ['whatsapp', 'WhatsApp'],
              ['sms', 'SMS'],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <div className="inbox-conversations">
            {filtered.length ? (
              filtered.map((c) => (
                <button
                  className={`inbox-conversation ${selected === c.id ? 'active' : ''}`}
                  key={c.id}
                  onClick={() => {
                    setSelected(c.id);
                    setText('');
                    setNote(false);
                    setMobileChat(true);
                  }}
                >
                  <span className="contact-avatar">
                    {c.contact.name.slice(0, 1)}
                    <i>
                      <ChannelIcon channel={c.channel} size={10} />
                    </i>
                  </span>
                  <div>
                    <strong>
                      {c.contact.name}
                      <small>{time(c.updatedAt)}</small>
                    </strong>
                    <p>{c.messages[0]?.content.text ?? 'Uma nova conversa está aqui.'}</p>
                    <span>
                      <ChannelIcon channel={c.channel} size={10} />
                      {channelLabel(c.channel)} ·{' '}
                      {c.status === 'closed'
                        ? 'Encerrada'
                        : c.mode === 'human'
                          ? 'Com a equipe'
                          : 'Com o bot'}
                    </span>
                  </div>
                  {c.unread > 0 && <span className="unread-badge">{c.unread}</span>}
                </button>
              ))
            ) : (
              <div className="inbox-list-empty">
                <InboxIcon size={25} />
                <p>
                  {search || filter !== 'all'
                    ? 'Nenhuma conversa neste filtro.'
                    : 'As primeiras conversas chegarão aqui.'}
                </p>
              </div>
            )}
          </div>
          {conversationsQuery.isError && (
            <p role="alert" className="product-help">
              Não conseguimos atualizar. Reconectando...
            </p>
          )}
        </aside>
        <section className="inbox-chat" aria-label="Conversa selecionada">
          {conversation ? (
            <>
              <div className="inbox-chat-heading">
                <button
                  className="icon-control mobile-conversation-back"
                  aria-label="Voltar à lista de conversas"
                  onClick={() => setMobileChat(false)}
                >
                  <ArrowLeft size={17} />
                </button>
                <span className="contact-avatar">{conversation.contact.name.slice(0, 1)}</span>
                <div>
                  <h2>{conversation.contact.name}</h2>
                  <span>
                    <ChannelIcon channel={conversation.channel} size={12} />
                    {channelLabel(conversation.channel)}
                    <i />{' '}
                    {conversation.mode === 'human'
                      ? 'Atendimento humano'
                      : 'Atendimento automático'}
                  </span>
                </div>
                <Badge
                  tone={
                    conversation.status === 'closed'
                      ? 'neutral'
                      : conversation.mode === 'human'
                        ? 'primary'
                        : 'success'
                  }
                >
                  {conversation.status === 'closed'
                    ? 'Encerrada'
                    : conversation.mode === 'human'
                      ? 'Equipe'
                      : 'Bot'}
                </Badge>
              </div>
              <div className="inbox-chat-actions">
                <span>
                  <ShieldCheck size={13} />
                  Conversa da sua empresa
                </span>
                <div>
                  {conversation.mode === 'bot' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!canRespond || busy}
                      onClick={() => act('take')}
                    >
                      <UserRound size={13} />
                      Assumir conversa
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canRespond || busy}
                      onClick={() => act('return')}
                    >
                      <Bot size={13} />
                      Devolver ao bot
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!canRespond || busy || conversation.status === 'closed'}
                    onClick={() => act('close')}
                  >
                    <Check size={13} />
                    Encerrar
                  </Button>
                </div>
              </div>
              {expired && (
                <div className="inbox-window-warning">
                  <Clock size={15} />
                  <span>
                    A janela de 24h do WhatsApp terminou. Templates aprovados chegam na Fase 3.
                  </span>
                </div>
              )}
              {!conversation.contact.consent && (
                <div className="inbox-window-warning">
                  <AlertCircle size={15} />
                  Este contato pediu para não receber mensagens.
                </div>
              )}
              <div className="inbox-messages" aria-live="polite">
                {conversation.messages.length ? (
                  conversation.messages.map((m) => (
                    <div key={m.id} className={`inbox-message ${m.direction}`}>
                      <div>
                        {m.direction === 'note' && (
                          <strong>
                            <StickyNote size={12} />
                            Nota interna
                          </strong>
                        )}
                        <p>{m.content.text}</p>
                        {m.content.mediaUrl && (
                          <a href={m.content.mediaUrl} target="_blank" rel="noopener noreferrer">
                            Abrir mídia
                          </a>
                        )}
                        {m.content.choices && (
                          <div className="inbox-message-options">
                            {m.content.choices.map((c) => (
                              <span key={c.id}>{c.label}</span>
                            ))}
                          </div>
                        )}
                        <span className="inbox-message-meta">
                          {time(m.createdAt)}
                          {m.direction === 'outbound' &&
                            (m.status === 'sent' ? (
                              <Check size={12} />
                            ) : m.status === 'read' || m.status === 'delivered' ? (
                              <CheckCheck size={12} />
                            ) : m.status === 'failed' ? (
                              <>
                                <AlertCircle size={11} />
                                Falhou
                              </>
                            ) : (
                              <>
                                <Clock size={11} />
                                Na fila
                              </>
                            ))}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="inbox-chat-empty">
                    <MessageCircle size={30} />
                    <p>As mensagens aparecerão aqui.</p>
                  </div>
                )}
                <div ref={tail} />
              </div>
              <div className={`inbox-composer ${note ? 'is-note' : ''}`}>
                <div className="composer-tabs">
                  <button className={!note ? 'active' : ''} onClick={() => setNote(false)}>
                    <MessageCircle size={13} />
                    Responder
                  </button>
                  <button className={note ? 'active' : ''} onClick={() => setNote(true)}>
                    <StickyNote size={13} />
                    Nota interna
                  </button>
                </div>
                {text.startsWith('/') && !note && (
                  <div className="quick-replies">
                    {quickReplies.map((r) => (
                      <button key={r.key} onClick={() => setText(r.text)}>
                        <strong>{r.key}</strong>
                        <span>{r.text}</span>
                      </button>
                    ))}
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    act(note ? 'note' : 'reply');
                  }}
                >
                  <textarea
                    aria-label={note ? 'Nota interna' : 'Resposta ao cliente'}
                    placeholder={
                      note
                        ? 'Uma anotação só para sua equipe...'
                        : conversation.mode === 'bot'
                          ? 'Assuma a conversa para responder.'
                          : 'Escreva uma mensagem ou / para respostas rápidas...'
                    }
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={2000}
                    rows={2}
                    disabled={
                      !canRespond ||
                      (!note &&
                        (conversation.mode === 'bot' || !!expired || !conversation.contact.consent))
                    }
                  />
                  <Button
                    size="icon"
                    aria-label={note ? 'Salvar nota interna' : 'Enviar resposta'}
                    disabled={
                      busy ||
                      !text.trim() ||
                      !canRespond ||
                      (!note &&
                        (conversation.mode === 'bot' || !!expired || !conversation.contact.consent))
                    }
                  >
                    {note ? <StickyNote size={17} /> : <Send size={17} />}
                  </Button>
                </form>
                <span className="composer-help">
                  {note
                    ? 'Esta nota não é enviada ao cliente.'
                    : 'Mensagens são enviadas pelo canal conectado.'}
                </span>
              </div>
            </>
          ) : (
            <div className="inbox-chat-empty">
              <span className="empty-orbit">
                <MessagesSquare size={35} />
              </span>
              <h2>
                {detailQuery.isError
                  ? 'Não conseguimos abrir esta conversa'
                  : 'Um bom atendimento começa com atenção'}
              </h2>
              <p>
                {selected
                  ? 'Carregando suas mensagens...'
                  : 'Escolha uma conversa para acompanhar ou responder.'}
              </p>
              {detailQuery.isError && (
                <Button variant="outline" onClick={() => detailQuery.refetch()}>
                  Tentar novamente
                </Button>
              )}
            </div>
          )}
        </section>
        <aside className="inbox-contact">
          {conversation ? (
            <>
              <div className="contact-profile">
                <span className="contact-avatar large">
                  {conversation.contact.name.slice(0, 1)}
                </span>
                <h3>{conversation.contact.name}</h3>
                <span>
                  <ChannelIcon channel={conversation.channel} size={13} />
                  {channelLabel(conversation.channel)}
                </span>
              </div>
              <div className="contact-detail-block">
                <h4>
                  <UserRound size={13} />
                  Atendimento
                </h4>
                <div>
                  <span>Responsável</span>
                  <strong>
                    {conversation.assignedUserId === userId
                      ? 'Você'
                      : conversation.assignedUserId
                        ? 'Equipe'
                        : 'Bot'}
                  </strong>
                </div>
                <div>
                  <span>Conexão</span>
                  <strong>{conversation.connection?.name ?? 'Exemplo'}</strong>
                </div>
                <div>
                  <span>Última atividade</span>
                  <strong>{formatDate(conversation.updatedAt)}</strong>
                </div>
              </div>
              <div className="contact-detail-block">
                <h4>
                  <Tag size={13} />
                  Tags
                </h4>
                {conversation.contact.tags.length ? (
                  <div className="contact-tags">
                    {conversation.contact.tags.map((t) => (
                      <Badge key={t} tone="primary">
                        {t}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p>Nenhuma tag ainda. O fluxo pode adicionar tags durante a conversa.</p>
                )}
              </div>
              <div className="contact-detail-block">
                <h4>
                  <ShieldCheck size={13} />
                  Consentimento
                </h4>
                <Badge tone={conversation.contact.consent ? 'success' : 'neutral'}>
                  {conversation.contact.consent ? 'Conversa permitida' : 'Descadastrado'}
                </Badge>
                <p>
                  {conversation.contact.consentSource ?? 'Não informado'}
                  {conversation.contact.consentAt &&
                    ` · ${formatDate(conversation.contact.consentAt)}`}
                </p>
              </div>
              {conversation.runs?.length ? (
                <div className="contact-detail-block">
                  <h4>
                    <Bot size={13} />
                    Últimos passos do bot
                  </h4>
                  <div className="inbox-flow-trace">
                    {conversation.runs[0]!.trace.map((t, i) => (
                      <span key={`${t.nodeId}-${i}`}>
                        <Check size={11} />
                        {t.nodeId}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="contact-placeholder">
              <MoreHorizontal size={25} />
              <p>Os detalhes do contato ficam aqui.</p>
              <ArrowRight size={16} />
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
