import { expect, test } from 'bun:test';
import {
  isBrandColor,
  readLaunchBrandColor,
  saveLaunchBrandColor,
} from '@indyzai/feature-organization/brandColorStorage';
import { mixHexColor } from '@indyzai/pos-ui-native/color';

test('saved brand colors are validated and restored for launch', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  });
  try {
    await saveLaunchBrandColor('pos', '#18a65c');
    expect(await readLaunchBrandColor('pos')).toBe('#18A65C');
    expect(isBrandColor('#18A65C')).toBe(true);
    expect(isBrandColor('red')).toBe(false);
    expect(saveLaunchBrandColor('pos', 'red')).rejects.toThrow('Invalid brand color');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('logo palette derives from the selected brand color', () => {
  expect(mixHexColor('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  expect(mixHexColor('#18A65C', '#FFFFFF', 0)).toBe('#18A65C');
});
