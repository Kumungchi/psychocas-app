import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireActiveMember, requireCapability, type ResourceScope } from "./authz";
import { getDefaultOrganization } from "./organization";
import { offerIssueReason, offerIssueStatus, redemptionExperience } from "./schema";

function managementScope(
  organizationId: Id<"organizations">,
  scope: "national" | "local",
  branchId: Id<"branches"> | undefined,
): ResourceScope {
  if (scope === "local" && !branchId) throw new ConvexError("branch_required");
  if (scope === "national" && branchId) throw new ConvexError("branch_not_allowed");
  return { organizationId, branchId };
}

function offerVisibleToMember(offer: Doc<"offers">, member: Doc<"members">): boolean {
  return offer.scope === "national" || Boolean(member.branchId && offer.branchId === member.branchId);
}

export const setFavorite = mutation({
  args: { offerId: v.id("offers"), favorite: v.boolean() },
  handler: async (ctx, args) => {
    const member = await requireActiveMember(ctx);
    const existing = await ctx.db
      .query("offerFavorites")
      .withIndex("by_member_offer", (q) => q.eq("memberId", member._id).eq("offerId", args.offerId))
      .unique();

    if (!args.favorite) {
      if (existing) await ctx.db.delete(existing._id);
      return { favorite: false as const };
    }
    if (existing) return { favorite: true as const };

    const offer = await ctx.db.get(args.offerId);
    const now = Date.now();
    if (
      !offer ||
      !offerVisibleToMember(offer, member) ||
      (offer.status !== "published" && offer.status !== "active") ||
      Boolean(offer.validFrom && offer.validFrom > now) ||
      Boolean(offer.validUntil && offer.validUntil < now)
    ) {
      throw new ConvexError("offer_not_available");
    }
    await ctx.db.insert("offerFavorites", { memberId: member._id, offerId: offer._id, createdAt: now });
    return { favorite: true as const };
  },
});

export const submitIssueReport = mutation({
  args: {
    offerId: v.id("offers"),
    reason: offerIssueReason,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const [member, organization] = await Promise.all([
      requireActiveMember(ctx),
      getDefaultOrganization(ctx),
    ]);
    const offer = await ctx.db.get(args.offerId);
    if (
      !offer ||
      (offer.organizationId && offer.organizationId !== organization._id) ||
      !offerVisibleToMember(offer, member)
    ) {
      throw new ConvexError("offer_not_available");
    }
    const note = args.note?.trim();
    if (note && note.length > 500) throw new ConvexError("issue_note_too_long");
    const existing = await ctx.db
      .query("offerIssueReports")
      .withIndex("by_member_offer", (q) => q.eq("memberId", member._id).eq("offerId", offer._id))
      .filter((q) => q.neq(q.field("status"), "resolved"))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        reason: args.reason,
        note: note || undefined,
        status: "open",
        updatedAt: now,
      });
      return { status: "updated" as const, id: existing._id };
    }
    const id = await ctx.db.insert("offerIssueReports", {
      memberId: member._id,
      organizationId: offer.organizationId ?? organization._id,
      branchId: offer.branchId,
      offerId: offer._id,
      reason: args.reason,
      note: note || undefined,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
    return { status: "submitted" as const, id };
  },
});

export const submitRedemptionFeedback = mutation({
  args: { tokenId: v.id("tokens"), experience: redemptionExperience },
  handler: async (ctx, args) => {
    const [member, organization] = await Promise.all([
      requireActiveMember(ctx),
      getDefaultOrganization(ctx),
    ]);
    const token = await ctx.db.get(args.tokenId);
    if (!token || token.memberId !== member._id || token.status !== "redeemed") {
      throw new ConvexError("redemption_not_available");
    }
    const existing = await ctx.db
      .query("redemptionFeedback")
      .withIndex("by_token", (q) => q.eq("tokenId", token._id))
      .unique();
    if (existing) return { status: "already_submitted" as const, experience: existing.experience };
    const offer = await ctx.db.get(token.offerId);
    if (!offer) throw new ConvexError("offer_not_found");
    const id = await ctx.db.insert("redemptionFeedback", {
      memberId: member._id,
      tokenId: token._id,
      organizationId: offer.organizationId ?? organization._id,
      branchId: offer.branchId ?? member.branchId,
      offerId: offer._id,
      experience: args.experience,
      createdAt: Date.now(),
    });
    return { status: "submitted" as const, id };
  },
});

export const listIssueReports = query({
  args: {
    scope: v.union(v.literal("national"), v.literal("local")),
    branchId: v.optional(v.id("branches")),
    status: offerIssueStatus,
  },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const target = managementScope(organization._id, args.scope, args.branchId);
    await requireCapability(ctx, "offer.draft", target);
    const rows = args.scope === "local"
      ? await ctx.db
          .query("offerIssueReports")
          .withIndex("by_branch_status", (q) => q.eq("branchId", args.branchId).eq("status", args.status))
          .take(300)
      : await ctx.db
          .query("offerIssueReports")
          .withIndex("by_organization_status", (q) => q.eq("organizationId", organization._id).eq("status", args.status))
          .take(300);
    const scopedRows = args.scope === "national"
      ? rows
      : rows.filter((row) => row.branchId === args.branchId);
    const presented = await Promise.all(scopedRows.map(async (row) => {
      const offer = await ctx.db.get(row.offerId);
      const partner = offer ? await ctx.db.get(offer.partnerId) : null;
      return {
        id: row._id,
        offerId: row.offerId,
        offerTitle: offer?.title ?? "Neaktivní nabídka",
        partnerName: partner?.name ?? "Neaktivní partner",
        reason: row.reason,
        note: row.note ?? null,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    }));
    return presented.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const updateIssueStatus = mutation({
  args: { id: v.id("offerIssueReports"), status: offerIssueStatus },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const report = await ctx.db.get(args.id);
    if (!report) throw new ConvexError("issue_report_not_found");
    const actor = await requireCapability(ctx, "offer.draft", {
      organizationId: report.organizationId ?? organization._id,
      branchId: report.branchId,
    });
    const now = Date.now();
    await ctx.db.patch(report._id, {
      status: args.status,
      updatedAt: now,
      resolvedBy: args.status === "resolved" ? actor._id : undefined,
      resolvedAt: args.status === "resolved" ? now : undefined,
    });
    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: "offerIssue.updateStatus",
      entityType: "offerIssueReport",
      entityId: report._id,
      before: { status: report.status },
      after: { status: args.status },
      createdAt: now,
    });
    return { status: args.status };
  },
});

export const redemptionSummaryForManagement = query({
  args: {
    scope: v.union(v.literal("national"), v.literal("local")),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const target = managementScope(organization._id, args.scope, args.branchId);
    await requireCapability(ctx, "offer.draft", target);
    const rows = args.scope === "local"
      ? await ctx.db
          .query("redemptionFeedback")
          .withIndex("by_branch_createdAt", (q) => q.eq("branchId", args.branchId))
          .take(5000)
      : await ctx.db
          .query("redemptionFeedback")
          .withIndex("by_organization_createdAt", (q) => q.eq("organizationId", organization._id))
          .take(5000);
    const scopedRows = args.scope === "national"
      ? rows
      : rows.filter((row) => row.branchId === args.branchId);
    return scopedRows.reduce(
      (summary, row) => ({ ...summary, [row.experience]: summary[row.experience] + 1 }),
      { accepted: 0, not_accepted: 0, problem: 0 },
    );
  },
});
