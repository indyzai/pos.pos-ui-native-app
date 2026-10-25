import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, mock, test } from 'bun:test';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
mock.module('react-native', () => ({ Text: 'Text', View: 'View' }));
mock.module('react-native-svg', () => ({ default: 'Svg', Rect: 'Rect' }));
const { BarcodeLabelPreview } = await import(
  '../../../../../vendor/pos-ui-shared/packages-native/ui-native/src/components/BarcodeLabelPreview'
);
test('label preview renders real black barcode bars on white paper in any app theme', async () => {
  let view;
  await act(async () => {
    view = create(
      <BarcodeLabelPreview
        document={{ kind: 'barcode', title: 'Item', lines: ['INR 10.00'], barcode: '12345' }}
      />,
    );
  });
  expect(view.root.findAllByType('View')[0].props.style.backgroundColor).toBe('#ffffff');
  expect(
    view.root.findAllByType('Rect').filter((node) => node.props.fill === '#000000').length,
  ).toBeGreaterThan(10);
  expect(view.root.findAllByType('Text').some((node) => node.props.children === '12345')).toBe(true);
  await act(async () => view.unmount());
});
