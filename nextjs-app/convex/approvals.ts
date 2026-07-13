import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireCapability } from "./authz";
import { getDefaultOrganization } from "./organization";

export const list = query({
  args: {
    scope: v.union(v.literal("national"), v.literal("local")),
    branchId: v.optional(v.id("branches")),
    includeResolved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    if (args.scope === "local" && !args.branchId) throw new ConvexError("branch_required");
    if (args.scope === "national" && args.branchId) throw new ConvexError("branch_not_allowed");
    await requireCapability(ctx, "offer.publish", {
      organizationId: organization._id,
      branchId: args.branchId,
    });
    const rows = args.branchId
      ? await ctx.db
          .query("approvalRequests")
          .withIndex("by_branch_status", (q) => q.eq("branchId", args.branchId))
          .take(300)
      : await ctx.db
          .query("approvalRequests")
          .withIndex("by_organization_status", (q) => q.eq("organizationId", organization._id))
          .take(500);
    const scoped = rows.filter(
      (row) =>
        row.branchId === args.branchId && (args.includeResolved || row.status === "pending"),
    );
    return Promise.all(
      scoped.map(async (row) => {
        const requester = await ctx.db.get(row.requestedBy);
        const offer = row.entityType === "offer" ? await ctx.db.get(row.entityId as Id<"offers">) : null;
        return {
          id: row._id,
          entityType: row.entityType,
          entityId: row.entityId,
          requestedAction: row.requestedAction,
          status: row.status,
          requestedBy: requester?.fullName ?? "Psychočas",
          offer: offer ? { title: offer.title, value: offer.value } : null,
          reviewerComment: row.reviewerComment ?? null,
          createdAt: row.createdAt,
          reviewedAt: row.reviewedAt ?? null,
        };
      }),
    );
  },
});
