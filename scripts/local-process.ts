import { readFileSync } from 'node:fs';

export function isProcessAlive(pid: number, platform: NodeJS.Platform = process.platform): boolean {
  try {
    process.kill(pid, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
  if (platform !== 'linux') return true;
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    // Process names can contain spaces and parentheses; state follows the final closing parenthesis.
    const state = stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0];
    return state !== 'Z' && state !== 'X';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
