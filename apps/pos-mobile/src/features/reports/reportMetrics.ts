import { buildReportMetrics as buildSharedReportMetrics } from '@indyzai/feature-reports';
export { scopeReportOrders, type ReportPeriod } from '@indyzai/feature-reports';
export function buildReportMetrics(...args: Parameters<typeof buildSharedReportMetrics>) {
    return buildSharedReportMetrics(args[0], args[1], args[2], args[3], {
        ...args[4],
        refundScope: 'visible-sales',
    });
}
