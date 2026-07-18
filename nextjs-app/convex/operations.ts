import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireCapability } from "./authz";

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_FRESHNESS_MS = 2 * DAY_MS;
const ACCESS_WARNING_WINDOW_MS = 14 * DAY_MS;
const DELIVERY_FAILURE_WINDOW_MS = DAY_MS;
const DELIVERY_OVERDUE_MS = 15 * 60 * 1000;

export const publicHealth = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const latestRetention = await ctx.db
      .query("retentionRuns")
      .withIndex("by_finishedAt")
      .order("desc")
      .first();
    const retentionStatus = !latestRetention
      ? "missing"
      : now - latestRetention.finishedAt <= RETENTION_FRESHNESS_MS
        ? "fresh"
        : "stale";

    return {
      status: "ok" as const,
      serverTime: now,
      checks: {
        database: "ok" as const,
        retention: retentionStatus,
      },
    };
  },
});

export const dashboard = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireCapability(ctx, "audit.read", { organizationId: args.organizationId });
    const now = Date.now();
    const warningUntil = now + ACCESS_WARNING_WINDOW_MS;
    const [expiredGrants, expiringGrants, assignments, failedDeliveries, overdueDeliveries, latestRetention] =
      await Promise.all([
        ctx.db
          .query("accessGrants")
          .withIndex("by_status_membershipUntil", (q) =>
            q.eq("status", "active").lte("membershipUntil", now),
          )
          .take(500),
        ctx.db
          .query("accessGrants")
          .withIndex("by_status_membershipUntil", (q) =>
            q
              .eq("status", "active")
              .gt("membershipUntil", now)
              .lte("membershipUntil", warningUntil),
          )
          .take(500),
        ctx.db
          .query("staffAssignments")
          .withIndex("by_organization_status", (q) =>
            q.eq("organizationId", args.organizationId).eq("status", "active"),
          )
          .take(500),
        ctx.db
          .query("deliveryJobs")
          .withIndex("by_status_scheduledFor", (q) =>
            q.eq("status", "failed").gt("scheduledFor", now - DELIVERY_FAILURE_WINDOW_MS),
          )
          .take(500),
        ctx.db
          .query("deliveryJobs")
          .withIndex("by_status_scheduledFor", (q) =>
            q.eq("status", "pending").lt("scheduledFor", now - DELIVERY_OVERDUE_MS),
          )
          .take(500),
        ctx.db.query("retentionRuns").withIndex("by_finishedAt").order("desc").first(),
      ]);

    const expiringAssignments = assignments.filter(
      (assignment) =>
        assignment.validUntil !== undefined &&
        assignment.validUntil > now &&
        assignment.validUntil <= warningUntil,
    );

    return {
      generatedAt: now,
      access: {
        expiredCount: expiredGrants.length,
        expiringWithin14DaysCount: expiringGrants.length,
        assignmentsExpiringWithin14DaysCount: expiringAssignments.length,
      },
      delivery: {
        failedLast24HoursCount: failedDeliveries.length,
        overdueCount: overdueDeliveries.length,
      },
      retention: {
        status: !latestRetention
          ? ("missing" as const)
          : now - latestRetention.finishedAt <= RETENTION_FRESHNESS_MS
            ? ("fresh" as const)
            : ("stale" as const),
        lastFinishedAt: latestRetention?.finishedAt ?? null,
      },
    };
  },
});
