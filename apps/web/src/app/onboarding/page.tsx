import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { OnboardingForm } from '@/components/onboarding-form';
import { requireSession } from '@/lib/session';
import './onboarding.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sua empresa' };
export default async function Page() {
  const { user } = await requireSession();
  return (
    <div className="onboarding-page">
      <header>
        <Logo />
        <ThemeToggle />
      </header>
      <main id="main-content">
        <OnboardingForm firstName={user.name.split(' ')[0] ?? user.name} />
      </main>
    </div>
  );
}
