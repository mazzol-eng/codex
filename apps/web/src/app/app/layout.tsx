import { AppShell } from '@/components/app-shell';
import { getWorkspaceContext } from '@/lib/session';
import './app.css';
export const dynamic = 'force-dynamic';
export default async function Layout({ children }: { children: React.ReactNode }) {
  const { session, workspace, workspaces, role } = await getWorkspaceContext();
  return (
    <AppShell
      user={{ name: session.user.name, email: session.user.email }}
      workspace={workspace}
      workspaces={workspaces}
      role={role}
    >
      {children}
    </AppShell>
  );
}
