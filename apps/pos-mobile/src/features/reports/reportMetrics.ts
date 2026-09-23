import { buildReportMetrics as buildSharedReportMetrics, scopeReportOrders, type ReportPeriod } from '@indyzai/feature-reports';
export type { ReportPeriod };
export { scopeReportOrders };
export function buildReportMetrics(...args: Parameters<typeof buildSharedReportMetrics>) {
    return buildSharedReportMetrics(args[0], args[1], args[2], args[3], {
        ...args[4],
        refundScope: 'visible-sales',
    });
}
