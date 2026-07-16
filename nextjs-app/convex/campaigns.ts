import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { campaignStatus } from "./schema";
import { requireCapability } from "./authz";
import { getDefaultOrganization } from "./organization";

function scopeTarget(organizationId: Id<"organizations">, scope: "national" | "local", branchId?: Id<"branches">) {
  if (scope === "local" && !branchId) throw new ConvexError("branch_required");
  if (scope === "national" && branchId) throw new ConvexError("branch_not_allowed");
  return { organizationId, branchId };
}

export const listForManagement = query({
  args: {
    scope: v.union(v.literal("national"), v.literal("local")),
    branchId: v.optional(v.id("branches")),
    status: v.optional(campaignStatus),
  },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const target = scopeTarget(organization._id, args.scope, args.branchId);
    await requireCapability(ctx, "campaign.draft", target);
    const rows = args.status
      ? await ctx.db
          .query("campaigns")
          .withIndex("by_branch_status", (q) => q.eq("branchId", args.branchId).eq("status", args.status!))
          .take(300)
      : await ctx.db
          .query("campaigns")
          .withIndex("by_organization_status", (q) => q.eq("organizationId", organization._id))
          .take(500);
    return rows.filter((row) => row.branchId === args.branchId).sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const upsertDraft = mutation({
  args: {
    id: v.optional(v.id("campaigns")),
    scope: v.union(v.literal("national"), v.literal("local")),
    branchId: v.optional(v.id("branches")),
    title: v.string(),
    description: v.optional(v.string()),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const target = scopeTarget(organization._id, args.scope, args.branchId);
    const actor = await requireCapability(ctx, "campaign.draft", target);
    const title = args.title.trim();
    if (title.length < 2 || title.length > 140) throw new ConvexError("invalid_campaign_title");
    if (args.description && args.description.length > 2000) throw new ConvexError("campaign_description_too_long");
    if (args.validFrom && args.validUntil && args.validFrom >= args.validUntil) throw new ConvexError("invalid_campaign_dates");
    const now = Date.now();
    const payload = {
      organizationId: organization._id,
      branchId: args.branchId,
      title,
      description: args.description?.trim() || undefined,
      validFrom: args.validFrom,
      validUntil: args.validUntil,
      status: "draft" as const,
      updatedBy: actor._id,
      updatedAt: now,
    };
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new ConvexError("campaign_not_found");
      await requireCapability(ctx, "campaign.draft", {
        organizationId: existing.organizationId ?? organization._id,
        branchId: existing.branchId,
      });
      await ctx.db.patch(args.id, payload);
      await ctx.db.insert("auditLogs", {
        actorMemberId: actor._id,
        action: "campaign.updateDraft",
        entityType: "campaign",
        entityId: args.id,
        before: { title: existing.title, branchId: existing.branchId, status: existing.status },
        after: { title, branchId: args.branchId, status: "draft" },
        createdAt: now,
      });
      return { status: "updated" as const, id: args.id };
    }
    const id = await ctx.db.insert("campaigns", { ...payload, createdBy: actor._id, createdAt: now });
    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: "campaign.createDraft",
      entityType: "campaign",
      entityId: id,
      after: { title, branchId: args.branchId, status: "draft" },
      createdAt: now,
    });
    return { status: "created" as const, id };
  },
});

export const publish = mutation({
  args: { id: v.id("campaigns") },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const campaign = await ctx.db.get(args.id);
    if (!campaign) throw new ConvexError("campaign_not_found");
    const actor = await requireCapability(ctx, "campaign.send", {
      organizationId: campaign.organizationId ?? organization._id,
      branchId: campaign.branchId,
    });
    if (campaign.status !== "draft") throw new ConvexError("campaign_not_draft");
    const now = Date.now();
    const status = campaign.validFrom && campaign.validFrom > now ? ("scheduled" as const) : ("active" as const);
    await ctx.db.patch(args.id, { status, updatedBy: actor._id, updatedAt: now });
    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: "campaign.publish",
      entityType: "campaign",
      entityId: args.id,
      before: { status: campaign.status },
      after: { status },
      createdAt: now,
    });
    return { status };
  },
});

export const archive = mutation({
  args: { id: v.id("campaigns") },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const campaign = await ctx.db.get(args.id);
    if (!campaign) throw new ConvexError("campaign_not_found");
    const actor = await requireCapability(ctx, "campaign.send", {
      organizationId: campaign.organizationId ?? organization._id,
      branchId: campaign.branchId,
    });
    const now = Date.now();
    await ctx.db.patch(args.id, { status: "archived", updatedBy: actor._id, updatedAt: now });
    return { status: "archived" as const };
  },
});
