import { notFound } from 'next/navigation';
import { getWorkspaceContext } from '@/lib/session';
import { getBot, ProductError } from '@bothub/runtime';
import { FlowEditor } from '@/components/product/editor';
export default async function Page({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params,
    { session, workspace, role } = await getWorkspaceContext();
  const bot = await getBot(session.user.id, workspace.id, botId).catch((e) => {
    if (e instanceof ProductError && e.status === 404) notFound();
    throw e;
  });
  return (
    <FlowEditor
      bot={JSON.parse(JSON.stringify(bot))}
      workspaceId={workspace.id}
      canEdit={['owner', 'admin'].includes(role)}
    />
  );
}
