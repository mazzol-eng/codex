import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './auth';
import { listWorkspaces, authorizeWorkspace } from '@bothub/db';
export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  return session;
}
export async function getWorkspaceContext() {
  const session = await requireSession();
  const workspaces = await listWorkspaces(session.user.id);
  if (!workspaces.length) redirect('/onboarding');
  const selected = (await cookies()).get('workspace-id')?.value;
  const workspace = workspaces.find((w) => w.id === selected) ?? workspaces[0]!;
  const membership = await authorizeWorkspace(session.user.id, workspace.id);
  return { session, workspace, workspaces, role: membership.role };
}
