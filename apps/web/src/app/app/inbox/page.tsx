import { getWorkspaceContext } from '@/lib/session';
import { listConversations } from '@bothub/runtime';
import { Inbox } from '@/components/product/inbox';
export default async function Page() {
  const { session, workspace, role } = await getWorkspaceContext();
  return (
    <Inbox
      workspaceId={workspace.id}
      userId={session.user.id}
      canRespond={role !== 'viewer'}
      timeZone={workspace.timeZone}
      initialConversations={JSON.parse(
        JSON.stringify(await listConversations(session.user.id, workspace.id)),
      )}
    />
  );
}
