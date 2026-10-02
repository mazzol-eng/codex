'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  GitBranch,
  Plug,
  Settings,
  LayoutDashboard,
  ArrowUpRight,
  Save,
  Pause,
  Play,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProductHeader, statusLabel } from './shared';
import { productRequest, workspaceUrl } from '@/lib/product-client';
import { ChannelIcon, channelLabel } from '@/components/channel-icon';
import type { BotRecord } from './types';
export function BotDetail({
  bot,
  workspaceId,
  canEdit,
}: {
  bot: BotRecord;
  workspaceId: string;
  canEdit: boolean;
}) {
  const router = useRouter(),
    [tab, setTab] = useState('overview'),
    [name, setName] = useState(bot.name),
    [fallback, setFallback] = useState(
      bot.settings?.fallback ?? 'Não entendi. Envie /start para começar.',
    ),
    [busy, setBusy] = useState(false);
  async function update(fields: unknown) {
    setBusy(true);
    try {
      await productRequest(workspaceUrl(`/api/bots/${bot.id}`, workspaceId), 'PATCH', {
        action: 'update',
        ...(fields as object),
      });
      toast.success('Bot atualizado.');
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="product-back" href="/app/bots">
        <ArrowLeft size={14} />
        Meus bots
      </Link>
      <ProductHeader eyebrow="SEU ASSISTENTE" title={bot.name} description={bot.description}>
        <Badge tone={bot.status === 'active' && bot.versions.length ? 'success' : 'neutral'}>
          {bot.status === 'active' && !bot.versions.length ? 'Exemplo' : statusLabel(bot.status)}
        </Badge>
        <Button
          variant="outline"
          disabled={!canEdit || busy || !bot.versions.length}
          onClick={() => update({ status: bot.status === 'active' ? 'paused' : 'active' })}
        >
          {bot.status === 'active' ? <Pause size={15} /> : <Play size={15} />}{' '}
          {bot.status === 'active' ? 'Pausar bot' : 'Ativar bot'}
        </Button>
        <Button asChild>
          <Link href={`/app/bots/${bot.id}/editor`}>
            Abrir editor
            <ArrowUpRight size={15} />
          </Link>
        </Button>
      </ProductHeader>
      <div className="product-tabs">
        {[
          { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
          { id: 'flows', label: 'Fluxos', icon: GitBranch },
          { id: 'channels', label: 'Canais', icon: Plug },
          { id: 'settings', label: 'Configurações', icon: Settings },
        ].map((t) => (
          <button
            key={t.id}
            aria-pressed={t.id === tab}
            className={t.id === tab ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>
      {(tab === 'overview' || tab === 'flows') && (
        <div className="bot-detail-grid">
          <section className="card bot-flow-summary">
            <span className="bot-flow-mark">
              <GitBranch size={32} />
            </span>
            <h2>Seu fluxo principal</h2>
            <p>
              {bot.versions.length
                ? `Versão ${bot.versions[0]!.number} publicada. Conversas em andamento mantêm a versão anterior.`
                : 'Ajuste o fluxo, converse no simulador e publique quando estiver pronto.'}
            </p>
            <div className="flow-summary-stats">
              <span>
                <strong>{bot.draft?.nodes?.length ?? 2}</strong> nós no rascunho
              </span>
              <span>
                <strong>{bot.versions.length}</strong> versões publicadas
              </span>
            </div>
            <Button asChild>
              <Link href={`/app/bots/${bot.id}/editor`}>
                Personalizar conversa
                <ArrowUpRight size={15} />
              </Link>
            </Button>
          </section>
          <section className="card bot-steps">
            <h2>Da ideia à primeira conversa</h2>
            {[
              'Personalize as mensagens do fluxo',
              'Teste no simulador do editor',
              'Publique uma versão',
              'Conecte seu Telegram ou um simulador',
            ].map((t, i) => (
              <div key={t}>
                <span>{i === 2 && bot.versions.length ? <Check size={15} /> : i + 1}</span>
                <p>{t}</p>
              </div>
            ))}
            <Link href="/app/channels">
              Conectar um canal
              <ArrowUpRight size={14} />
            </Link>
          </section>
        </div>
      )}
      {tab === 'channels' && (
        <section className="card bot-settings">
          <h2>Onde este bot responde</h2>
          {bot.connections.length ? (
            bot.connections.map((c) => (
              <div className="bot-connection-summary" key={c.id}>
                <ChannelIcon channel={c.channel} />
                <strong>{c.name}</strong>
                <span>{channelLabel(c.channel)}</span>
                <Badge tone="neutral">{statusLabel(c.status)}</Badge>
              </div>
            ))
          ) : (
            <p>Você ainda não conectou um canal a este bot.</p>
          )}
          <Button asChild>
            <Link href="/app/channels">
              <Plug size={15} />
              Gerenciar canais
            </Link>
          </Button>
        </section>
      )}
      {tab === 'settings' && (
        <section className="card bot-settings">
          <h2>Os detalhes da sua conversa</h2>
          <form
            className="product-form"
            onSubmit={(e) => {
              e.preventDefault();
              update({ name, settings: { ...bot.settings, fallback } });
            }}
          >
            <label>
              Nome do bot
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={80}
                required
                disabled={!canEdit}
              />
            </label>
            <label>
              Quando o bot não entender
              <textarea
                value={fallback}
                onChange={(e) => setFallback(e.target.value)}
                maxLength={500}
                disabled={!canEdit}
              />
            </label>
            <p className="product-help">
              Boas-vindas e transferência são personalizadas nos nós do editor. Horário de
              atendimento e regras avançadas chegam em uma próxima fase.
            </p>
            <Button disabled={busy || !canEdit}>
              <Save size={15} />
              {busy ? 'Salvando...' : 'Salvar configurações'}
            </Button>
          </form>
        </section>
      )}
    </>
  );
}
