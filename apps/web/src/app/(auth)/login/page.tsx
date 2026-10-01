import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/auth-form';
import { googleEnabled } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Entrar' };
export default function Page() {
  return (
    <Suspense fallback={<div className="loading-block" />}>
      <AuthForm mode="login" googleEnabled={googleEnabled} />
    </Suspense>
  );
}
