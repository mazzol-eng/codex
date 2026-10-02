import { getWorkspaceContext } from '@/lib/session';
import { Templates } from '@/components/product/templates';
export default async function Page() {
  const { workspace, role } = await getWorkspaceContext();
  return <Templates workspaceId={workspace.id} canEdit={['owner', 'admin'].includes(role)} />;
}
