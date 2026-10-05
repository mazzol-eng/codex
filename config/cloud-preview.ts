type CloudEnvironment = Record<string, string | undefined>;

export function codespaceOrigin(environment: CloudEnvironment = process.env): string | undefined {
  if (environment.CODESPACES !== 'true') return undefined;
  const name = environment.CODESPACE_NAME;
  const domain = environment.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? 'app.github.dev';
  if (!name || !/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/.test(name))
    throw new Error('Codespaces must provide a valid CODESPACE_NAME.');
  if (domain !== 'app.github.dev')
    throw new Error('This demo supports the official app.github.dev forwarding domain.');
  return `https://${name}-3000.${domain}`;
}
