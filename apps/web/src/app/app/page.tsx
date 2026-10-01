import { Dashboard } from '@/components/dashboard';
import { getWorkspaceContext } from '@/lib/session';
import { getDashboard } from '@bothub/db';
export const metadata = { title: 'Visão geral' };
export default async function Page() {
  const { session, workspace } = await getWorkspaceContext();
  const data = await getDashboard(session.user.id, workspace.id);
  return (
    <Dashboard
      initialData={data}
      firstName={session.user.name.split(' ')[0] ?? session.user.name}
    />
  );
}
