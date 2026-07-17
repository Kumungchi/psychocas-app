import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { offerScope, offerStatus } from "./schema";
import { requireActiveMember, requireCapability, type ResourceScope } from "./authz";
import { getDefaultOrganization } from "./organization";

function targetScope(
  organizationId: Id<"organizations">,
  scope: "national" | "local",
  branchId: Id<"branches"> | undefined,
): ResourceScope {
  if (scope === "local" && !branchId) throw new ConvexError("branch_required");
  if (scope === "national" && branchId) throw new ConvexError("branch_not_allowed");
  return { organizationId, branchId };
}

function isPublished(offer: Doc<"offers">): boolean {
  return offer.status === "published" || offer.status === "active";
}

function isCurrentlyValid(offer: Doc<"offers">, now = Date.now()): boolean {
  return (
    isPublished(offer) &&
    (!offer.validFrom || offer.validFrom <= now) &&
    (!offer.validUntil || offer.validUntil >= now)
  );
}

async function presentOffer(ctx: QueryCtx | MutationCtx, offer: Doc<"offers">) {
  const partner = await ctx.db.get(offer.partnerId);
  if (!partner) return null;
  return {
    id: offer._id,
    title: offer.title,
    value: offer.value,
    description: offer.description ?? null,
    redemptionInstructions: offer.redemptionInstructions ?? null,
    terms: offer.terms ?? null,
    scope: offer.scope,
    branchId: offer.branchId ?? null,
    status: offer.status,
    validFrom: offer.validFrom ?? null,
    validUntil: offer.validUntil ?? null,
    partner: {
      id: partner._id,
      name: partner.name,
      category: partner.category,
      website: partner.website ?? null,
      description: partner.description ?? null,
      address: partner.address ?? null,
    },
    lastVerifiedAt: offer.lastVerifiedAt ?? null,
    updatedAt: offer.updatedAt,
  };
}

export const listForViewer = query({
  args: {},
  handler: async (ctx) => {
    const [member, organization] = await Promise.all([
      requireActiveMember(ctx),
      getDefaultOrganization(ctx),
    ]);
    const rows = await ctx.db
      .query("offers")
      .withIndex("by_organization_status", (q) => q.eq("organizationId", organization._id))
      .take(500);
    const visible = rows.filter(
      (offer) =>
        isCurrentlyValid(offer) &&
        (offer.scope === "national" || (member.branchId && offer.branchId === member.branchId)),
    );
    const presented = await Promise.all(visible.map((offer) => presentOffer(ctx, offer)));
    const favorites = await ctx.db
      .query("offerFavorites")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .take(500);
    const favoriteIds = new Set(favorites.map((favorite) => favorite.offerId));
    return presented
      .filter((offer): offer is NonNullable<typeof offer> => Boolean(offer))
      .filter((offer) => offer.partner)
      .map((offer) => ({ ...offer, favorite: favoriteIds.has(offer.id) }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const listForManagement = query({
  args: {
    scope: offerScope,
    branchId: v.optional(v.id("branches")),
    status: v.optional(offerStatus),
  },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const target = targetScope(organization._id, args.scope, args.branchId);
    await requireCapability(ctx, "offer.draft", target);
    const rows = args.status
      ? await ctx.db
          .query("offers")
          .withIndex("by_organization_branch_status", (q) =>
            q
              .eq("organizationId", organization._id)
              .eq("branchId", args.branchId)
              .eq("status", args.status!),
          )
          .take(500)
      : await ctx.db
          .query("offers")
          .withIndex("by_organization_status", (q) => q.eq("organizationId", organization._id))
          .take(500);
    const presented = await Promise.all(
      rows.filter((offer) => offer.scope === args.scope && offer.branchId === args.branchId).map((offer) => presentOffer(ctx, offer)),
    );
    return presented.filter((offer): offer is NonNullable<typeof offer> => Boolean(offer));
  },
});

export const upsertDraft = mutation({
  args: {
    id: v.optional(v.id("offers")),
    partnerId: v.id("partners"),
    title: v.string(),
    value: v.string(),
    description: v.optional(v.string()),
    redemptionInstructions: v.optional(v.string()),
    terms: v.optional(v.string()),
    scope: offerScope,
    branchId: v.optional(v.id("branches")),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const target = targetScope(organization._id, args.scope, args.branchId);
    const actor = await requireCapability(ctx, "offer.draft", target);
    const partner = await ctx.db.get(args.partnerId);
    if (!partner?.active || (partner.organizationId && partner.organizationId !== organization._id)) {
      throw new ConvexError("partner_not_found");
    }
    if (partner.branchId && partner.branchId !== args.branchId) {
      throw new ConvexError("partner_scope_mismatch");
    }
    const title = args.title.trim();
    const value = args.value.trim();
    if (title.length < 2 || title.length > 140) throw new ConvexError("invalid_offer_title");
    if (!value || value.length > 80) throw new ConvexError("invalid_offer_value");
    if (args.description && args.description.length > 2000) throw new ConvexError("offer_description_too_long");
    if (args.redemptionInstructions && args.redemptionInstructions.length > 1000) {
      throw new ConvexError("offer_instructions_too_long");
    }
    if (args.terms && args.terms.length > 2000) throw new ConvexError("offer_terms_too_long");
    if (args.validFrom && args.validUntil && args.validFrom >= args.validUntil) {
      throw new ConvexError("invalid_offer_dates");
    }

    const now = Date.now();
    const payload = {
      organizationId: organization._id,
      partnerId: args.partnerId,
      title,
      value,
      description: args.description?.trim() || undefined,
      redemptionInstructions: args.redemptionInstructions?.trim() || undefined,
      terms: args.terms?.trim() || undefined,
      scope: args.scope,
      branchId: args.branchId,
      validFrom: args.validFrom,
      validUntil: args.validUntil,
      status: "draft" as const,
      updatedBy: actor._id,
      updatedAt: now,
    };

    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new ConvexError("offer_not_found");
      await requireCapability(ctx, "offer.draft", {
        organizationId: existing.organizationId ?? organization._id,
        branchId: existing.branchId,
      });
      await ctx.db.patch(args.id, payload);
      await ctx.db.insert("auditLogs", {
        actorMemberId: actor._id,
        action: "offer.updateDraft",
        entityType: "offer",
        entityId: args.id,
        before: { title: existing.title, value: existing.value, status: existing.status, branchId: existing.branchId },
        after: { title, value, status: "draft", branchId: args.branchId },
        createdAt: now,
      });
      return { status: "updated" as const, id: args.id };
    }

    const id = await ctx.db.insert("offers", {
      ...payload,
      createdBy: actor._id,
      createdAt: now,
    });
    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: "offer.createDraft",
      entityType: "offer",
      entityId: id,
      after: { title, value, status: "draft", branchId: args.branchId },
      createdAt: now,
    });
    return { status: "created" as const, id };
  },
});

export const submitForApproval = mutation({
  args: { id: v.id("offers") },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const offer = await ctx.db.get(args.id);
    if (!offer) throw new ConvexError("offer_not_found");
    const actor = await requireCapability(ctx, "offer.draft", {
      organizationId: offer.organizationId ?? organization._id,
      branchId: offer.branchId,
    });
    if (offer.status !== "draft" && offer.status !== "paused") {
      throw new ConvexError("offer_not_submittable");
    }
    const now = Date.now();
    await ctx.db.patch(args.id, { status: "pending_approval", updatedBy: actor._id, updatedAt: now });
    const approvalId = await ctx.db.insert("approvalRequests", {
      organizationId: offer.organizationId ?? organization._id,
      branchId: offer.branchId,
      entityType: "offer",
      entityId: args.id,
      requestedAction: "publish",
      status: "pending",
      requestedBy: actor._id,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: "offer.submitForApproval",
      entityType: "offer",
      entityId: args.id,
      before: { status: offer.status },
      after: { status: "pending_approval", approvalId },
      createdAt: now,
    });
    return { status: "submitted" as const, approvalId };
  },
});

