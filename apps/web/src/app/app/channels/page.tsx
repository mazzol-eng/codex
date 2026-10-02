import { getWorkspaceContext } from '@/lib/session';
import { listBots, listConnections } from '@bothub/runtime';
import { Channels } from '@/components/product/channels';
export default async function Page() {
  const { session, workspace, role } = await getWorkspaceContext();
  const [bots, connections] = await Promise.all([
    listBots(session.user.id, workspace.id),
    listConnections(session.user.id, workspace.id),
  ]);
  return (
    <Channels
      workspaceId={workspace.id}
      canEdit={['owner', 'admin'].includes(role)}
      bots={JSON.parse(JSON.stringify(bots))}
      connections={JSON.parse(JSON.stringify(connections))}
    />
  );
}
