import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireCapability } from "./authz";
import { getDefaultOrganization } from "./organization";

export const summary = query({
  args: {
    scope: v.union(v.literal("national"), v.literal("local")),
    branchId: v.optional(v.id("branches")),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    if (args.scope === "local" && !args.branchId) throw new ConvexError("branch_required");
    if (args.scope === "national" && args.branchId) throw new ConvexError("branch_not_allowed");
    await requireCapability(ctx, "metrics.read", {
      organizationId: organization._id,
      branchId: args.branchId,
    });

    const rows = args.branchId
      ? await ctx.db
          .query("analyticsDaily")
          .withIndex("by_branch_date", (q) => q.eq("branchId", args.branchId))
          .take(1500)
      : await ctx.db.query("analyticsDaily").withIndex("by_date").take(3000);
    const filtered = rows.filter(
      (row) =>
        (!args.fromDate || row.dateKey >= args.fromDate) &&
        (!args.toDate || row.dateKey <= args.toDate),
    );
    const totals = filtered.reduce(
      (result, row) => ({
        generated: result.generated + row.generatedCount,
        scanned: result.scanned + row.scannedCount,
        valid: result.valid + row.validCount,
        expired: result.expired + row.expiredCount,
        duplicate: result.duplicate + row.duplicateScanCount,
      }),
      { generated: 0, scanned: 0, valid: 0, expired: 0, duplicate: 0 },
    );

    const byOffer = new Map<Id<"offers">, { generated: number; valid: number; scanned: number }>();
    for (const row of filtered) {
      if (!row.offerId) continue;
      const current = byOffer.get(row.offerId) ?? { generated: 0, valid: 0, scanned: 0 };
      current.generated += row.generatedCount;
      current.valid += row.validCount;
      current.scanned += row.scannedCount;
      byOffer.set(row.offerId, current);
    }
    const topEntries = Array.from(byOffer.entries())
      .sort((a, b) => b[1].valid - a[1].valid)
      .slice(0, 8);
    const topOffers = await Promise.all(
      topEntries.map(async ([offerId, counts]) => {
        const offer = await ctx.db.get(offerId);
        const partner = offer ? await ctx.db.get(offer.partnerId) : null;
        return offer && partner
          ? { offerId, title: offer.title, partnerName: partner.name, ...counts }
          : null;
      }),
    );

    return {
      totals,
      validationRate: totals.generated > 0 ? totals.valid / totals.generated : 0,
      topOffers: topOffers.filter((row): row is NonNullable<typeof row> => Boolean(row)),
      daily: Array.from(
        filtered
          .reduce((map, row) => {
          const current = map.get(row.dateKey) ?? { dateKey: row.dateKey, generated: 0, valid: 0 };
          current.generated += row.generatedCount;
          current.valid += row.validCount;
          map.set(row.dateKey, current);
          return map;
          }, new Map<string, { dateKey: string; generated: number; valid: number }>())
          .values(),
      ).sort((a, b) => a.dateKey.localeCompare(b.dateKey)),
    };
  },
});
