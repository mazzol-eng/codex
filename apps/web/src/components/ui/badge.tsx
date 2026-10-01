import { cn } from '@/lib/utils';
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'primary';
}) {
  return <span className={cn('badge', `badge-${tone}`)}>{children}</span>;
}
