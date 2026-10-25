import { expect, test } from 'bun:test';
import { validateContact } from '@indyzai/pos-utils/contact-validation';

for (const type of ['CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'TECHNICIAN', 'SCRAP_VENDOR']) {
  test(`${type}: supplied five-digit phone blocks saving even without POS login`, () => {
    expect(validateContact({ name: 'Person', type, phone: '12345' }).phone).toBeDefined();
    expect(validateContact({ name: 'Person', type, phone: '9876543210' })).toEqual({});
    expect(validateContact({ name: 'Person', type })).toEqual({});
  });
}
test('phone accepts international numbers and rejects malformed or oversized input', () => {
  for (const phone of ['+919876543210', '1234567', '123456789012345'])
    expect(validateContact({ name: 'Person', type: 'EMPLOYEE', phone })).toEqual({});
  for (const phone of ['123456', '1234567890123456', '98765abcde', '++919876543210'])
    expect(validateContact({ name: 'Person', type: 'EMPLOYEE', phone }).phone).toBeDefined();
});
test('login requires one valid contact and a 4–8 digit PIN', () => {
  const input = { name: 'Person', type: 'EMPLOYEE', login: { pin: '1234' } };
  expect(validateContact(input).contact).toBeDefined();
  expect(validateContact({ ...input, email: 'person@external.com' })).toEqual({});
  expect(validateContact({ ...input, phone: '9876543210' })).toEqual({});
  expect(validateContact({ ...input, email: 'person@external.com', phone: '12345' }).phone).toBeDefined();
  expect(validateContact({ ...input, email: 'invalid' }).email).toBeDefined();
  for (const pin of ['', '123', '123456789', 'abcd'])
    expect(validateContact({ ...input, phone: '9876543210', login: { pin } }).pin).toBeDefined();
});
test('name, optional GSTIN and customer discounts have actionable errors', () => {
  expect(validateContact({ name: ' ', type: 'CUSTOMER' }).name).toBeDefined();
  expect(validateContact({ name: 'a'.repeat(151), type: 'CUSTOMER' }).name).toBeDefined();
  expect(validateContact({ name: 'Person', type: 'CUSTOMER', gstin: '12345' }).gstin).toBeDefined();
  expect(validateContact({ name: 'Person', type: 'CUSTOMER', gstin: '27AAPFU0939F1ZV' })).toEqual({});
  for (const discountPercent of ['-1', '101', 'abc', '0x10', Infinity])
    expect(validateContact({ name: 'Person', type: 'CUSTOMER', discountPercent }).discount).toBeDefined();
  for (const discountPercent of ['', '0', '10.5', '100'])
    expect(validateContact({ name: 'Person', type: 'CUSTOMER', discountPercent })).toEqual({});
  expect(validateContact({ name: 'Person', type: 'EMPLOYEE', discountPercent: 'invalid' })).toEqual({});
});
