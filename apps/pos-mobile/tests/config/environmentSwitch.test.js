import { expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

test('environment command selects either profile and preserves unrelated working settings', () => {
  const app = new URL('../../', import.meta.url);
  const target = mkdtempSync(join(tmpdir(), 'pos-api-profile-'));
  try {
    mkdirSync(join(target, 'scripts'));
    mkdirSync(join(target, 'environments'));
    copyFileSync(new URL('scripts/use-environment.mjs', app), join(target, 'scripts/use-environment.mjs'));
    for (const profile of ['local', 'production']) {
      copyFileSync(
        new URL(`environments/.env.${profile}`, app),
        join(target, `environments/.env.${profile}`),
      );
    }
    writeFileSync(join(target, '.env'), 'EXPO_PUBLIC_OTHER_SETTING=keep\nEXPO_PUBLIC_POS_API_URL=old\n');
    for (const profile of ['production', 'local']) {
      execFileSync('node', [join(target, 'scripts/use-environment.mjs'), profile]);
      const result = readFileSync(join(target, '.env'), 'utf8');
      expect(result).toContain(`EXPO_PUBLIC_API_ENVIRONMENT=${profile}`);
      expect(result).toContain('EXPO_PUBLIC_OTHER_SETTING=keep');
      expect(result.match(/^EXPO_PUBLIC_POS_API_URL=/gm)).toHaveLength(1);
      expect(result).toContain(
        profile === 'local' ? 'http://localhost:3501/api/graphql' : 'https://api.indyzai.com/pos/api/graphql',
      );
    }
    expect(() =>
      execFileSync('node', [join(target, 'scripts/use-environment.mjs'), 'unknown'], { stdio: 'pipe' }),
    ).toThrow();
    expect(readFileSync(join(target, '.env'), 'utf8')).toContain('EXPO_PUBLIC_API_ENVIRONMENT=local');
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});
