'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Send,
  ArrowUpRight,
  CalendarClock,
  ShieldCheck,
  CheckCheck,
  Download,
  FlaskConical,
  ArrowLeft,
  MessageSquare,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { measureSms } from '@bothub/channels';
import { workspaceDateToUtc } from '../../../../../config/dates';
import { ProductHeader, ProductDialog, EmptyProduct } from './shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChannelIcon, channelLabel } from '@/components/channel-icon';
import { productRequest, workspaceUrl } from '@/lib/product-client';
import type { Connection } from './types';
import type {
  CampaignRecord,
  CampaignPreview,
  SegmentRecord,
  ContactFilters,
  WhatsAppTemplateRecord,
} from './crm-types';
const campaignLabel = (s: string) =>
  ({
    draft: 'Rascunho',
    scheduled: 'Agendada',
    sending: 'Enviando',
    completed: 'Concluída',
    cancelled: 'Cancelada',
  })[s] ?? s;
const money = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const reasonLabel = (s: string | null) =>
  ({
    opted_out: 'Descadastrado',
    no_marketing_consent: 'Sem autorização',
    campaign_cancelled: 'Campanha cancelada',
    template_unapproved: 'Template não aprovado',
    missing_address: 'Sem endereço',
    connection_unavailable: 'Conexão indisponível',
    rate_limited: 'Limite de envio',
    whatsapp_window_expired: 'Janela encerrada',
  })[s ?? ''] ?? 'Envio não concluído';
