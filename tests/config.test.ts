import { describe, expect, it } from 'vitest';
import { versionLabel } from '../src/config';

// Vitest dùng chung `define` của vite.config.ts nên hằng số build có giá trị thật ở đây.
describe('versionLabel', () => {
  it('có dạng "vX.Y.Z (hash)"', () => {
    expect(versionLabel()).toMatch(/^v\d+\.\d+\.\d+ \([0-9a-z]+\)$/);
  });
});
