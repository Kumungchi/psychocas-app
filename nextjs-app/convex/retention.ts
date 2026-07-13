import { internalMutation } from "./_generated/server";

const DAY_MS = 24 * 60 * 60 * 1000;

export const runOperationalCleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const startedAt = Date.now();
    const tokenEventCutoff = startedAt - 30 * DAY_MS;
    const tokenCutoff = startedAt - 31 * DAY_MS;
    const deliveryCutoff = startedAt - 90 * DAY_MS;
    const otpCutoff = startedAt - DAY_MS;
    let processedCount = 0;
    let deletedCount = 0;

    const oldTokenEvents = await ctx.db
      .query("tokenEvents")
      .filter((q) => q.lt(q.field("createdAt"), tokenEventCutoff))
      .take(5000);
    processedCount += oldTokenEvents.length;
    for (const event of oldTokenEvents) {
      await ctx.db.delete(event._id);
      deletedCount += 1;
    }

    for (const status of ["expired", "redeemed", "revoked"] as const) {
      const tokens = await ctx.db
        .query("tokens")
        .withIndex("by_status_expiresAt", (q) => q.eq("status", status).lt("expiresAt", tokenCutoff))
        .take(1000);
      processedCount += tokens.length;
      for (const token of tokens) {
        const recentEvent = await ctx.db
          .query("tokenEvents")
          .withIndex("by_token_createdAt", (q) => q.eq("tokenId", token._id))
          .first();
        if (recentEvent) continue;
        await ctx.db.delete(token._id);
        deletedCount += 1;
      }
    }

    const oldOtpLimits = await ctx.db
      .query("otpRequestLimits")
      .filter((q) => q.lt(q.field("updatedAt"), otpCutoff))
      .take(2000);
    processedCount += oldOtpLimits.length;
    for (const row of oldOtpLimits) {
      await ctx.db.delete(row._id);
      deletedCount += 1;
    }

    for (const status of ["sent", "failed", "cancelled"] as const) {
      const jobs = await ctx.db
        .query("deliveryJobs")
        .withIndex("by_status_scheduledFor", (q) =>
          q.eq("status", status).lt("scheduledFor", deliveryCutoff),
        )
        .take(2000);
      processedCount += jobs.length;
      for (const job of jobs) {
        await ctx.db.delete(job._id);
        deletedCount += 1;
      }
    }

    const finishedAt = Date.now();
    await ctx.db.insert("retentionRuns", {
      policy: "operational-v1",
      processedCount,
      deletedCount,
      anonymizedCount: 0,
      startedAt,
      finishedAt,
    });
    return { processedCount, deletedCount, finishedAt };
  },
});
