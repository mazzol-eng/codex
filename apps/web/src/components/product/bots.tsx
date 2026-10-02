'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bot,
  Plus,
  ArrowUpRight,
  Copy,
  Archive,
  Pause,
  Play,
  Search,
  GitBranch,
  LayoutTemplate,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProductHeader, ProductDialog, EmptyProduct, statusLabel } from './shared';
import { productRequest, workspaceUrl } from '@/lib/product-client';
import { ChannelIcon, channelLabel } from '@/components/channel-icon';
import type { BotRecord } from './types';
export function Bots({
  initialBots,
  workspaceId,
  canEdit,
}: {
  initialBots: BotRecord[];
  workspaceId: string;
  canEdit: boolean;
}) {
  const router = useRouter(),
    [search, setSearch] = useState(''),
    [open, setOpen] = useState(false),
    [name, setName] = useState(''),
    [busy, setBusy] = useState(false);
  const bots = initialBots.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));
  async function create() {
    setBusy(true);
    try {
      const bot = await productRequest<{ id: string }>(
        workspaceUrl('/api/bots', workspaceId),
        'POST',
        { name },
      );
      router.push(`/app/bots/${bot.id}/editor`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function action(bot: BotRecord, kind: 'duplicate' | 'paused' | 'active' | 'archived') {
    try {
      if (kind === 'duplicate') {
        await productRequest(workspaceUrl('/api/bots', workspaceId), 'POST', {
          name: `${bot.name.slice(0, 65)} (cópia)`,
          duplicateId: bot.id,
        });
        toast.success('Cópia criada como rascunho.');
      } else
        await productRequest(workspaceUrl(`/api/bots/${bot.id}`, workspaceId), 'PATCH', {
          action: 'update',
          status: kind,
        });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <>
      <ProductHeader
        eyebrow="SEUS ASSISTENTES"
        title="Boas conversas começam aqui"
        description="Crie, organize e acompanhe os bots da sua empresa."
      >
        <Button variant="outline" asChild>
          <Link href="/app/templates">
            <LayoutTemplate size={16} />
            Explorar templates
          </Link>
        </Button>
        <Button disabled={!canEdit} onClick={() => setOpen(true)}>
          <Plus size={16} />
          Criar bot
        </Button>
      </ProductHeader>
      <div className="product-toolbar">
        <label className="product-search">
          <Search size={17} />
          <input
            placeholder="Buscar um bot..."
            aria-label="Buscar bots"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <span>
          {bots.length} {bots.length === 1 ? 'assistente' : 'assistentes'}
        </span>
      </div>
      {bots.length ? (
        <div className="bot-grid">
          {bots.map((bot, i) => (
            <article className="card bot-card" key={bot.id}>
              <div className="bot-card-top">
                <span className={`bot-icon bot-color-${i % 3}`}>
                  <Bot size={25} />
                </span>
                <Badge
                  tone={bot.status === 'active' && bot.versions.length ? 'success' : 'neutral'}
                >
                  {bot.status === 'active' && !bot.versions.length
                    ? 'Exemplo'
                    : statusLabel(bot.status)}
                </Badge>
              </div>
              <Link href={`/app/bots/${bot.id}`}>
                <h2>{bot.name}</h2>
                <p>{bot.description}</p>
              </Link>
              <div className="bot-card-channels">
                {bot.connections.filter((c) => c.status === 'connected').length ? (
                  bot.connections
                    .filter((c) => c.status === 'connected')
                    .map((c) => (
                      <span key={c.id}>
                        <ChannelIcon channel={c.channel} size={13} />
                        {channelLabel(c.channel)}
                      </span>
                    ))
                ) : (
                  <span>
                    <GitBranch size={13} />
                    {bot.versions[0]
                      ? `Versão ${bot.versions[0].number} publicada`
                      : 'Seu fluxo começa no editor'}
                  </span>
                )}
              </div>
              <div className="bot-card-footer">
                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/app/bots/${bot.id}/editor`}>
                    Abrir editor
                    <ArrowUpRight size={14} />
                  </Link>
                </Button>
                <div>
                  <button
                    className="icon-control"
                    disabled={!canEdit}
                    title="Duplicar bot"
                    aria-label={`Duplicar ${bot.name}`}
                    onClick={() => action(bot, 'duplicate')}
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    className="icon-control"
                    disabled={!canEdit || !bot.versions.length}
                    aria-label={
                      bot.status === 'active' ? `Pausar ${bot.name}` : `Ativar ${bot.name}`
                    }
                    onClick={() => action(bot, bot.status === 'active' ? 'paused' : 'active')}
                  >
                    {bot.status === 'active' ? <Pause size={15} /> : <Play size={15} />}
                  </button>
                  <button
                    className="icon-control"
                    disabled={!canEdit}
                    aria-label={`Arquivar ${bot.name}`}
                    onClick={() => action(bot, 'archived')}
                  >
                    <Archive size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyProduct
          title={
            search
              ? 'Nenhum bot com esse nome'
              : 'Seu próximo assistente está a uma ideia de distância'
          }
          description={
            search
              ? 'Tente buscar outro nome.'
              : 'Escolha um template, ajuste as mensagens e teste sem conectar um canal real.'
          }
        >
          <Button asChild>
            <Link href="/app/templates">
              Escolher um template
              <ArrowUpRight size={15} />
            </Link>
          </Button>
        </EmptyProduct>
      )}
      <ProductDialog
        open={open}
        onOpenChange={setOpen}
        title="Crie seu assistente"
        description="Comece com uma conversa simples. Você pode mudar tudo no editor."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
          className="product-form"
        >
          <label>
            Nome do bot
            <input
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Atendimento da loja"
            />
          </label>
          <Button disabled={busy || !canEdit}>
            {busy ? 'Criando...' : 'Criar e abrir editor'}
            <ArrowUpRight size={15} />
          </Button>
        </form>
      </ProductDialog>
    </>
  );
}
