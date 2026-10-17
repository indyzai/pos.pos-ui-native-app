import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const profile = process.argv[2];
if (!['local', 'production'].includes(profile)) throw new Error('Use local or production');
const app = new URL('../', import.meta.url);
const selected = await readFile(new URL(`environments/.env.${profile}`, app), 'utf8');
let current = '';
try {
  current = await readFile(new URL('.env', app), 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const entries = selected.split(/\r?\n/).filter((line) => /^EXPO_PUBLIC_[A-Z_]+=/.test(line));
const keys = new Set(entries.map((line) => line.split('=')[0]));
const preserved = current.split(/\r?\n/).filter((line) => !keys.has(line.split('=')[0]));
await writeFile(new URL('.env', app), preserved.join('\n').trimEnd() + '\n' + entries.join('\n') + '\n');
console.log(
  `POS mobile uses ${profile}. Restart Expo with --clear to load ${fileURLToPath(new URL('.env', app))}.`,
);
