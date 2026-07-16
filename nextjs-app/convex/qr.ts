import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { effectiveAccessStatus } from "./access";
import { requireActiveMember } from "./authz";

const TOKEN_TTL_MS = 3 * 60 * 1000;

type AnalyticsIncrement = Partial<
  Pick<
    Doc<"analyticsDaily">,
    | "generatedCount"
    | "scannedCount"
    | "validCount"
    | "expiredCount"
    | "duplicateScanCount"
    | "rejectedCount"
  >
>;

function dateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function offerIsUsable(offer: Doc<"offers">, now: number): boolean {
  return (
    (offer.status === "published" || offer.status === "active") &&
    (!offer.validFrom || offer.validFrom <= now) &&
    (!offer.validUntil || offer.validUntil >= now)
  );
}

async function incrementAnalytics(
  ctx: MutationCtx,
  input: {
    timestamp: number;
    branchId?: Id<"branches">;
    partnerId: Id<"partners">;
    offerId: Id<"offers">;
    increment: AnalyticsIncrement;
  },
) {
  const key = dateKey(input.timestamp);
  const existing = await ctx.db
    .query("analyticsDaily")
    .withIndex("by_offer_date", (q) => q.eq("offerId", input.offerId).eq("dateKey", key))
    .filter((q) => q.eq(q.field("branchId"), input.branchId))
    .first();
  const add = (field: keyof AnalyticsIncrement, current: number) =>
    current + (input.increment[field] ?? 0);

  if (existing) {
    await ctx.db.patch(existing._id, {
      generatedCount: add("generatedCount", existing.generatedCount),
      scannedCount: add("scannedCount", existing.scannedCount),
      validCount: add("validCount", existing.validCount),
      expiredCount: add("expiredCount", existing.expiredCount),
      duplicateScanCount: add("duplicateScanCount", existing.duplicateScanCount),
      rejectedCount: add("rejectedCount", existing.rejectedCount ?? 0),
      updatedAt: input.timestamp,
    });
    return;
  }

  await ctx.db.insert("analyticsDaily", {
    dateKey: key,
    branchId: input.branchId,
    partnerId: input.partnerId,
    offerId: input.offerId,
    generatedCount: input.increment.generatedCount ?? 0,
    scannedCount: input.increment.scannedCount ?? 0,
    validCount: input.increment.validCount ?? 0,
    expiredCount: input.increment.expiredCount ?? 0,
    duplicateScanCount: input.increment.duplicateScanCount ?? 0,
    rejectedCount: input.increment.rejectedCount ?? 0,
    updatedAt: input.timestamp,
  });
}

