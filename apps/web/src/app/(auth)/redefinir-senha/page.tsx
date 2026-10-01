import { Suspense } from 'react';
import { ResetForm } from '@/components/auth/auth-form';
export const metadata = { title: 'Redefinir senha' };
export default function Page() {
  return (
    <Suspense fallback={<div className="loading-block" />}>
      <ResetForm />
    </Suspense>
  );
}
