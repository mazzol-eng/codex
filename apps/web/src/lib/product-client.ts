export class ProductClientError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function productRequest<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json();
  if (!response.ok)
    throw new ProductClientError(
      value.error ?? 'Não conseguimos concluir. Tente novamente.',
      response.status,
    );
  return value as T;
}
export function workspaceUrl(path: string, workspaceId: string) {
  return `${path}?workspaceId=${encodeURIComponent(workspaceId)}`;
}
