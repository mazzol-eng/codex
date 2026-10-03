import { getWorkspaceContext } from '@/lib/session';
import { listConnections, listWhatsAppTemplates } from '@bothub/runtime';
import { WhatsAppTemplates } from '@/components/product/whatsapp-templates';
export default async function Page() {
  const { session, workspace, role } = await getWorkspaceContext();
  const [connections, templates] = await Promise.all([
    listConnections(session.user.id, workspace.id),
    listWhatsAppTemplates(session.user.id, workspace.id),
  ]);
  return (
    <WhatsAppTemplates
      workspaceId={workspace.id}
      connections={JSON.parse(JSON.stringify(connections))}
      initial={JSON.parse(JSON.stringify(templates))}
      canEdit={['owner', 'admin'].includes(role)}
    />
  );
}
