'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="section-container" style={{ paddingTop: 100 }}>
      <h1>Algo não saiu como esperado.</h1>
      <p className="muted">Tente novamente em alguns instantes. Seus dados continuam salvos.</p>
      <Button onClick={reset}>Tentar novamente</Button>
    </main>
  );
}
