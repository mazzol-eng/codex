import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { isProcessAlive } from '../scripts/local-process';

vi.mock('node:fs', () => ({ readFileSync: vi.fn() }));
beforeEach(() => {
  vi.spyOn(process, 'kill').mockReturnValue(true);
  vi.mocked(readFileSync).mockReturnValue('123 (postgres) S 1 123');
});
afterEach(() => vi.restoreAllMocks());

it('keeps a live database protected from stale PID cleanup', () => {
  expect(isProcessAlive(123, 'linux')).toBe(true);
  expect(process.kill).toHaveBeenCalledWith(123, 0);
});
it.each(['Z', 'X'])('recognizes a terminated Linux process in state %s', (state) => {
  vi.mocked(readFileSync).mockReturnValue(`123 (postgres) ${state} 1 123`);
  expect(isProcessAlive(123, 'linux')).toBe(false);
});
it('handles process names containing spaces and parentheses', () => {
  vi.mocked(readFileSync).mockReturnValue('123 (postgres (worker)) S 1 123');
  expect(isProcessAlive(123, 'linux')).toBe(true);
});
it('recognizes a PID that no longer exists', () => {
  vi.mocked(process.kill).mockImplementation(() => {
    throw Object.assign(new Error('missing process'), { code: 'ESRCH' });
  });
  expect(isProcessAlive(123, 'linux')).toBe(false);
});
it('handles the process exiting between the signal probe and the state read', () => {
  vi.mocked(readFileSync).mockImplementation(() => {
    throw Object.assign(new Error('missing state'), { code: 'ENOENT' });
  });
  expect(isProcessAlive(123, 'linux')).toBe(false);
});
it('does not mistake signal permission failures for an exited process', () => {
  vi.mocked(process.kill).mockImplementation(() => {
    throw Object.assign(new Error('denied'), { code: 'EPERM' });
  });
  expect(() => isProcessAlive(123, 'linux')).toThrow('denied');
});
it('does not mistake unreadable process state for an exited process', () => {
  vi.mocked(readFileSync).mockImplementation(() => {
    throw Object.assign(new Error('denied'), { code: 'EACCES' });
  });
  expect(() => isProcessAlive(123, 'linux')).toThrow('denied');
});
it('uses the standard process probe on platforms without procfs', () => {
  expect(isProcessAlive(123, 'win32')).toBe(true);
  expect(isProcessAlive(123, 'darwin')).toBe(true);
});
