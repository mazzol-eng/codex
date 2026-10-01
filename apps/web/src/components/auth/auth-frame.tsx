import Link from 'next/link';
import { brand } from '../../../../../config/brand';
import { MessageCircle, Sparkles, Check, ArrowLeft, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Logo />
        <div className="auth-story-content">
          <span className="auth-story-badge">
            <Sparkles size={14} /> UMA BOA CONVERSA MUDA TUDO
          </span>
          <h2>
            Mais perto dos clientes.
            <br />
            Mais tempo para você.
          </h2>
          <p>Seu atendimento pode ser simples, inteligente e ter a cara do seu negócio.</p>
          <div className="auth-illustration">
            <div className="story-message">
              <span>
                <MessageCircle size={17} />
              </span>
              <div>
                <b>“Oi, vocês estão abertos?”</b>
                <small>Seu próximo cliente acabou de chegar.</small>
              </div>
            </div>
            <div className="story-message story-reply">
              <span>
                <Sparkles size={17} />
              </span>
              <div>
                <b>“Olá! Que bom ter você aqui. 💜”</b>
                <small>O primeiro atendimento já está acontecendo.</small>
              </div>
              <Check size={17} />
            </div>
          </div>
          <div className="auth-benefits">
            <span>
              <Check size={15} /> Comece sem cartão de crédito
            </span>
            <span>
              <Check size={15} /> Tudo em português, sem complicação
            </span>
            <span>
              <Check size={15} /> Um espaço só para sua empresa
            </span>
          </div>
        </div>
        <span className="auth-story-footer">
          <ShieldCheck size={15} /> Sua confiança importa. Seus dados também.
        </span>
      </aside>
      <div className="auth-main">
        <div className="auth-top">
          <Link href="/" className="muted">
            <ArrowLeft size={14} /> Voltar ao início
          </Link>
          <ThemeToggle />
        </div>
        <main id="main-content" className="auth-form-container">
          {children}
        </main>
        <footer className="auth-footer">
          Ao usar o {brand.name}, você conta com nossos <Link href="/termos">termos</Link> e{' '}
          <Link href="/privacidade">política de privacidade</Link>.
        </footer>
      </div>
    </div>
  );
}
