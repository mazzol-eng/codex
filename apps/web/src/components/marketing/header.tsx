'use client';
import Link from 'next/link';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="marketing-header">
      <div className="section-container header-inner">
        <Logo />
        <nav
          aria-label="Navegação principal"
          className={open ? 'marketing-nav open' : 'marketing-nav'}
        >
          <Link href="/recursos" onClick={() => setOpen(false)}>
            Recursos
          </Link>
          <Link href="/#templates" onClick={() => setOpen(false)}>
            Templates
          </Link>
          <Link href="/precos" onClick={() => setOpen(false)}>
            Preços
          </Link>
          <Link href="/#faq" onClick={() => setOpen(false)}>
            Dúvidas
          </Link>
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          <Link className="login-link" href="/login">
            Entrar
          </Link>
          <Button asChild>
            <Link href="/cadastro">
              Começar grátis <ArrowUpRight size={15} />
            </Link>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="mobile-menu"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </Button>
        </div>
      </div>
    </header>
  );
}
