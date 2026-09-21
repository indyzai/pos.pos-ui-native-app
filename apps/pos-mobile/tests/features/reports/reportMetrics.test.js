import { describe, expect, it } from 'bun:test';
import { buildReportMetrics, scopeReportOrders } from '../../../src/features/reports/reportMetrics';

const sale = (id, session, amount = 100) => ({
  id,
  billId: `B-${id}`,
  counterSessionId: session,
  saleDate: '2026-09-13T10:00:00.000Z',
  status: 'COMPLETED',
  totalAmount: amount,
  taxAmount: 5,
  paymentMethod: 'CASH',
  items: [],
});

describe('POS reports', () => {
  it('limits cashiers to their active counter session', () => {
    const orders = [sale('1', 'session-a'), sale('2', 'session-b')];
    expect(scopeReportOrders(orders, false, 'session-a').map((order) => order.id)).toEqual(['1']);
    expect(scopeReportOrders(orders, false)).toEqual([]);
    expect(scopeReportOrders(orders, true)).toHaveLength(2);
  });

  it('calculates totals from only the supplied visible sales', () => {
    const metrics = buildReportMetrics(
      [sale('1', 'session-a', 125)],
      [],
      1,
      new Date('2026-09-13T12:00:00.000Z'),
    );
    expect(metrics.netRevenue).toBe(125);
    expect(metrics.orderCount).toBe(1);
    expect(metrics.taxTotal).toBe(5);
  });
});
