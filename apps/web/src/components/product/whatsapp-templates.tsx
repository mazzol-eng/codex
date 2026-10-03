'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, MessageSquare, ArrowLeft, FlaskConical, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { ProductHeader, ProductDialog, EmptyProduct } from './shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { productRequest, workspaceUrl } from '@/lib/product-client';
import type { Connection } from './types';
import type { WhatsAppTemplateRecord } from './crm-types';
export function WhatsAppTemplates({
  workspaceId,
  connections,
  initial,
  canEdit,
}: {
  workspaceId: string;
  connections: Connection[];
  initial: WhatsAppTemplateRecord[];
  canEdit: boolean;
}) {
  const client = useQueryClient(),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [connectionId, setConnectionId] = useState(
      connections.find(
        (c) => c.channel === 'whatsapp' && ['connected', 'pending'].includes(c.status),
      )?.id ?? '',
    ),
    [name, setName] = useState(''),
    [category, setCategory] = useState('MARKETING'),
    [body, setBody] = useState(
      'Olá, {{1}}! Temos uma novidade para você. Responda PARAR para não receber mais mensagens.',
    ),
    [examples, setExamples] = useState('Marina');
  const { data: templates = initial, error } = useQuery({
    queryKey: ['whatsapp-templates', workspaceId],
    queryFn: () =>
      productRequest<WhatsAppTemplateRecord[]>(
        workspaceUrl('/api/whatsapp-templates', workspaceId),
      ),
    initialData: initial,
  });
  const usable = connections.filter(
      (c) => c.channel === 'whatsapp' && ['connected', 'pending'].includes(c.status),
    ),
    connection = usable.find((c) => c.id === connectionId);
  async function sync() {
    setBusy(true);
    try {
      const r = await productRequest<{ synced: number }>(
        workspaceUrl('/api/whatsapp-templates', workspaceId),
        'PATCH',
        { connectionId },
      );
      await client.invalidateQueries({ queryKey: ['whatsapp-templates', workspaceId] });
      toast.success(`${r.synced} templates sincronizados.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ProductHeader
        eyebrow="MENSAGENS PARA O WHATSAPP"
        title="Templates que abrem conversas"
        description="Crie mensagens, envie para aprovação e acompanhe o status da Meta."
      >
        <Button variant="outline" asChild>
          <Link href="/app/channels">
            <ArrowLeft size={15} />
            Canais
          </Link>
        </Button>
        <Button disabled={!canEdit || !usable.length} onClick={() => setOpen(true)}>
          <Plus size={15} />
          Novo template
        </Button>
      </ProductHeader>
      <div className="product-notice">
        <ShieldCheck size={19} />
        <span>
          Campanhas no WhatsApp usam templates aprovados, inclusive fora da janela de 24 horas.
        </span>
      </div>
      <div className="crm-table-toolbar card">
        <select
          aria-label="Conexão WhatsApp"
          value={connectionId}
          onChange={(e) => setConnectionId(e.target.value)}
        >
          <option value="">Escolha uma conexão</option>
          {usable.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.mode === 'fake' ? ' · Demonstração' : ''}
            </option>
          ))}
        </select>
        <Button variant="outline" disabled={busy || !connectionId || !canEdit} onClick={sync}>
          <RefreshCw size={15} />
          Sincronizar status
        </Button>
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error.message}
        </p>
      )}
      {templates.length ? (
        <div className="campaign-grid">
          {templates.map((t) => (
            <article className="card wa-template-card" key={t.id}>
              <div className="campaign-card-top">
                <span className="connection-option-icon channel-whatsapp">
                  <MessageSquare size={24} />
                </span>
                <Badge
                  tone={
                    t.status === 'APPROVED'
                      ? 'success'
                      : t.status === 'REJECTED'
                        ? 'neutral'
                        : 'warning'
                  }
                >
                  {{
                    APPROVED: 'Aprovado',
                    PENDING: 'Em análise',
                    REJECTED: 'Rejeitado',
                    PAUSED: 'Pausado',
                    DISABLED: 'Desativado',
                  }[t.status] ?? t.status}
                </Badge>
              </div>
              <h2>{t.name}</h2>
              <p className="muted">
                {t.category === 'MARKETING'
                  ? 'Marketing'
                  : t.category === 'UTILITY'
                    ? 'Utilidade'
                    : 'Autenticação'}{' '}
                · {t.language.replace('_', '-')} · {t.connection.name}
              </p>
              <div className="campaign-chat-preview">
                <p>{t.body}</p>
              </div>
              {t.connection.mode === 'fake' && (
                <p className="product-help">
                  <FlaskConical size={14} />
                  Aprovação simulada, sem envio à Meta.
                </p>
              )}
              {!t.supported && <Badge>Envio deste formato em breve</Badge>}
            </article>
          ))}
        </div>
      ) : (
        <EmptyProduct
          title="Sua primeira mensagem aprovada"
          description="Conecte seu WhatsApp existente para criar templates ou teste no modo demonstração."
        />
      )}
      <ProductDialog
        open={open}
        onOpenChange={setOpen}
        title="Criar template do WhatsApp"
        description="Esta etapa aceita templates de texto, de marketing ou utilidade."
      >
        <form
          className="product-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await productRequest(workspaceUrl('/api/whatsapp-templates', workspaceId), 'POST', {
                connectionId,
                name,
                language: 'pt_BR',
                category,
                body,
                examples: examples
                  .split('\n')
                  .map((v) => v.trim())
                  .filter(Boolean),
              });
              await client.invalidateQueries({ queryKey: ['whatsapp-templates', workspaceId] });
              toast.success(
                connection?.mode === 'fake'
                  ? 'Template criado na demonstração.'
                  : 'Template enviado para análise da Meta.',
              );
              setOpen(false);
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Conexão
            <select required value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
              {usable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {connection?.mode === 'fake' && (
            <div className="crm-demo-notice">
              <FlaskConical size={17} />
              Demonstração: a aprovação será simulada.
            </div>
          )}
          <label>
            Nome do template
            <input
              required
              pattern="[a-z][a-z0-9_]{1,100}"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="novidades_outubro"
            />
            <small className="product-help">Letras minúsculas, números e sublinhado.</small>
          </label>
          <label>
            Categoria
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="MARKETING">Marketing · novidades e ofertas</option>
              <option value="UTILITY">Utilidade · atualizações e lembretes</option>
            </select>
          </label>
          <label>
            Texto da mensagem
            <textarea
              required
              rows={5}
              maxLength={1024}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <label>
            Exemplos das variáveis, um por linha
            <textarea
              rows={2}
              value={examples}
              onChange={(e) => setExamples(e.target.value)}
              placeholder="Marina"
            />
          </label>
          <p className="product-help">
            Use {'{{1}}'}, {'{{2}}'} em sequência e um exemplo para cada variável. Autenticação e
            templates com mídia estarão disponíveis em uma próxima etapa.
          </p>
          <Button disabled={busy}>
            {busy
              ? 'Enviando...'
              : connection?.mode === 'fake'
                ? 'Criar na demonstração'
                : 'Enviar para aprovação'}
          </Button>
        </form>
      </ProductDialog>
    </>
  );
}
