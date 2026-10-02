import { getWorkspaceContext } from '@/lib/session';
import { listBots } from '@bothub/runtime';
import { Bots } from '@/components/product/bots';
export default async function Page() {
  const { session, workspace, role } = await getWorkspaceContext();
  return (
    <Bots
      workspaceId={workspace.id}
      canEdit={['owner', 'admin'].includes(role)}
      initialBots={JSON.parse(JSON.stringify(await listBots(session.user.id, workspace.id)))}
    />
  );
}
