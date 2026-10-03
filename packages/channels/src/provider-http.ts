import { fetch, EnvHttpProxyAgent } from 'undici';
import { ChannelError } from './adapters';
const dispatcher = new EnvHttpProxyAgent();
export async function providerRequest(
  url: string,
  init: { method?: string; headers: Record<string, string>; body?: string },
) {
  let response;
  try {
    response = await fetch(url, { ...init, dispatcher, signal: AbortSignal.timeout(10000) });
  } catch {
    throw new ChannelError('network_failure');
  }
  const value = await response.json().catch(() => null);
  if (!response.ok)
    throw new ChannelError(
      response.status === 429
        ? 'rate_limited'
        : response.status >= 500
          ? 'network_failure'
          : 'provider_request_failed',
      Number(response.headers.get('retry-after')) || undefined,
    );
  if (!value || typeof value !== 'object') throw new ChannelError('provider_response_invalid');
  return value;
}
