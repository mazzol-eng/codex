import { Suspense } from 'react';
import { VerifyForm } from '@/components/auth/auth-form';
export const metadata = { title: 'Verificar acesso' };
export default function Page() {
  return (
    <Suspense fallback={<div className="loading-block" />}>
      <VerifyForm />
    </Suspense>
  );
}
