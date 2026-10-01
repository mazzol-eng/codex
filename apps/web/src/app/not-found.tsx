import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
export default function NotFound() {
  return (
    <main id="main-content" className="section-container" style={{ paddingTop: 80 }}>
      <Logo />
      <h1 style={{ marginTop: 48 }}>Essa página se perdeu pelo caminho.</h1>
      <p className="muted">Vamos voltar ao início?</p>
      <Button asChild>
        <Link href="/">Voltar ao início</Link>
      </Button>
    </main>
  );
}
