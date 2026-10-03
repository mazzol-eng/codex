import { getContact, updateContact, deleteContact, contactPatchSchema } from '@bothub/runtime';
import { apiContext, handleApi, readJson } from '@/lib/product-api';
type Context = { params: Promise<{ contactId: string }> };
export async function GET(request: Request, { params }: Context) {
  return handleApi(async () => {
    const c = await apiContext(request);
    return getContact(c.userId, c.workspaceId, (await params).contactId);
  });
}
export async function PATCH(request: Request, { params }: Context) {
  return handleApi(async () => {
    const c = await apiContext(request, true);
    return updateContact(
      c.userId,
      c.workspaceId,
      (await params).contactId,
      contactPatchSchema.parse(await readJson(request, 20000)),
    );
  });
}
export async function DELETE(request: Request, { params }: Context) {
  return handleApi(async () => {
    const c = await apiContext(request, true);
    return deleteContact(c.userId, c.workspaceId, (await params).contactId);
  });
}
