import { getWorkspaceContext } from '@/lib/session';
import {
  listCampaigns,
  listConnections,
  listSegments,
  listWhatsAppTemplates,
} from '@bothub/runtime';
import { Campaigns } from '@/components/product/campaigns';
export default async function Page() {
  const { session, workspace, role } = await getWorkspaceContext();
  const [campaigns, connections, segments, templates] = await Promise.all([
    listCampaigns(session.user.id, workspace.id),
    listConnections(session.user.id, workspace.id),
    listSegments(session.user.id, workspace.id),
    listWhatsAppTemplates(session.user.id, workspace.id),
  ]);
  return (
    <Campaigns
      workspaceId={workspace.id}
      timeZone={workspace.timeZone}
      initial={JSON.parse(JSON.stringify(campaigns))}
      connections={JSON.parse(JSON.stringify(connections))}
      segments={JSON.parse(JSON.stringify(segments))}
      templates={JSON.parse(JSON.stringify(templates))}
      canEdit={['owner', 'admin'].includes(role)}
    />
  );
}
