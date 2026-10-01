import { Suspense } from 'react';
import { RecoveryForm } from '@/components/auth/auth-form';
export const metadata = { title: 'Recuperar senha' };
export default function Page() {
  return (
    <Suspense fallback={<div className="loading-block" />}>
      <RecoveryForm />
    </Suspense>
  );
}
