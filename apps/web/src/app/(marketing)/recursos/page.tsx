import Link from 'next/link';
import {
  GitBranch,
  MessageCircle,
  BarChart3,
  Users,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
export const metadata = { title: 'Recursos' };
export default function Page() {
  return (
    <main id="main-content" className="section-container resources-page">
      <div className="section-heading">
        <span className="eyebrow">SEU NEGÓCIO, MAIS CONECTADO</span>
        <h1>
          Uma casa para todas
          <br />
          as suas conversas.
        </h1>
        <p>Veja o que já está disponível e o que vem nos próximos passos.</p>
      </div>
      <div className="features-grid">
        {[
          {
            icon: BarChart3,
            title: 'Painel de resultados',
            text: 'Tenha uma visão do atendimento com métricas e gráficos por período.',
            phase: 'Disponível · dados demo',
          },
          {
            icon: Users,
            title: 'Conta e empresa',
            text: 'Crie sua conta, configure sua empresa e organize seu espaço de trabalho.',
            phase: 'Disponível',
          },
          {
            icon: GitBranch,
            title: 'Editor e simulador',
            text: 'Monte e teste fluxos de conversa sem depender de um canal real.',
            phase: 'Em breve · Fase 2',
          },
          {
            icon: MessageCircle,
            title: 'Canais e atendimento',
            text: 'Telegram e Inbox na Fase 2; WhatsApp oficial e SMS na Fase 3.',
            phase: 'Em breve',
          },
          {
            icon: ShieldCheck,
            title: 'Equipe e permissões',
            text: 'Convide sua equipe e defina quem pode fazer o quê.',
            phase: 'Em breve · Fase 4',
          },
          {
            icon: Sparkles,
            title: 'Campanhas e análises',
            text: 'Converse com quem autorizou e entenda cada resultado.',
            phase: 'Em breve · Fases 3 e 4',
          },
        ].map((f) => (
          <article className="feature-card card" key={f.title}>
            <span className="feature-icon">
              <f.icon size={23} />
            </span>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
            <span className="badge badge-primary">{f.phase}</span>
          </article>
        ))}
      </div>
      <div className="resources-cta">
        <Button asChild>
          <Link href="/cadastro">
            Conhecer o painel <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
    </main>
  );
}
