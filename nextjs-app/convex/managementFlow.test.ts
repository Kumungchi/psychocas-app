import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

async function seedManagementFlow() {
  const t = convexTest(schema, modules);
  const now = Date.now();
  const ids = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Psychočas",
      slug: "psychocas",
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    const boardUserId = await ctx.db.insert("users", { email: "board@example.test" });
    const boardGrantId = await ctx.db.insert("accessGrants", {
      email: "board@example.test",
      fullName: "Test Board",
      role: "board",
      membershipUntil: now + 86_400_000,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("members", {
      userId: boardUserId,
      accessGrantId: boardGrantId,
      email: "board@example.test",
      fullName: "Test Board",
      role: "board",
      membershipUntil: now + 86_400_000,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const memberUserId = await ctx.db.insert("users", { email: "member@example.test" });
    const memberGrantId = await ctx.db.insert("accessGrants", {
      email: "member@example.test",
      fullName: "Test Member",
      role: "member",
      membershipUntil: now + 86_400_000,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const memberId = await ctx.db.insert("members", {
      userId: memberUserId,
      accessGrantId: memberGrantId,
      email: "member@example.test",
      fullName: "Test Member",
      role: "member",
      membershipUntil: now + 86_400_000,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    return { boardUserId, memberUserId, organizationId, memberId, memberGrantId };
  });

  return {
    t,
    asBoard: t.withIdentity({ subject: ids.boardUserId }),
    asMember: t.withIdentity({ subject: ids.memberUserId }),
    organizationId: ids.organizationId,
    memberId: ids.memberId,
    memberGrantId: ids.memberGrantId,
  };
}

describe("management editing flow", () => {
  it("creates, edits, publishes, and audits pilot management records", async () => {
    const { t, asBoard, organizationId, memberId, memberGrantId } = await seedManagementFlow();
    const now = Date.now();

    const branch = await asBoard.mutation(api.branches.create, { name: "Olomouc", city: "Olomouc" });
    await expect(asBoard.mutation(api.branches.setActive, { id: branch.id, active: false })).resolves.toMatchObject({ status: "updated" });
    await expect(asBoard.mutation(api.branches.setActive, { id: branch.id, active: true })).resolves.toMatchObject({ status: "updated" });

    const managedGrant = await asBoard.mutation(api.members.upsertAccessGrant, {
      email: "managed@example.test",
      fullName: "Managed Member",
      role: "member",
      branchId: branch.id,
      membershipUntil: now + 86_400_000,
      status: "active",
    });
    await expect(asBoard.mutation(api.members.upsertAccessGrant, {
      id: managedGrant.id,
      email: "managed@example.test",
      fullName: "Updated Member",
      role: "manager",
      branchId: branch.id,
      membershipUntil: now + 172_800_000,
      status: "active",
    })).resolves.toMatchObject({ status: "updated", id: managedGrant.id });
    await expect(asBoard.mutation(api.members.bulkUpdateAccessGrants, {
      ids: [managedGrant.id],
      patch: { status: "inactive" },
      reason: "Integration test",
    })).resolves.toMatchObject({ updatedCount: 1 });

    const assignment = await asBoard.mutation(api.iam.upsertAssignment, {
      accessGrantId: managedGrant.id,
      preset: "support",
      scope: "branch",
      organizationId,
      branchId: branch.id,
      reason: "Pilot support",
    });
    await expect(asBoard.mutation(api.iam.revokeAssignment, {
      id: assignment.id,
      reason: "Integration test completed",
    })).resolves.toMatchObject({ status: "revoked" });

    const partner = await asBoard.mutation(api.partners.upsert, {
      scope: "national",
      name: "Pilot Partner",
      category: "service",
      website: "https://partner.example.test",
    });
    await expect(asBoard.mutation(api.partners.upsert, {
      id: partner.id,
      scope: "national",
      name: "Updated Partner",
      category: "publisher",
      description: "Updated description",
    })).resolves.toMatchObject({ status: "updated", id: partner.id });
    await expect(asBoard.mutation(api.partners.setActive, { id: partner.id, active: false })).resolves.toMatchObject({ status: "updated" });
    await asBoard.mutation(api.partners.setActive, { id: partner.id, active: true });

    const offer = await asBoard.mutation(api.offers.upsertDraft, {
      scope: "national",
      partnerId: partner.id,
      title: "Pilot Offer",
      value: "10 %",
    });
    await expect(asBoard.mutation(api.offers.upsertDraft, {
      id: offer.id,
      scope: "national",
      partnerId: partner.id,
      title: "Updated Offer",
      value: "20 %",
      description: "Member terms",
    })).resolves.toMatchObject({ status: "updated", id: offer.id });
    await asBoard.mutation(api.offers.submitForApproval, { id: offer.id });
    await expect(asBoard.mutation(api.offers.review, { id: offer.id, approve: true })).resolves.toMatchObject({ status: "published" });
    await expect(asBoard.mutation(api.offers.setPaused, { id: offer.id, paused: true })).resolves.toMatchObject({ status: "paused" });
    await expect(asBoard.mutation(api.offers.setPaused, { id: offer.id, paused: false })).resolves.toMatchObject({ status: "published" });

    const campaign = await asBoard.mutation(api.campaigns.upsertDraft, {
      scope: "national",
      title: "Pilot Campaign",
      description: "Initial text",
    });
    await expect(asBoard.mutation(api.campaigns.upsertDraft, {
      id: campaign.id,
      scope: "national",
      title: "Updated Campaign",
      description: "Updated text",
      validFrom: now - 1_000,
      validUntil: now + 86_400_000,
    })).resolves.toMatchObject({ status: "updated", id: campaign.id });
    await expect(asBoard.mutation(api.campaigns.publish, { id: campaign.id })).resolves.toMatchObject({ status: "active" });

    const event = await asBoard.mutation(api.events.upsertDraft, {
      scope: "national",
      title: "Pilot Event",
      startsAt: now + 3_600_000,
    });
    await expect(asBoard.mutation(api.events.upsertDraft, {
      id: event.id,
      scope: "national",
      title: "Updated Event",
      description: "Updated event text",
      location: "Olomouc",
      capacity: 50,
      startsAt: now + 7_200_000,
      endsAt: now + 10_800_000,
    })).resolves.toMatchObject({ status: "updated", id: event.id });
    await expect(asBoard.mutation(api.events.publish, { id: event.id })).resolves.toMatchObject({ status: "scheduled" });
    await expect(asBoard.mutation(api.events.checkIn, {
      eventId: event.id,
      accessGrantId: memberGrantId,
    })).resolves.toMatchObject({ status: "checked_in" });
    await expect(asBoard.mutation(api.events.checkIn, {
      eventId: event.id,
      accessGrantId: memberGrantId,
    })).resolves.toMatchObject({ status: "already_checked_in" });

    const privacyRequestId = await t.run((ctx) => ctx.db.insert("privacyRequests", {
      memberId,
      type: "access",
      status: "submitted",
      createdAt: now,
      updatedAt: now,
    }));
    await expect(asBoard.mutation(api.privacy.resolveRequest, {
      id: privacyRequestId,
      status: "in_review",
    })).resolves.toMatchObject({ status: "in_review" });
    await expect(asBoard.mutation(api.privacy.resolveRequest, {
      id: privacyRequestId,
      status: "completed",
      resolution: "Request completed in the integration test.",
    })).resolves.toMatchObject({ status: "completed" });

    const persisted = await t.run(async (ctx) => ({
      grant: await ctx.db.get(managedGrant.id),
      partner: await ctx.db.get(partner.id),
      offer: await ctx.db.get(offer.id),
      campaign: await ctx.db.get(campaign.id),
      event: await ctx.db.get(event.id),
      assignment: await ctx.db.get(assignment.id),
      privacyRequest: await ctx.db.get(privacyRequestId),
      auditActions: (await ctx.db.query("auditLogs").collect()).map((entry) => entry.action),
    }));
    expect(persisted.grant).toMatchObject({ fullName: "Updated Member", role: "manager", status: "inactive" });
    expect(persisted.partner).toMatchObject({ name: "Updated Partner", category: "publisher", active: true });
    expect(persisted.offer).toMatchObject({ title: "Updated Offer", value: "20 %", status: "published" });
    expect(persisted.campaign).toMatchObject({ title: "Updated Campaign", status: "active" });
    expect(persisted.event).toMatchObject({ title: "Updated Event", status: "scheduled", capacity: 50 });
    expect(persisted.assignment).toMatchObject({ status: "revoked" });
    expect(persisted.privacyRequest).toMatchObject({ status: "completed" });
    expect(persisted.auditActions).toEqual(expect.arrayContaining([
      "accessGrant.update",
      "accessGrant.bulkUpdate",
      "partner.update",
      "offer.updateDraft",
      "campaign.updateDraft",
      "event.updateDraft",
      "staffAssignment.create",
      "staffAssignment.revoke",
      "privacyRequest.update",
    ]));
  });

  it("denies management edits to a regular member", async () => {
    const { asMember } = await seedManagementFlow();

    await expect(asMember.mutation(api.partners.upsert, {
      scope: "national",
      name: "Forbidden Partner",
      category: "other",
    })).rejects.toThrow();
    await expect(asMember.mutation(api.branches.create, {
      name: "Forbidden Branch",
      city: "Nowhere",
    })).rejects.toThrow();
  });

  it("persists member preferences, privacy request, feedback, and partner suggestion", async () => {
    const { t, asMember, memberId } = await seedManagementFlow();

    await expect(asMember.mutation(api.privacy.updateNotificationPreferences, {
      membershipReminders: true,
      newOffers: true,
      events: false,
    })).resolves.toMatchObject({ status: "created" });
    await expect(asMember.mutation(api.privacy.submitRequest, {
      type: "access",
    })).resolves.toMatchObject({ status: "submitted" });
    await expect(asMember.mutation(api.feedback.submit, {
      category: "app",
      message: "The member feedback button works.",
    })).resolves.toMatchObject({ status: "submitted" });
    await expect(asMember.mutation(api.feedback.submitPartnerSuggestion, {
      partnerName: "Suggested Partner",
    })).resolves.toMatchObject({ status: "submitted" });

    const persisted = await t.run(async (ctx) => ({
      preferences: await ctx.db
        .query("notificationPreferences")
        .withIndex("by_member", (q) => q.eq("memberId", memberId))
        .unique(),
      privacyRequests: await ctx.db
        .query("privacyRequests")
        .withIndex("by_member_createdAt", (q) => q.eq("memberId", memberId))
        .collect(),
      feedback: await ctx.db
        .query("feedback")
        .withIndex("by_member_createdAt", (q) => q.eq("memberId", memberId))
        .collect(),
      suggestions: await ctx.db
        .query("partnerSuggestions")
        .withIndex("by_suggestedBy_createdAt", (q) => q.eq("suggestedBy", memberId))
        .collect(),
    }));
    expect(persisted.preferences).toMatchObject({ membershipReminders: true, newOffers: true, events: false });
    expect(persisted.privacyRequests).toHaveLength(1);
    expect(persisted.feedback).toHaveLength(1);
    expect(persisted.suggestions).toHaveLength(1);
  });
});
