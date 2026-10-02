'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { botTemplates } from '@bothub/flow-engine';
import {
  MessagesSquare,
  Sparkles,
  Calendar,
  Package,
  Star,
  Utensils,
  Wallet,
  Headphones,
  ArrowUpRight,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { ProductHeader, ProductDialog } from './shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChannelIcon } from '@/components/channel-icon';
import { productRequest, workspaceUrl } from '@/lib/product-client';
const icons = [MessagesSquare, Sparkles, Calendar, Package, Star, Utensils, Wallet, Headphones];
export function Templates({ workspaceId, canEdit }: { workspaceId: string; canEdit: boolean }) {
  const router = useRouter(),
    [category, setCategory] = useState('Todos'),
    [selected, setSelected] = useState<string | null>(null),
    [name, setName] = useState(''),
    [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    try {
      const bot = await productRequest<{ id: string }>(
        workspaceUrl('/api/bots', workspaceId),
        'POST',
        { name, templateId: selected },
      );
      toast.success('Template pronto para você personalizar.');
      router.push(`/app/bots/${bot.id}/editor`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ProductHeader
        eyebrow="UMA BOA IDEIA PARA COMEÇAR"
        title="Prontos para a sua próxima conversa"
        description="Templates feitos para o dia a dia. Escolha, personalize e deixe com a cara do seu negócio."
      />
      <div className="template-highlight">
        <span className="template-highlight-icon">
          <Sparkles size={27} />
        </span>
        <div>
          <h2>Seu primeiro bot, sem partir do zero.</h2>
          <p>Todos os templates podem ser testados agora no simulador, sem credenciais.</p>
        </div>
        <span>
          <Check size={15} />
          Importe em um clique
        </span>
      </div>
      <div className="product-tabs" aria-label="Categoria dos templates">
        {['Todos', 'Atendimento', 'Marketing', 'Vendas', 'Serviços'].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={c === category ? 'active' : ''}
            aria-pressed={c === category}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="template-grid">
        {botTemplates.map((t, i) => {
          if (category !== 'Todos' && t.category !== category) return null;
          const Icon = icons[i]!;
          return (
            <article className="card template-card" key={t.id}>
              <div className={`template-art template-art-${i % 4}`}>
                <Icon size={30} />
                <div className="template-mini-flow">
                  <i />
                  <span />
                  <i />
                </div>
              </div>
              <div className="template-card-body">
                <Badge tone="neutral">{t.category}</Badge>
                <h2>{t.name}</h2>
                <p>{t.description}</p>
                <div className="template-channel-row">
                  <ChannelIcon channel="telegram" size={14} />
                  <span>Telegram</span>
                  <ChannelIcon channel="simulator" size={14} />
                  <span>Simulador</span>
                </div>
                <Button
                  variant="outline"
                  disabled={!canEdit}
                  onClick={() => {
                    setSelected(t.id);
                    setName(t.name);
                  }}
                >
                  Usar template
                  <ArrowUpRight size={15} />
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      <ProductDialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
        title="Dê um nome ao seu bot"
        description="O template será copiado para sua empresa. Ajuste os textos antes de publicar."
      >
        <form
          className="product-form"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <label>
            Nome do bot
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={80}
            />
          </label>
          <Button disabled={busy || !canEdit}>
            {busy ? 'Importando...' : 'Usar template e abrir editor'}
            <ArrowUpRight size={15} />
          </Button>
        </form>
      </ProductDialog>
    </>
  );
}
