import { importContacts, csvImportSchema } from '@bothub/runtime';
import { apiContext, handleApi, readJson } from '@/lib/product-api';
export async function POST(request: Request) {
  return handleApi(async () => {
    const c = await apiContext(request, true);
    return importContacts(
      c.userId,
      c.workspaceId,
      csvImportSchema.parse(await readJson(request, 300000)),
    );
  });
}