export function Campaigns({
  workspaceId,
  timeZone,
  initial,
  connections,
  segments,
  templates,
  canEdit,
}: {
  workspaceId: string;
  timeZone: string;
  initial: CampaignRecord[];
  connections: Connection[];
  segments: SegmentRecord[];
  templates: WhatsAppTemplateRecord[];
  canEdit: boolean;
}) {
  const client = useQueryClient(),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<CampaignPreview | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [name, setName] = useState(''),
    [connectionId, setConnectionId] = useState(
      connections.find((c) => c.status === 'connected' && c.channel === 'sms')?.id ??
        connections.find((c) => c.status === 'connected')?.id ??
        '',
    ),
    [segmentId, setSegmentId] = useState(''),
    [tag, setTag] = useState(''),
    [text, setText] = useState('Olá, {{contact.first_name}}! Temos uma novidade para você. 💜'),
    [templateId, setTemplateId] = useState(''),
    [parameters, setParameters] = useState<string[]>([]),
    [schedule, setSchedule] = useState(''),
    [type, setType] = useState('text'),
    [mediaUrl, setMediaUrl] = useState(''),
    [choices, setChoices] = useState('Quero saber mais\nFalar com a equipe');
  const { data: campaigns = initial, error } = useQuery({
    queryKey: ['campaigns', workspaceId],
    queryFn: () => productRequest<CampaignRecord[]>(workspaceUrl('/api/campaigns', workspaceId)),
    initialData: initial,
    refetchInterval: 3000,
  });
  const { data: detail, error: detailError } = useQuery({
    queryKey: ['campaign', workspaceId, selected],
    queryFn: () =>
      productRequest<CampaignRecord>(workspaceUrl(`/api/campaigns/${selected}`, workspaceId)),
    enabled: !!selected,
    refetchInterval: 3000,
  });
  const connection = connections.find((c) => c.id === connectionId),
    availableTemplates = templates.filter(
      (t) => t.connectionId === connectionId && t.status === 'APPROVED' && t.supported,
    ),
    chosen = templates.find((t) => t.id === templateId),
    count = chosen ? new Set([...chosen.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])).size : 0;
  const filters: ContactFilters = {
    ...(segments.find((s) => s.id === segmentId)?.filters ?? {}),
    ...(tag ? { tag } : {}),
  };
  const input = () => ({
    name,
    connectionId,
    filters,
    message: {
      type: connection?.channel === 'sms' || connection?.channel === 'whatsapp' ? 'text' : type,
      text: connection?.channel === 'whatsapp' ? (chosen?.body ?? 'Template') : text,
      ...(type === 'media' && connection?.channel === 'telegram'
        ? { mediaUrl, mediaType: 'image' }
        : {}),
      ...(['buttons', 'list'].includes(type) && connection?.channel === 'telegram'
        ? {
            choices: choices
              .split('\n')
              .filter(Boolean)
              .map((label, i) => ({ id: `c${i + 1}`, label })),
          }
        : {}),
    },
    ...(connection?.channel === 'whatsapp'
      ? { templateId, parameters: parameters.slice(0, count) }
      : {}),
  });
  const segmentsPreview = measureSms(text + '\n\nResponda PARAR para não receber mais mensagens.');
  async function review() {
    setBusy(true);
    try {
      setPreview(
        await productRequest<CampaignPreview>(
          workspaceUrl('/api/campaigns/preview', workspaceId),
          'POST',
          input(),
        ),
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    if (!preview) return;
    setBusy(true);
    try {
      const scheduledAt = schedule ? workspaceDateToUtc(schedule, timeZone) : undefined;
      const c = await productRequest<{ id: string }>(
        workspaceUrl('/api/campaigns', workspaceId),
        'POST',
        input(),
      );
      await productRequest(workspaceUrl(`/api/campaigns/${c.id}`, workspaceId), 'POST', {
        action: 'start',
        digest: preview.digest,
        scheduledAt,
      });
      await client.invalidateQueries({ queryKey: ['campaigns', workspaceId] });
      setOpen(false);
      setPreview(null);
      setSelected(c.id);
      toast.success(schedule ? 'Campanha agendada.' : 'Campanha entrou na fila.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ProductHeader
        eyebrow="BOAS MENSAGENS, NO MOMENTO CERTO"
        title="Crie conversas que aproximam"
        description="Personalize, escolha seu público e acompanhe cada envio."
      >
        <Button
          disabled={!canEdit}
          onClick={() => {
            setOpen(true);
            setPreview(null);
            setName('');
            setSchedule('');
          }}
        >
          <Plus size={16} />
          Nova campanha
        </Button>
      </ProductHeader>
      <div className="campaign-banner card">
        <div className="campaign-banner-art">
          <Send size={34} />
          <span />
          <span />
        </div>
        <div>
          <Badge tone="primary">PÚBLICO CERTO. MENSAGEM CERTA.</Badge>
          <h2>Uma boa conversa começa com permissão.</h2>
          <p>Quem se descadastrou ou não autorizou campanhas fica fora do envio automaticamente.</p>
        </div>
        <ShieldCheck size={31} />
      </div>
      <div className="crm-stats">
        {[
          {
            icon: Send,
            label: 'Campanhas',
            value: campaigns.length,
            detail: 'Seus envios em um só lugar',
          },
          {
            icon: CheckCheck,
            label: 'Mensagens enviadas',
            value: campaigns.reduce((n, c) => n + c.stats.sent, 0),
            detail: 'Inclui os envios de demonstração',
          },
          {
            icon: CalendarClock,
            label: 'Agendadas',
            value: campaigns.filter((c) => c.status === 'scheduled').length,
            detail: `Fuso: ${timeZone}`,
          },
        ].map((s) => (
          <article className="card crm-stat" key={s.label}>
            <span className="crm-stat-icon">
              <s.icon size={21} />
            </span>
            <div>
              <span>{s.label}</span>
              <strong>{s.value}</strong>
              <small>{s.detail}</small>
            </div>
          </article>
        ))}
      </div>
      <div className="product-section-heading">
        <h2>
          Suas campanhas <span>{campaigns.length}</span>
        </h2>
        <span>
          <ShieldCheck size={15} />
          Envios com consentimento
        </span>
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error.message}
        </p>
      )}
      {campaigns.length ? (
        <div className="campaign-grid">
          {campaigns.map((c) => (
            <article className="card campaign-card" key={c.id}>
              <div className="campaign-card-top">
                <span className={`connection-option-icon channel-${c.connection.channel}`}>
                  <ChannelIcon channel={c.connection.channel} size={23} />
                </span>
                <Badge
                  tone={
                    c.status === 'completed'
                      ? 'success'
                      : c.status === 'scheduled'
                        ? 'primary'
                        : 'neutral'
                  }
                >
                  {campaignLabel(c.status)}
                </Badge>
              </div>
              <h2>{c.name}</h2>
              <p>
                {c.connection.name}
                {c.connection.mode === 'fake' ? ' · Demonstração' : ''}
              </p>
              <div className="campaign-card-metrics">
                <div>
                  <strong>{c.stats.total}</strong>
                  <span>Contatos</span>
                </div>
                <div>
                  <strong>{c.stats.sent}</strong>
                  <span>Enviadas</span>
                </div>
                <div>
                  <strong>{c.stats.skipped}</strong>
                  <span>Protegidos</span>
                </div>
              </div>
              <div className="campaign-card-bottom">
                <span>
                  <CalendarClock size={13} />
                  {new Date(c.scheduledAt ?? c.createdAt).toLocaleDateString('pt-BR', {
                    timeZone,
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setSelected(c.id)}>
                  Ver resultados
                  <ArrowUpRight size={15} />
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyProduct
          title="Sua próxima conversa começa aqui"
          description="Crie uma campanha e revise o público antes de enviar."
        />
      )}
      <ProductDialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
        title={preview ? 'Confira antes de enviar' : 'Nova campanha'}
        description={
          preview
            ? 'Veja quem vai receber e o conteúdo personalizado.'
            : 'Escolha o canal e o público. Você revisa tudo antes do envio.'
        }
      >
        {!preview ? (
          <form
            className="product-form"
            onSubmit={(e) => {
              e.preventDefault();
              review();
            }}
          >
            <label>
              Nome da campanha
              <input
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Novidades de outubro"
              />
            </label>
            <label>
              Conexão
              <select
                required
                aria-label="Conexão"
                value={connectionId}
                onChange={(e) => {
                  setConnectionId(e.target.value);
                  setTemplateId('');
                  setParameters([]);
                  setType('text');
                }}
              >
                <option value="">Escolha um canal</option>
                {connections
                  .filter((c) => c.status === 'connected')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {channelLabel(c.channel)}
                      {c.mode === 'fake' ? ' · Demonstração' : ''}
                    </option>
                  ))}
              </select>
            </label>
            {connection?.mode === 'fake' && (
              <div className="crm-demo-notice">
                <FlaskConical size={17} />
                Demonstração: nenhum envio real será feito.
              </div>
            )}
            <div className="crm-form-pair">
              <label>
                Segmento
                <select value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
                  <option value="">Todos deste canal</option>
                  {segments.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tag adicional
                <input
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Ex.: cliente"
                  maxLength={40}
                />
              </label>
            </div>
            {connection?.channel === 'whatsapp' ? (
              <>
                <label>
                  Template aprovado
                  <select
                    required
                    value={templateId}
                    onChange={(e) => {
                      setTemplateId(e.target.value);
                      setParameters([]);
                    }}
                  >
                    <option value="">Escolha um template</option>
                    {availableTemplates.map((t) => (
                      <option value={t.id} key={t.id}>
                        {t.name} · {t.language}
                      </option>
                    ))}
                  </select>
                </label>
                {chosen && (
                  <div className="campaign-chat-preview">
                    <MessageSquare size={17} />
                    <p>{chosen.body}</p>
                  </div>
                )}
                {Array.from({ length: count }, (_, i) => (
                  <label key={i}>
                    Valor da variável {i + 1}
                    <input
                      required
                      maxLength={300}
                      value={parameters[i] ?? ''}
                      onChange={(e) => {
                        const next = [...parameters];
                        next[i] = e.target.value;
                        setParameters(next);
                      }}
                      placeholder="{{contact.first_name}}"
                    />
                  </label>
                ))}
                <p className="product-help">
                  Somente templates aprovados podem iniciar campanhas.{' '}
                  <Link href="/app/whatsapp-templates">Gerenciar templates →</Link>
                </p>
              </>
            ) : (
              <>
                {connection?.channel === 'telegram' && (
                  <label>
                    Formato
                    <select value={type} onChange={(e) => setType(e.target.value)}>
                      <option value="text">Texto</option>
                      <option value="media">Imagem e texto</option>
                      <option value="buttons">Texto com botões</option>
                    </select>
                  </label>
                )}
                <label>
                  Mensagem
                  <textarea
                    aria-label="Mensagem"
                    required
                    rows={4}
                    maxLength={2000}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </label>
                {type === 'media' && connection?.channel === 'telegram' && (
                  <label>
                    Link público da imagem
                    <input
                      required
                      type="url"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </label>
                )}
                {type === 'buttons' && connection?.channel === 'telegram' && (
                  <label>
                    Botões, um por linha
                    <textarea
                      required
                      rows={3}
                      value={choices}
                      onChange={(e) => setChoices(e.target.value)}
                    />
                  </label>
                )}
                <p className="product-help">
                  Use {'{{contact.first_name}}'} para personalizar. A instrução PARAR será incluída
                  no final.
                </p>
                {connection?.channel === 'sms' && (
                  <div className="sms-meter">
                    <span>
                      {segmentsPreview.characters} caracteres · {segmentsPreview.encoding}
                    </span>
                    <strong>
                      {segmentsPreview.segments} segmento(s) por mensagem, antes da personalização
                    </strong>
                    <small>O custo final estimado aparece na próxima etapa.</small>
                  </div>
                )}
              </>
            )}
            <label>
              Agendar (opcional)
              <input
                type="datetime-local"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
              />
            </label>
            <p className="product-help">
              Horário da empresa: {timeZone}. Deixe vazio para enviar agora.
            </p>
            <Button disabled={busy || !connection}>
              {busy ? 'Preparando prévia...' : 'Revisar campanha'}
              <ArrowUpRight size={15} />
            </Button>
          </form>
        ) : (
          <div className="product-form">
            {preview.mode === 'fake' && (
              <div className="crm-demo-notice">
                <FlaskConical size={17} />
                Esta campanha é uma demonstração, sem cobrança ou envio real.
              </div>
            )}
            <div className="campaign-review-stats">
              <div>
                <Users size={19} />
                <strong>{preview.eligible}</strong>
                <span>Vão receber</span>
              </div>
              <div>
                <ShieldCheck size={19} />
                <strong>{preview.blocked}</strong>
                <span>Ficam protegidos</span>
              </div>
            </div>
            {preview.channel === 'sms' && (
              <div className="sms-meter">
                <span>{preview.segments} segmentos no total</span>
                <strong>Custo estimado: {money(preview.estimatedCostCents)}</strong>
                <small>
                  Estimativa com o preço configurado. O provedor calcula a cobrança final.
                </small>
              </div>
            )}
            {preview.samples.map((s) => (
              <div className="campaign-chat-preview" key={s.name}>
                <span className="crm-avatar">{s.name[0]}</span>
                <div>
                  <strong>{s.name}</strong>
                  <p>{s.message.text}</p>
                </div>
              </div>
            ))}
            {schedule && (
              <p>
                Agendada para {schedule.replace('T', ' às ')} · {timeZone}
              </p>
            )}
            <Button disabled={busy || !preview.eligible} onClick={start}>
              <Send size={16} />
              {busy
                ? 'Confirmando...'
                : `${schedule ? 'Agendar' : 'Confirmar envio'} para ${preview.eligible} contato(s)`}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setPreview(null)}>
              <ArrowLeft size={15} />
              Editar campanha
            </Button>
          </div>
        )}
      </ProductDialog>
      <ProductDialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
        title={detail?.name ?? 'Resultados da campanha'}
        description="Acompanhe os envios e consulte o relatório por contato."
      >
        {detailError && (
          <p role="alert" className="error-text">
            {detailError.message}
          </p>
        )}
        {detail ? (
          <div className="product-form">
            <div className="crm-channel">
              <ChannelIcon channel={detail.connection.channel} size={19} />
              {detail.connection.name}
              <Badge tone="primary">{campaignLabel(detail.status)}</Badge>
            </div>
            {detail.connection.mode === 'fake' && (
              <div className="crm-demo-notice">
                <FlaskConical size={17} />
                Envios simulados. Nenhuma mensagem foi enviada ao provedor.
              </div>
            )}
            <div className="campaign-report-stats">
              {[
                ['Enviadas', detail.stats.sent],
                ['Entregues', detail.stats.delivered],
                ['Lidas', detail.stats.read],
                ['Falhas', detail.stats.failed],
                ['Protegidos', detail.stats.skipped],
                ['Na fila', detail.stats.pending],
              ].map(([label, n]) => (
                <div key={label}>
                  <strong>{n}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <p className="product-help">
              Entregas e leituras dependem dos recibos do canal. {detail.replies ?? 0} conversas
              receberam respostas após o envio.
            </p>
            <div className="campaign-recipient-list">
              {detail.recipients?.map((r) => (
                <div key={r.id}>
                  <span>{r.contact.name}</span>
                  <Badge
                    tone={
                      r.message?.status === 'sent' ||
                      r.message?.status === 'delivered' ||
                      r.message?.status === 'read'
                        ? 'success'
                        : 'neutral'
                    }
                  >
                    {r.message?.status === 'read'
                      ? 'Lida'
                      : r.message?.status === 'delivered'
                        ? 'Entregue'
                        : r.message?.status === 'sent'
                          ? 'Enviada'
                          : r.status === 'skipped' || r.message?.status === 'failed'
                            ? reasonLabel(r.reason ?? r.message?.lastError ?? null)
                            : 'Na fila'}
                  </Badge>
                </div>
              ))}
            </div>
            <Button variant="outline" asChild>
              <a href={workspaceUrl(`/api/campaigns/${detail.id}/export`, workspaceId)}>
                <Download size={15} />
                Exportar relatório
              </a>
            </Button>
            {canEdit && ['scheduled', 'sending', 'draft'].includes(detail.status) && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await productRequest(
                      workspaceUrl(`/api/campaigns/${detail.id}`, workspaceId),
                      'POST',
                      { action: 'cancel' },
                    );
                    await client.invalidateQueries({ queryKey: ['campaigns', workspaceId] });
                    await client.invalidateQueries({
                      queryKey: ['campaign', workspaceId, selected],
                    });
                    toast.success('Campanha cancelada. Envios já aceitos não podem ser desfeitos.');
                  } catch (e) {
                    toast.error((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Cancelar próximos envios
              </Button>
            )}
          </div>
        ) : (
          <div className="loading-block" />
        )}
      </ProductDialog>
    </>
  );
}
