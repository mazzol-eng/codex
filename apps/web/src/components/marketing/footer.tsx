import Link from 'next/link';
import { Logo } from '@/components/logo';
import { brand } from '../../../../../config/brand';
export function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="section-container">
        <div className="footer-top">
          <div>
            <Logo />
            <p className="muted">
              Menos tarefas repetitivas.
              <br />
              Mais espaço para o seu negócio crescer.
            </p>
          </div>
          <div>
            <strong>Produto</strong>
            <Link href="/recursos">Recursos</Link>
            <Link href="/precos">Preços</Link>
            <Link href="/#templates">Templates</Link>
          </div>
          <div>
            <strong>Comece por aqui</strong>
            <Link href="/cadastro">Criar minha conta</Link>
            <Link href="/login">Acessar o painel</Link>
            <Link href="/#faq">Perguntas frequentes</Link>
          </div>
          <div>
            <strong>Informações</strong>
            <Link href="/termos">Termos de uso</Link>
            <Link href="/privacidade">Privacidade</Link>
            <span className="muted">Feito para negócios brasileiros.</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {brand.name}. Todos os direitos reservados.
          </span>
          <span>
            Uma conversa pode mudar tudo. <span className="gradient-text">✦</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
