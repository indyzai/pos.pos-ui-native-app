import { expect, test } from 'bun:test';
import {
  restaurantModifiers,
  toggleRestaurantModifier,
} from '../../../src/features/billing/domain/restaurantModifiers';

const modifiers = [
  { id: 'small', label: 'Small', group: 'size', price: 0, singleSelect: true },
  { id: 'large', label: 'Large', group: 'size', price: 20, singleSelect: true },
  { id: 'cheese', label: 'Cheese', group: 'addon', price: 10 },
];

test('uses configured modifiers and rejects invalid or duplicate records', () => {
  expect(restaurantModifiers({ modifiers: [...modifiers, modifiers[0], { id: '', label: '' }] })).toEqual(
    modifiers,
  );
  expect(restaurantModifiers(undefined)).toEqual([]);
});

test('single-select groups replace their previous selection', () => {
  expect(toggleRestaurantModifier(['small', 'cheese'], modifiers[1], modifiers)).toEqual(['cheese', 'large']);
  expect(toggleRestaurantModifier(['cheese'], modifiers[2], modifiers)).toEqual([]);
});
