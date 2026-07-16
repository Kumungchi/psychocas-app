import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

async function seedQrFlow() {
  const t = convexTest(schema, modules);
  const now = Date.now();
  const seeded = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Psychočas",
      slug: "psychocas",
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    const userId = await ctx.db.insert("users", { email: "member@example.test" });
    const accessGrantId = await ctx.db.insert("accessGrants", {
      email: "member@example.test",
      fullName: "Test Member",
      role: "member",
      membershipUntil: now + 86_400_000,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const memberId = await ctx.db.insert("members", {
      userId,
      accessGrantId,
      email: "member@example.test",
      fullName: "Test Member",
      role: "member",
      membershipUntil: now + 86_400_000,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const otherUserId = await ctx.db.insert("users", { email: "other@example.test" });
    const otherAccessGrantId = await ctx.db.insert("accessGrants", {
      email: "other@example.test",
      fullName: "Other Member",
      role: "member",
      membershipUntil: now + 86_400_000,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("members", {
      userId: otherUserId,
      accessGrantId: otherAccessGrantId,
      email: "other@example.test",
      fullName: "Other Member",
      role: "member",
      membershipUntil: now + 86_400_000,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const partnerId = await ctx.db.insert("partners", {
      organizationId,
      name: "Test Partner",
      category: "service",
      active: true,
      createdBy: memberId,
      createdAt: now,
      updatedAt: now,
    });
    const offerId = await ctx.db.insert("offers", {
      organizationId,
      partnerId,
      title: "Pilot benefit",
      value: "20 %",
      scope: "national",
      status: "published",
      createdBy: memberId,
      createdAt: now,
      updatedAt: now,
    });

    return { userId, otherUserId, offerId };
  });

  return { t, ...seeded };
}

describe("member QR redemption flow", () => {
  it("moves an authenticated member token to redeemed after one public scan", async () => {
    const { t, userId, otherUserId, offerId } = await seedQrFlow();
    const asMember = t.withIdentity({ subject: userId });
    const asOtherMember = t.withIdentity({ subject: otherUserId });

    const issued = await asMember.mutation(internal.qr.issueInternal, {
      offerId,
      publicHash: "public-hash",
      shortCodeHash: "short-code-hash",
    });

    await expect(asMember.query(api.qr.statusForMember, { tokenId: issued.tokenId })).resolves.toMatchObject({
      status: "active",
      redeemedAt: null,
    });
    await expect(asOtherMember.query(api.qr.statusForMember, { tokenId: issued.tokenId })).resolves.toBeNull();

    const firstScan = await t.mutation(internal.qr.validatePublic, { publicHash: "public-hash" });
    expect(firstScan).toMatchObject({
      status: "valid",
      offerTitle: "Pilot benefit",
      offerValue: "20 %",
      partnerName: "Test Partner",
    });

    const memberStatus = await asMember.query(api.qr.statusForMember, { tokenId: issued.tokenId });
    expect(memberStatus).toMatchObject({ status: "redeemed" });
    expect(memberStatus?.redeemedAt).toBeTypeOf("number");

    const secondScan = await t.mutation(internal.qr.validatePublic, { publicHash: "public-hash" });
    expect(secondScan).toMatchObject({
      status: "already_validated",
      validatedAt: memberStatus?.redeemedAt,
    });

    const persisted = await t.run(async (ctx) => ({
      token: await ctx.db.get(issued.tokenId),
      events: await ctx.db
        .query("tokenEvents")
        .withIndex("by_token_createdAt", (q) => q.eq("tokenId", issued.tokenId))
        .collect(),
    }));
    expect(persisted.token?.status).toBe("redeemed");
    expect(persisted.events.map((event) => event.eventType)).toEqual([
      "created",
      "public_scan",
      "valid_result",
      "public_scan",
      "duplicate_scan",
    ]);
  });
});
