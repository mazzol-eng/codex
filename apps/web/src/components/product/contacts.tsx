'use client';
import { useState, useDeferredValue } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserCheck,
  ShieldCheck,
  Plus,
  Upload,
  Download,
  Search,
  ArrowRight,
  Bookmark,
  Tags,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { parseCsv } from '@bothub/core/csv';
import { ProductHeader, ProductDialog, EmptyProduct } from './shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChannelIcon, channelLabel } from '@/components/channel-icon';
import { productRequest, workspaceUrl } from '@/lib/product-client';
import type { Connection } from './types';
import type { ContactRecord, ContactPage, ContactFilters, SegmentRecord } from './crm-types';
function query(filters: ContactFilters, page = 1) {
  const p = new URLSearchParams({ page: String(page) });
  for (const [k, v] of Object.entries(filters))
    if (v !== undefined && v !== '') p.set(k, String(v));
  return p.toString();
}
const emptyForm = {
  name: '',
  connectionId: '',
  externalContactId: '',
  email: '',
  tags: '',
  fieldName: '',
  fieldValue: '',
  consent: false,
  marketingConsent: false,
  source: '',
};
export function Contacts({
  workspaceId,
  initial,
  connections,
  segments,
  canEdit,
  canManage,
}: {
  workspaceId: string;
  initial: ContactPage;
  connections: Connection[];
  segments: SegmentRecord[];
  canEdit: boolean;
  canManage: boolean;
}) {
  const client = useQueryClient(),
    [filters, setFilters] = useState<ContactFilters>({}),
    [page, setPage] = useState(1),
    [modal, setModal] = useState<'create' | 'import' | 'segment' | null>(null),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState({ ...emptyForm, connectionId: connections[0]?.id ?? '' }),
    [profile, setProfile] = useState<ContactRecord | null>(null),
    [segmentName, setSegmentName] = useState(''),
    [csv, setCsv] = useState(''),
    [mapping, setMapping] = useState({
      name: 'nome',
      externalContactId: 'telefone',
      email: 'email',
      tags: 'tags',
    });
  const deferred = useDeferredValue(filters);
  const {
    data = initial,
    isFetching,
    error,
  } = useQuery({
    queryKey: ['contacts', workspaceId, deferred, page],
    queryFn: () =>
      productRequest<ContactPage>(
        workspaceUrl(`/api/contacts?${query(deferred, page)}`, workspaceId),
      ),
    initialData: Object.keys(filters).length === 0 && page === 1 ? initial : undefined,
  });
  const { data: savedSegments = segments } = useQuery({
    queryKey: ['segments', workspaceId],
    queryFn: () => productRequest<SegmentRecord[]>(workspaceUrl('/api/segments', workspaceId)),
    initialData: segments,
  });
  let preview: { headers: string[]; rows: Record<string, string>[] } = { headers: [], rows: [] },
    csvError = '';
  if (csv)
    try {
      preview = parseCsv(csv);
    } catch (e) {
      csvError = (e as Error).message;
    }
  const setFilter = (value: ContactFilters) => {
    setFilters(value);
    setPage(1);
  };
  const refresh = () => client.invalidateQueries({ queryKey: ['contacts', workspaceId] });
  async function save() {
    setBusy(true);
    try {
      const tags = form.tags
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
        fields = {
          ...(profile?.fields ?? {}),
          ...(form.fieldName ? { [form.fieldName]: form.fieldValue } : {}),
        };
      const value = {
        name: form.name,
        email: form.email || undefined,
        tags,
        fields,
        consent: form.consent,
        marketingConsent: form.marketingConsent,
        source: form.source || undefined,
      };
      if (profile) {
        await productRequest(
          workspaceUrl(`/api/contacts/${profile.id}`, workspaceId),
          'PATCH',
          value,
        );
        setProfile(null);
      } else
        await productRequest(workspaceUrl('/api/contacts', workspaceId), 'POST', {
          ...value,
          connectionId: form.connectionId,
          externalContactId: form.externalContactId,
        });
      setModal(null);
      await refresh();
      toast.success('Contato salvo.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importFile() {
    setBusy(true);
    try {
      const result = await productRequest<{ created: number; updated: number }>(
        workspaceUrl('/api/contacts/import', workspaceId),
        'POST',
        {
          connectionId: form.connectionId,
          csv,
          mapping: Object.fromEntries(Object.entries(mapping).filter(([, v]) => v)),
          consent: form.consent,
          marketingConsent: form.marketingConsent,
          source: form.source || undefined,
        },
      );
      toast.success(`${result.created} novos contatos e ${result.updated} atualizados.`);
      setModal(null);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function openProfile(c: ContactRecord) {
    try {
      const p = await productRequest<ContactRecord>(
        workspaceUrl(`/api/contacts/${c.id}`, workspaceId),
      );
      setForm({
        ...emptyForm,
        name: p.name,
        email: p.email ?? '',
        tags: p.tags.join(', '),
        consent: p.consent,
        marketingConsent: p.marketingConsent,
        source: p.marketingSource ?? p.consentSource ?? '',
      });
      setProfile(p);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  const consentFields = (
    <>
      <label className="crm-check">
        <input
          type="checkbox"
          checked={form.consent}
          onChange={(e) =>
            setForm({
              ...form,
              consent: e.target.checked,
              marketingConsent: e.target.checked ? form.marketingConsent : false,
            })
          }
        />
        Autorizou conversas neste canal
      </label>
      <label className="crm-check">
        <input
          type="checkbox"
          checked={form.marketingConsent}
          disabled={!form.consent}
          onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })}
        />
        Autorizou receber campanhas
      </label>
      {(form.consent || form.marketingConsent) && (
        <label>
          Origem da autorização
          <input
            required
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            placeholder="Ex.: formulário do site, em 03/10/2026"
            maxLength={200}
          />
        </label>
      )}
      <p className="product-help">
        Marque apenas autorizações que você pode comprovar. PARAR cancela as mensagens
        automaticamente.
      </p>
    </>
  );
  return (
    <>
      <ProductHeader
        eyebrow="CADA CONTATO, UMA CONEXÃO"
        title="Conheça seu público"
        description="Organize seus clientes e fale com quem quer ouvir você."
      >
        <Button variant="outline" asChild>
          <a href={workspaceUrl(`/api/contacts/export?${query(filters)}`, workspaceId)}>
            <Download size={15} />
            Exportar
          </a>
        </Button>
        <Button
          disabled={!canEdit || !connections.length}
          onClick={() => {
            setForm({ ...emptyForm, connectionId: connections[0]?.id ?? '' });
            setModal('create');
          }}
        >
          <Plus size={16} />
          Novo contato
        </Button>
      </ProductHeader>
      <div className="crm-stats">
        {[
          {
            icon: Users,
            label: 'Contatos na sua empresa',
            value: data.summary.all,
            detail: `de ${data.summary.limit.toLocaleString('pt-BR')} disponíveis`,
          },
          {
            icon: UserCheck,
            label: 'Prontos para campanhas',
            value: data.summary.subscribed,
            detail: 'Com autorização registrada',
          },
          {
            icon: ShieldCheck,
            label: 'Descadastrados',
            value: data.summary.optedOut,
            detail: 'Respeitamos a escolha de cada um',
          },
        ].map((s) => (
          <article className="card crm-stat" key={s.label}>
            <span className="crm-stat-icon">
              <s.icon size={21} />
            </span>
            <div>
              <span>{s.label}</span>
              <strong>{s.value.toLocaleString('pt-BR')}</strong>
              <small>{s.detail}</small>
            </div>
          </article>
        ))}
      </div>
      <div className="crm-layout">
        <aside className="card crm-segments">
          <div className="crm-section-title">
            <h2>
              <Tags size={17} />
              Seus públicos
            </h2>
            <button
              className="icon-control"
              aria-label="Salvar segmento"
              disabled={!canManage}
              onClick={() => setModal('segment')}
            >
              <Plus size={17} />
            </button>
          </div>
          <button
            className={!Object.keys(filters).length ? 'segment-item selected' : 'segment-item'}
            onClick={() => setFilter({})}
          >
            <Users size={16} />
            <span>Todos os contatos</span>
            <small>{data.summary.all}</small>
          </button>
          <button
            className="segment-item"
            onClick={() => setFilter({ consent: true, marketingConsent: true })}
          >
            <UserCheck size={16} />
            <span>Com autorização</span>
            <small>{data.summary.subscribed}</small>
          </button>
          <div className="crm-segment-divider">SEGMENTOS SALVOS</div>
          {savedSegments.map((s) => (
            <button className="segment-item" key={s.id} onClick={() => setFilter(s.filters)}>
              <Bookmark size={15} />
              <span>{s.name}</span>
              <small>{s.count}</small>
            </button>
          ))}
          <p className="product-help">Salve filtros e use o mesmo público nas suas campanhas.</p>
          <Button
            variant="outline"
            size="sm"
            disabled={!canManage || !connections.length}
            onClick={() => {
              setCsv('');
              setForm({ ...emptyForm, connectionId: connections[0]?.id ?? '' });
              setModal('import');
            }}
          >
            <Upload size={14} />
            Importar CSV
          </Button>
        </aside>
        <section className="card crm-table-card">
          <div className="crm-table-toolbar">
            <label className="product-search">
              <Search size={16} />
              <input
                aria-label="Buscar contatos"
                placeholder="Buscar nome, e-mail ou telefone"
                value={filters.search ?? ''}
                onChange={(e) => setFilter({ ...filters, search: e.target.value })}
              />
            </label>
            <select
              aria-label="Filtrar canal"
              value={filters.channel ?? ''}
              onChange={(e) =>
                setFilter({
                  ...filters,
                  channel: (e.target.value || undefined) as ContactFilters['channel'],
                })
              }
            >
              <option value="">Todos os canais</option>
              {['whatsapp', 'telegram', 'sms', 'simulator'].map((c) => (
                <option key={c} value={c}>
                  {channelLabel(c)}
                </option>
              ))}
            </select>
            <input
              className="crm-tag-filter"
              aria-label="Filtrar tag"
              placeholder="Filtrar por tag"
              value={filters.tag ?? ''}
              onChange={(e) => setFilter({ ...filters, tag: e.target.value })}
            />
          </div>
          {error && (
            <p role="alert" className="error-text">
              {error.message}
            </p>
          )}
          <div className="crm-table-scroll" aria-busy={isFetching}>
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Contato</th>
                  <th>Canal</th>
                  <th>Tags</th>
                  <th>Campanhas</th>
                  <th>
                    <span className="sr-only">Abrir perfil</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button className="contact-name" onClick={() => openProfile(c)}>
                        <span className="crm-avatar">
                          {c.name
                            .split(' ')
                            .slice(0, 2)
                            .map((n) => n[0])
                            .join('')}
                        </span>
                        <span>
                          <strong>{c.name}</strong>
                          <small>{c.email ?? c.phone ?? 'Sem e-mail ou telefone'}</small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className="crm-channel">
                        <ChannelIcon channel={c.channel} size={17} />
                        {channelLabel(c.channel)}
                      </span>
                      {c.connection?.mode === 'fake' && (
                        <small className="muted">Demonstração</small>
                      )}
                    </td>
                    <td>
                      <div className="crm-tags">
                        {c.tags.slice(0, 2).map((t) => (
                          <Badge key={t} tone="primary">
                            {t}
                          </Badge>
                        ))}
                        {!c.tags.length && <span className="muted">—</span>}
                      </div>
                    </td>
                    <td>
                      <Badge tone={c.marketingConsent && c.consent ? 'success' : 'neutral'}>
                        {!c.consent
                          ? 'Descadastrado'
                          : c.marketingConsent
                            ? 'Autorizado'
                            : 'Sem autorização'}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="icon-control"
                        aria-label={`Abrir ${c.name}`}
                        onClick={() => openProfile(c)}
                      >
                        <ArrowRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.items.length && (
            <EmptyProduct
              title="Nenhum contato por aqui"
              description="Ajuste os filtros ou adicione seu primeiro contato."
            />
          )}
          <div className="crm-table-footer">
            <span>{data.total} contatos encontrados</span>
            <div>
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <span>{page}</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page * 30 >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </section>
      </div>
      <ProductDialog
        open={modal === 'create' || !!profile}
        onOpenChange={(v) => {
          if (!v) {
            setModal(null);
            setProfile(null);
          }
        }}
        title={profile ? 'Perfil do contato' : 'Adicionar contato'}
        description={
          profile
            ? 'Dados e autorizações reunidos em um só lugar.'
            : 'Cada cadastro está ligado a um canal da sua empresa.'
        }
      >
        <form
          className="product-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label>
            Nome
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              minLength={2}
              maxLength={100}
            />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          {!profile && (
            <>
              <label>
                Conexão
                <select
                  required
                  value={form.connectionId}
                  onChange={(e) => setForm({ ...form, connectionId: e.target.value })}
                >
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {channelLabel(c.channel)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Telefone ou identificador do canal
                <input
                  required
                  value={form.externalContactId}
                  onChange={(e) => setForm({ ...form, externalContactId: e.target.value })}
                  placeholder="+5511999999999 ou ID do Telegram"
                  maxLength={100}
                />
              </label>
            </>
          )}
          <label>
            Tags, separadas por vírgula
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="cliente, agendamento"
            />
          </label>
          <div className="crm-form-pair">
            <label>
              Campo personalizado
              <input
                value={form.fieldName}
                onChange={(e) => setForm({ ...form, fieldName: e.target.value })}
                placeholder="cidade"
                pattern="[a-zA-Z][a-zA-Z0-9_]{0,39}"
              />
            </label>
            <label>
              Valor
              <input
                value={form.fieldValue}
                onChange={(e) => setForm({ ...form, fieldValue: e.target.value })}
                placeholder="São Paulo"
                maxLength={500}
              />
            </label>
          </div>
          {profile && Object.keys(profile.fields).length > 0 && (
            <div className="crm-tags">
              {Object.entries(profile.fields).map(([k, v]) => (
                <Badge key={k}>
                  {k}: {String(v)}
                </Badge>
              ))}
            </div>
          )}
          {consentFields}
          <Button disabled={busy || !canEdit}>{busy ? 'Salvando...' : 'Salvar contato'}</Button>
        </form>
        {profile && (
          <div className="crm-timeline">
            <h3>
              <ShieldCheck size={17} />
              Histórico de autorizações
            </h3>
            {profile.consentRecords?.map((r) => (
              <div key={r.id}>
                <Badge tone={r.granted ? 'success' : 'neutral'}>
                  {r.granted ? 'Autorizado' : 'Cancelado'}
                </Badge>
                <p>
                  {r.scope === 'marketing'
                    ? 'Campanhas'
                    : r.scope === 'all'
                      ? 'Todos os envios'
                      : 'Conversas'}{' '}
                  · {r.source}
                </p>
                <small>{new Date(r.createdAt).toLocaleString('pt-BR')}</small>
              </div>
            ))}
            <h3>
              <Mail size={17} />
              Últimas mensagens
            </h3>
            {profile.conversations
              ?.flatMap((c) => c.messages.slice(0, 5))
              .slice(0, 10)
              .map((m) => (
                <p key={m.id}>
                  <strong>{m.direction === 'inbound' ? 'Cliente' : 'Equipe'}: </strong>
                  {m.content.text ?? 'Mídia'}
                </p>
              ))}
          </div>
        )}
      </ProductDialog>
      <ProductDialog
        open={modal === 'segment'}
        onOpenChange={(v) => {
          if (!v) setModal(null);
        }}
        title="Salvar este público"
        description="O segmento acompanha os contatos que combinam com os filtros atuais."
      >
        <form
          className="product-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await productRequest(workspaceUrl('/api/segments', workspaceId), 'POST', {
                name: segmentName,
                filters,
              });
              await client.invalidateQueries({ queryKey: ['segments', workspaceId] });
              setModal(null);
              toast.success('Segmento salvo.');
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Nome do segmento
            <input
              required
              minLength={2}
              maxLength={80}
              value={segmentName}
              onChange={(e) => setSegmentName(e.target.value)}
              placeholder="Clientes interessados"
            />
          </label>
          <p>{data.total} contatos combinam com este público hoje.</p>
          <Button disabled={busy}>Salvar segmento</Button>
        </form>
      </ProductDialog>
      <ProductDialog
        open={modal === 'import'}
        onOpenChange={(v) => {
          if (!v) setModal(null);
        }}
        title="Traga seus contatos"
        description="CSV com até 1.000 linhas. Telefones no formato +5511999999999."
      >
        <form
          className="product-form"
          onSubmit={(e) => {
            e.preventDefault();
            importFile();
          }}
        >
          <label>
            Conexão
            <select
              required
              value={form.connectionId}
              onChange={(e) => setForm({ ...form, connectionId: e.target.value })}
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Arquivo CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 200000) {
                  toast.error('Use um arquivo de até 200 KB.');
                  return;
                }
                setCsv(await f.text());
              }}
            />
          </label>
          {preview.headers.length > 0 && (
            <>
              <div className="crm-form-pair">
                {(['name', 'externalContactId', 'email', 'tags'] as const).map((k) => (
                  <label key={k}>
                    {
                      {
                        name: 'Nome',
                        externalContactId: 'Telefone / identificador',
                        email: 'E-mail (opcional)',
                        tags: 'Tags (opcional)',
                      }[k]
                    }
                    <select
                      required={k === 'name' || k === 'externalContactId'}
                      value={mapping[k]}
                      onChange={(e) => setMapping({ ...mapping, [k]: e.target.value })}
                    >
                      <option value="">Selecionar coluna</option>
                      {preview.headers.map((h) => (
                        <option key={h}>{h}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <p className="product-help">
                {preview.rows.length} contatos no arquivo. Primeiros nomes:{' '}
                {preview.rows
                  .slice(0, 3)
                  .map((r) => r[mapping.name])
                  .join(', ')}
                .
              </p>
              {consentFields}
              <p className="product-help">
                Autorizações de contatos existentes serão preservadas. O arquivo nunca reativa quem
                já se descadastrou.
              </p>
            </>
          )}
          {csvError && (
            <p role="alert" className="error-text">
              {csvError}
            </p>
          )}
          <Button disabled={busy || !preview.rows.length || !!csvError}>
            {busy ? 'Importando...' : `Importar ${preview.rows.length} contatos`}
          </Button>
        </form>
      </ProductDialog>
    </>
  );
}