export const issueInternal = internalMutation({
  args: {
    offerId: v.id("offers"),
    publicHash: v.string(),
    shortCodeHash: v.string(),
  },
  handler: async (ctx, args) => {
    const member = await requireActiveMember(ctx);
    const offer = await ctx.db.get(args.offerId);
    const now = Date.now();
    if (!offer || !offerIsUsable(offer, now)) throw new ConvexError("offer_not_available");
    if (offer.scope === "local" && (!member.branchId || offer.branchId !== member.branchId)) {
      throw new ConvexError("offer_not_available");
    }
    const partner = await ctx.db.get(offer.partnerId);
    if (!partner?.active) throw new ConvexError("offer_not_available");

    const existing = await ctx.db
      .query("tokens")
      .withIndex("by_member_status_expiresAt", (q) =>
        q.eq("memberId", member._id).eq("status", "active"),
      )
      .take(20);
    for (const token of existing) {
      await ctx.db.patch(token._id, {
        status: token.expiresAt <= now ? "expired" : "revoked",
        revokedAt: token.expiresAt > now ? now : undefined,
        updatedAt: now,
      });
    }

    const expiresAt = now + TOKEN_TTL_MS;
    const tokenId = await ctx.db.insert("tokens", {
      memberId: member._id,
      offerId: offer._id,
      publicHash: args.publicHash,
      shortCodeHash: args.shortCodeHash,
      status: "active",
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("tokenEvents", {
      tokenId,
      eventType: "created",
      createdAt: now,
    });
    await incrementAnalytics(ctx, {
      timestamp: now,
      branchId: offer.branchId ?? member.branchId,
      partnerId: partner._id,
      offerId: offer._id,
      increment: { generatedCount: 1 },
    });
    return {
      tokenId,
      expiresAt,
      offer: { id: offer._id, title: offer.title, value: offer.value },
      partner: { id: partner._id, name: partner.name },
    };
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const member = await requireActiveMember(ctx);
    const token = await ctx.db
      .query("tokens")
      .withIndex("by_member_status_expiresAt", (q) =>
        q.eq("memberId", member._id).eq("status", "active").gt("expiresAt", Date.now()),
      )
      .order("desc")
      .first();
    if (!token) return null;
    const offer = await ctx.db.get(token.offerId);
    return offer
      ? { tokenId: token._id, offerId: offer._id, offerTitle: offer.title, expiresAt: token.expiresAt }
      : null;
  },
});

export const statusForMember = query({
  args: { tokenId: v.id("tokens") },
  handler: async (ctx, args) => {
    const member = await requireActiveMember(ctx);
    const token = await ctx.db.get(args.tokenId);
    if (!token || token.memberId !== member._id) return null;

    return {
      status: token.status,
      expiresAt: token.expiresAt,
      scannedAt: token.scannedAt ?? null,
      redeemedAt: token.redeemedAt ?? null,
      revokedAt: token.revokedAt ?? null,
    };
  },
});

export const revoke = mutation({
  args: { tokenId: v.id("tokens") },
  handler: async (ctx, args) => {
    const member = await requireActiveMember(ctx);
    const token = await ctx.db.get(args.tokenId);
    if (!token || token.memberId !== member._id) throw new ConvexError("token_not_found");
    if (token.status !== "active") return { status: token.status };
    const now = Date.now();
    await ctx.db.patch(token._id, { status: "revoked", revokedAt: now, updatedAt: now });
    return { status: "revoked" as const };
  },
});

export const validatePublic = internalMutation({
  args: {
    publicHash: v.optional(v.string()),
    shortCodeHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const token = args.publicHash
      ? await ctx.db
          .query("tokens")
          .withIndex("by_publicHash", (q) => q.eq("publicHash", args.publicHash!))
          .unique()
      : args.shortCodeHash
        ? await ctx.db
            .query("tokens")
            .withIndex("by_shortCodeHash", (q) => q.eq("shortCodeHash", args.shortCodeHash!))
            .unique()
        : null;
    if (!token) return { status: "invalid" as const, checkedAt: Date.now() };

    const now = Date.now();
    const [offer, member] = await Promise.all([
      ctx.db.get(token.offerId),
      ctx.db.get(token.memberId),
    ]);
    const partner = offer ? await ctx.db.get(offer.partnerId) : null;
    const publicOffer = offer && partner
      ? { offerTitle: offer.title, offerValue: offer.value, partnerName: partner.name }
      : {};
    await ctx.db.insert("tokenEvents", { tokenId: token._id, eventType: "public_scan", createdAt: now });

    if (!offer || !partner || !member) {
      return { status: "invalid" as const, checkedAt: now };
    }
    const branchId = offer.branchId ?? member.branchId;

    if (token.status === "redeemed") {
      await ctx.db.insert("tokenEvents", {
        tokenId: token._id,
        eventType: "duplicate_scan",
        result: "already_validated",
        createdAt: now,
      });
      await incrementAnalytics(ctx, {
        timestamp: now,
        branchId,
        partnerId: partner._id,
        offerId: offer._id,
        increment: { scannedCount: 1, duplicateScanCount: 1 },
      });
      return {
        status: "already_validated" as const,
        checkedAt: now,
        validatedAt: token.redeemedAt ?? token.scannedAt ?? now,
        ...publicOffer,
      };
    }

    if (token.status === "revoked") {
      await ctx.db.insert("tokenEvents", {
        tokenId: token._id,
        eventType: "revoked_result",
        createdAt: now,
      });
      await incrementAnalytics(ctx, {
        timestamp: now,
        branchId,
        partnerId: partner._id,
        offerId: offer._id,
        increment: { scannedCount: 1, rejectedCount: 1 },
      });
      return { status: "revoked" as const, checkedAt: now, ...publicOffer };
    }

    if (token.status !== "active" || token.expiresAt <= now) {
      if (token.status === "active") await ctx.db.patch(token._id, { status: "expired", updatedAt: now });
      await ctx.db.insert("tokenEvents", {
        tokenId: token._id,
        eventType: "expired_result",
        createdAt: now,
      });
      await incrementAnalytics(ctx, {
        timestamp: now,
        branchId,
        partnerId: partner._id,
        offerId: offer._id,
        increment: { scannedCount: 1, expiredCount: 1 },
      });
      return { status: "expired" as const, checkedAt: now, ...publicOffer };
    }

    const grant = member.accessGrantId ? await ctx.db.get(member.accessGrantId) : null;
    const membershipActive =
      grant && effectiveAccessStatus(grant.status, grant.membershipUntil, now) === "active";
    if (!membershipActive || !offerIsUsable(offer, now) || !partner.active) {
      await ctx.db.patch(token._id, { status: "revoked", revokedAt: now, updatedAt: now });
      await ctx.db.insert("tokenEvents", {
        tokenId: token._id,
        eventType: "revoked_result",
        result: "membership_or_offer_inactive",
        createdAt: now,
      });
      await incrementAnalytics(ctx, {
        timestamp: now,
        branchId,
        partnerId: partner._id,
        offerId: offer._id,
        increment: { scannedCount: 1, rejectedCount: 1 },
      });
      return { status: "invalid" as const, checkedAt: now, ...publicOffer };
    }

    await ctx.db.patch(token._id, {
      status: "redeemed",
      scannedAt: now,
      redeemedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("tokenEvents", {
      tokenId: token._id,
      eventType: "valid_result",
      result: "valid_first_scan",
      createdAt: now,
    });
    await incrementAnalytics(ctx, {
      timestamp: now,
      branchId,
      partnerId: partner._id,
      offerId: offer._id,
      increment: { scannedCount: 1, validCount: 1 },
    });
    return {
      status: "valid" as const,
      checkedAt: now,
      validatedAt: now,
      ...publicOffer,
    };
  },
});
