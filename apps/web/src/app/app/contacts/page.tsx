import { getWorkspaceContext } from '@/lib/session';
import { listContacts, listConnections, listSegments } from '@bothub/runtime';
import { Contacts } from '@/components/product/contacts';
export default async function Page() {
  const { session, workspace, role } = await getWorkspaceContext();
  const [contacts, connections, segments] = await Promise.all([
    listContacts(session.user.id, workspace.id),
    listConnections(session.user.id, workspace.id),
    listSegments(session.user.id, workspace.id),
  ]);
  return (
    <Contacts
      workspaceId={workspace.id}
      initial={JSON.parse(JSON.stringify(contacts))}
      connections={JSON.parse(JSON.stringify(connections))}
      segments={JSON.parse(JSON.stringify(segments))}
      canEdit={role !== 'viewer'}
      canManage={['owner', 'admin'].includes(role)}
    />
  );
}
