export interface QrAnalyticsRow {
  dateKey: string;
  generatedCount: number;
  scannedCount: number;
  validCount: number;
  expiredCount: number;
  duplicateScanCount: number;
  rejectedCount?: number;
}

export interface QrAnalyticsTotals {
  generated: number;
  scanned: number;
  valid: number;
  expired: number;
  duplicate: number;
  rejected: number;
}

export function aggregateQrAnalytics(rows: QrAnalyticsRow[]) {
  const totals = rows.reduce<QrAnalyticsTotals>(
    (result, row) => ({
      generated: result.generated + row.generatedCount,
      scanned: result.scanned + row.scannedCount,
      valid: result.valid + row.validCount,
      expired: result.expired + row.expiredCount,
      duplicate: result.duplicate + row.duplicateScanCount,
      rejected: result.rejected + (row.rejectedCount ?? 0),
    }),
    { generated: 0, scanned: 0, valid: 0, expired: 0, duplicate: 0, rejected: 0 },
  );

  const daily = Array.from(
    rows
      .reduce((map, row) => {
        const current = map.get(row.dateKey) ?? {
          dateKey: row.dateKey,
          generated: 0,
          scanned: 0,
          valid: 0,
          expired: 0,
          duplicate: 0,
          rejected: 0,
        };
        current.generated += row.generatedCount;
        current.scanned += row.scannedCount;
        current.valid += row.validCount;
        current.expired += row.expiredCount;
        current.duplicate += row.duplicateScanCount;
        current.rejected += row.rejectedCount ?? 0;
        map.set(row.dateKey, current);
        return map;
      }, new Map<string, QrAnalyticsTotals & { dateKey: string }>())
      .values(),
  ).sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  return {
    totals,
    validationRate: totals.scanned > 0 ? totals.valid / totals.scanned : 0,
    redemptionRate: totals.generated > 0 ? totals.valid / totals.generated : 0,
    daily,
  };
}
