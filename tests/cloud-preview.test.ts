import { expect, it } from 'vitest';
import { authOrigin, codespaceOrigin } from '../config/cloud-preview';

const environment = { CODESPACES: 'true', CODESPACE_NAME: 'friendly-bot-123' };
it('leaves local development unchanged outside Codespaces', () => {
  expect(codespaceOrigin({})).toBeUndefined();
  expect(codespaceOrigin({ ...environment, CODESPACES: 'false' })).toBeUndefined();
});
it('uses the HTTPS forwarded URL for the current Codespace only', () => {
  expect(codespaceOrigin(environment)).toBe('https://friendly-bot-123-3000.app.github.dev');
});
it('authenticates against the exact Codespace origin despite a stale localhost auth setting', () => {
  expect(authOrigin({ ...environment, BETTER_AUTH_URL: 'http://localhost:3000' })).toBe(
    'https://friendly-bot-123-3000.app.github.dev',
  );
  expect(authOrigin({ ...environment, BETTER_AUTH_URL: 'https://untrusted.example' })).toBe(
    'https://friendly-bot-123-3000.app.github.dev',
  );
});
it('uses the configured canonical origin outside Codespaces', () => {
  expect(authOrigin({})).toBe('http://localhost:3000');
  expect(authOrigin({ BETTER_AUTH_URL: 'https://bothub.example/' })).toBe('https://bothub.example');
});
it('requires the Codespaces-provided name instead of an ambiguous origin', () => {
  expect(() => codespaceOrigin({ CODESPACES: 'true' })).toThrow(/CODESPACE_NAME/);
});
it.each(['evil.example/path', '../other', 'https://example.com', 'bad_name'])(
  'rejects a malformed Codespace name: %s',
  (name) => {
    expect(() => codespaceOrigin({ ...environment, CODESPACE_NAME: name })).toThrow();
  },
);
it.each(['app.github.dev.evil.example', 'https://app.github.dev', '*.app.github.dev'])(
  'does not trust an arbitrary forwarded domain: %s',
  (domain) => {
    expect(() =>
      codespaceOrigin({ ...environment, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: domain }),
    ).toThrow();
  },
);