export const review = mutation({
  args: {
    id: v.id("offers"),
    approve: v.boolean(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const offer = await ctx.db.get(args.id);
    if (!offer) throw new ConvexError("offer_not_found");
    const actor = await requireCapability(ctx, "offer.publish", {
      organizationId: offer.organizationId ?? organization._id,
      branchId: offer.branchId,
    });
    if (offer.status !== "pending_approval") throw new ConvexError("offer_not_pending");
    const approval = await ctx.db
      .query("approvalRequests")
      .withIndex("by_entity", (q) => q.eq("entityType", "offer").eq("entityId", args.id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
    if (!approval) throw new ConvexError("approval_not_found");
    const now = Date.now();
    const status = args.approve ? ("published" as const) : ("draft" as const);
    await ctx.db.patch(args.id, {
      status,
      updatedBy: actor._id,
      updatedAt: now,
      ...(args.approve ? { lastVerifiedAt: now } : {}),
    });
    await ctx.db.patch(approval._id, {
      status: args.approve ? "approved" : "rejected",
      reviewedBy: actor._id,
      reviewerComment: args.comment?.trim() || undefined,
      reviewedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: args.approve ? "offer.approve" : "offer.reject",
      entityType: "offer",
      entityId: args.id,
      before: { status: offer.status },
      after: { status },
      summary: args.comment?.trim() || undefined,
      createdAt: now,
    });
    return { status };
  },
});

export const setPaused = mutation({
  args: { id: v.id("offers"), paused: v.boolean() },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const offer = await ctx.db.get(args.id);
    if (!offer) throw new ConvexError("offer_not_found");
    const actor = await requireCapability(ctx, "offer.publish", {
      organizationId: offer.organizationId ?? organization._id,
      branchId: offer.branchId,
    });
    if (!args.paused && offer.status !== "paused") throw new ConvexError("offer_not_paused");
    if (args.paused && !isPublished(offer)) throw new ConvexError("offer_not_published");
    const status = args.paused ? ("paused" as const) : ("published" as const);
    const now = Date.now();
    await ctx.db.patch(args.id, { status, updatedBy: actor._id, updatedAt: now });
    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: args.paused ? "offer.pause" : "offer.resume",
      entityType: "offer",
      entityId: args.id,
      before: { status: offer.status },
      after: { status },
      createdAt: now,
    });
    return { status };
  },
});
