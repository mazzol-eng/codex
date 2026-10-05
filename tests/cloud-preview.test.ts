import { expect, it } from 'vitest';
import { codespaceOrigin } from '../config/cloud-preview';

const environment = { CODESPACES: 'true', CODESPACE_NAME: 'friendly-bot-123' };
it('leaves local development unchanged outside Codespaces', () => {
  expect(codespaceOrigin({})).toBeUndefined();
  expect(codespaceOrigin({ ...environment, CODESPACES: 'false' })).toBeUndefined();
});
it('uses the HTTPS forwarded URL for the current Codespace only', () => {
  expect(codespaceOrigin(environment)).toBe('https://friendly-bot-123-3000.app.github.dev');
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
