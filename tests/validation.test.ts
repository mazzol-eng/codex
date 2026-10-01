import { describe, it, expect } from 'vitest';
import { signupSchema, workspaceSchema, loginSchema } from '../apps/web/src/lib/validation';
describe('input validation', () => {
  it('rejects weak passwords and unaccepted terms', () => {
    expect(
      signupSchema.safeParse({
        name: 'Ana',
        email: 'ana@example.com',
        password: '123',
        terms: false,
      }).success,
    ).toBe(false);
  });
  it('accepts a valid signup and trims the name', () => {
    const result = signupSchema.parse({
      name: '  Ana Silva  ',
      email: 'ana@example.com',
      password: 'A-long-test-password',
      terms: true,
    });
    expect(result.name).toBe('Ana Silva');
  });
  it('rejects invalid email addresses', () => {
    expect(loginSchema.safeParse({ email: 'wrong', password: 'anything' }).success).toBe(false);
  });
  it('rejects unsupported time zones', () => {
    expect(
      workspaceSchema.safeParse({ name: 'Company', segment: 'Serviços', timeZone: 'Wrong/Zone' })
        .success,
    ).toBe(false);
  });
  it('accepts Brazilian time zones and known segments', () => {
    expect(
      workspaceSchema.safeParse({
        name: 'Company',
        segment: 'Comércio',
        timeZone: 'America/Manaus',
      }).success,
    ).toBe(true);
  });
});
