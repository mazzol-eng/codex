import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Bot,
  MessagesSquare,
  Users,
  Send,
  LayoutTemplate,
  BarChart3,
  Plug,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
const modules = {
  bots: {
    title: 'Seus bots',
    icon: Bot,
    phase: 2,
    description: 'Um assistente com a personalidade do seu negócio.',
    features: [
      'Criar a partir de um template',
      'Editar fluxos visualmente',
      'Publicar e testar no simulador',
    ],
  },
  inbox: {
    title: 'Caixa de entrada',
    icon: MessagesSquare,
    phase: 2,
    description: 'Toda conversa merece atenção. Aqui, sua equipe assume quando precisar.',
    features: [
      'Conversas em tempo real',
      'Assumir e devolver ao bot',
      'Respostas rápidas e histórico',
    ],
  },
  contacts: {
    title: 'Seus contatos',
    icon: Users,
    phase: 3,
    description: 'Conheça quem está do outro lado de cada conversa.',
    features: ['Tags e segmentos', 'Importação e exportação CSV', 'Consentimento por canal'],
  },
  campaigns: {
    title: 'Campanhas',
    icon: Send,
    phase: 3,
    description: 'A mensagem certa, para quem quer receber, no momento certo.',
    features: [
      'Segmentação com consentimento',
      'Agendamento de mensagens',
      'Relatórios de entrega',
    ],
  },
  templates: {
    title: 'Templates de bots',
    icon: LayoutTemplate,
    phase: 2,
    description: 'Uma boa ideia é o melhor ponto de partida.',
    features: [
      'Atendimento e FAQ',
      'Captação de leads e agendamento',
      'Pesquisa de satisfação e suporte',
    ],
  },
  analytics: {
    title: 'Relatórios',
    icon: BarChart3,
    phase: 4,
    description: 'Entenda as conversas que fazem seu negócio crescer.',
    features: ['Funil por fluxo', 'Conclusão e abandono', 'Exportação dos resultados'],
  },
  channels: {
    title: 'Seus canais',
    icon: Plug,
    phase: 2,
    description: 'Esteja onde seu cliente está, com um fluxo que vai a todos os lugares.',
    features: [
      'Telegram e Simulador · Fase 2',
      'WhatsApp oficial e SMS · Fase 3',
      'Status e teste de conexão',
    ],
  },
  team: {
    title: 'Sua equipe',
    icon: Users,
    phase: 4,
    description: 'Boas conversas ficam ainda melhores quando vocês trabalham juntos.',
    features: ['Convites por e-mail', 'Papéis e permissões', 'Histórico de atividades'],
  },
  settings: {
    title: 'Configurações',
    icon: Settings,
    phase: 4,
    description: 'Seu espaço com a cara e o ritmo do seu negócio.',
    features: [
      'Perfil e preferências',
      'Segurança e autenticação em duas etapas',
      'Privacidade e retenção de dados',
    ],
  },
};
export default async function Page({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  if (!(module in modules)) notFound();
  const item = modules[module as keyof typeof modules];
  return (
    <div className="coming-page">
      <Link href="/app" className="back-link">
        <ArrowLeft size={14} />
        Voltar para visão geral
      </Link>
      <div className="coming-card card">
        <span className="coming-illustration">
          <item.icon size={43} />
          <Sparkles className="coming-sparkle" size={19} />
        </span>
        <Badge tone="primary">Em breve · Fase {item.phase}</Badge>
        <h1>{item.title}</h1>
        <p>{item.description}</p>
        <div className="coming-features">
          {item.features.map((f) => (
            <span key={f}>
              <span /> {f}
            </span>
          ))}
        </div>
        <p className="coming-status">
          Estamos construindo esta etapa. Ela ainda não está disponível nesta versão.
        </p>
        <Button asChild>
          <Link href="/app">
            Explorar meu painel <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
    </div>
  );
}
