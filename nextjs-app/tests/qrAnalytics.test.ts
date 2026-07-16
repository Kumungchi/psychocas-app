import { describe, expect, it } from 'vitest';
import { aggregateQrAnalytics } from '../convex/analyticsModel';

describe('QR analytics aggregation', () => {
  it('combines daily scan outcomes and computes distinct rates', () => {
    const result = aggregateQrAnalytics([
      {
        dateKey: '2026-07-15',
        generatedCount: 10,
        scannedCount: 7,
        validCount: 5,
        expiredCount: 1,
        duplicateScanCount: 1,
        rejectedCount: 0,
      },
      {
        dateKey: '2026-07-15',
        generatedCount: 2,
        scannedCount: 2,
        validCount: 1,
        expiredCount: 0,
        duplicateScanCount: 0,
        rejectedCount: 1,
      },
    ]);

    expect(result.totals).toEqual({
      generated: 12,
      scanned: 9,
      valid: 6,
      expired: 1,
      duplicate: 1,
      rejected: 1,
    });
    expect(result.validationRate).toBeCloseTo(6 / 9);
    expect(result.redemptionRate).toBe(0.5);
    expect(result.daily).toEqual([
      {
        dateKey: '2026-07-15',
        generated: 12,
        scanned: 9,
        valid: 6,
        expired: 1,
        duplicate: 1,
        rejected: 1,
      },
    ]);
  });

  it('keeps historical rows without rejectedCount compatible', () => {
    const result = aggregateQrAnalytics([
      {
        dateKey: '2026-07-14',
        generatedCount: 1,
        scannedCount: 0,
        validCount: 0,
        expiredCount: 0,
        duplicateScanCount: 0,
      },
    ]);

    expect(result.totals.rejected).toBe(0);
    expect(result.validationRate).toBe(0);
    expect(result.redemptionRate).toBe(0);
  });
});
