import { ConvexError, v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { normalizeEmail } from "./access";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ORGANIZATION_SLUG = "psychocas";
const DEMO_NOTE = "DEMO – pouze pro testování rolí a workflow.";

const roleFixtures = [
  { email: "demo.support@psychocas.invalid", fullName: "Demo Podpora", preset: "support", scope: "organization" },
  { email: "demo.hr@psychocas.invalid", fullName: "Demo HR koordinátor", preset: "coordinator_hr", scope: "organization" },
  { email: "demo.pr@psychocas.invalid", fullName: "Demo PR koordinátor", preset: "coordinator_pr", scope: "organization" },
  {
    email: "demo.partners@psychocas.invalid",
    fullName: "Demo Koordinátor partnerství",
    preset: "coordinator_partnerships",
    scope: "organization",
  },
  {
    email: "demo.events@psychocas.invalid",
    fullName: "Demo Koordinátor akcí",
    preset: "coordinator_events",
    scope: "organization",
  },
  { email: "demo.manager.ostrava@psychocas.invalid", fullName: "Demo Manažer Ostrava", preset: "manager", scope: "branch" },
  { email: "demo.board@psychocas.invalid", fullName: "Demo Výbor", preset: "board", scope: "organization" },
  { email: "demo.admin@psychocas.invalid", fullName: "Demo Administrátor", preset: "admin", scope: "organization" },
] as const;

type SeedScope = "national" | "local";
type DemoSeedResult = {
  status: "seeded";
  organizationId: Id<"organizations">;
  branchId: Id<"branches">;
  accessGrantId: Id<"accessGrants">;
  memberId: Id<"members">;
  assignmentCount: number;
  memberProvisionedCount: number;
  publishedOfferCount: number;
  welcomeScheduled: boolean;
};

const additionalMember = v.object({
  email: v.string(),
  fullName: v.string(),
  branchCity: v.string(),
});

export const apply = internalMutation({
  args: {
    targetEmail: v.string(),
    targetFullName: v.string(),
    branchCity: v.string(),
    sendWelcome: v.boolean(),
    additionalMembers: v.optional(v.array(additionalMember)),
  },
  handler: async (ctx, args): Promise<DemoSeedResult> => {
    const now = Date.now();
    const email = normalizeEmail(args.targetEmail);
    const fullName = args.targetFullName.trim();
    const branchCity = args.branchCity.trim();
    if (!email || !fullName || !branchCity) throw new ConvexError("invalid_seed_target");

    let organization = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", DEFAULT_ORGANIZATION_SLUG))
      .unique();
    if (!organization) {
      const organizationId = await ctx.db.insert("organizations", {
        name: "Psychočas",
        slug: DEFAULT_ORGANIZATION_SLUG,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      organization = await ctx.db.get(organizationId);
    } else if (!organization.active) {
      await ctx.db.patch(organization._id, { active: true, updatedAt: now });
      organization = { ...organization, active: true, updatedAt: now };
    }
    if (!organization) throw new ConvexError("organization_unavailable");

    const branchCities = ["Praha", "Brno", "Olomouc", "Ostrava", "České Budějovice"];
    const branches = new Map<string, Id<"branches">>();
    for (const city of branchCities) {
      let branch = await ctx.db
        .query("branches")
        .withIndex("by_city", (q) => q.eq("city", city))
        .first();
      if (!branch) {
        const branchId = await ctx.db.insert("branches", {
          organizationId: organization._id,
          name: city,
          city,
          active: true,
          createdAt: now,
          updatedAt: now,
        });
        branch = await ctx.db.get(branchId);
      } else {
        await ctx.db.patch(branch._id, {
          organizationId: organization._id,
          active: true,
          updatedAt: now,
        });
      }
      if (branch) branches.set(city, branch._id);
    }
    const branchId = branches.get(branchCity);
    if (!branchId) throw new ConvexError("seed_branch_not_found");

    let accessGrant = await ctx.db
      .query("accessGrants")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (accessGrant) {
      await ctx.db.patch(accessGrant._id, {
        fullName,
        branchId,
        status: "active",
        updatedAt: now,
      });
      accessGrant = await ctx.db.get(accessGrant._id);
    } else {
      const accessGrantId = await ctx.db.insert("accessGrants", {
        email,
        fullName,
        role: "member",
        branchId,
        membershipUntil: now + 365 * DAY_MS,
        status: "active",
        source: "manual",
        notes: "Testovací účet vlastníka aplikace.",
        createdAt: now,
        updatedAt: now,
      });
      accessGrant = await ctx.db.get(accessGrantId);
    }
    if (!accessGrant) throw new ConvexError("seed_access_grant_unavailable");

    let member = await ctx.db
      .query("members")
      .withIndex("by_accessGrantId", (q) => q.eq("accessGrantId", accessGrant!._id))
      .unique();
    if (!member) {
      member = await ctx.db
        .query("members")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
    }
    if (member) {
      await ctx.db.patch(member._id, {
        accessGrantId: accessGrant._id,
        email,
        fullName,
        role: accessGrant.role,
        branchId,
        membershipUntil: accessGrant.membershipUntil,
        status: "active",
        updatedAt: now,
        ...(args.sendWelcome && member.welcomeEmailStatus !== "sent"
          ? { welcomeEmailStatus: "scheduled" as const, welcomeEmailAttempts: 0 }
          : {}),
      });
      member = await ctx.db.get(member._id);
    } else {
      const memberId = await ctx.db.insert("members", {
        accessGrantId: accessGrant._id,
        email,
        fullName,
        role: accessGrant.role,
        branchId,
        membershipUntil: accessGrant.membershipUntil,
        status: "active",
        ...(args.sendWelcome
          ? { welcomeEmailStatus: "scheduled" as const, welcomeEmailAttempts: 0 }
          : {}),
        createdAt: now,
        updatedAt: now,
      });
      member = await ctx.db.get(memberId);
    }
    if (!member) throw new ConvexError("seed_member_unavailable");

    if (args.sendWelcome && member.welcomeEmailStatus === "scheduled") {
      await ctx.scheduler.runAfter(0, internal.emailDelivery.sendWelcome, { memberId: member._id });
    }

    let memberProvisionedCount = 0;
    for (const fixture of args.additionalMembers ?? []) {
      const fixtureEmail = normalizeEmail(fixture.email);
      const fixtureFullName = fixture.fullName.trim();
      const fixtureBranchId = branches.get(fixture.branchCity.trim());
      if (!fixtureEmail || !fixtureFullName || !fixtureBranchId) {
        throw new ConvexError("invalid_additional_member");
      }

      let fixtureGrant = await ctx.db
        .query("accessGrants")
        .withIndex("by_email", (q) => q.eq("email", fixtureEmail))
        .unique();
      if (fixtureGrant) {
        await ctx.db.patch(fixtureGrant._id, {
          fullName: fixtureFullName,
          branchId: fixtureBranchId,
          status: "active",
          notes: "Člen doplněný při pilotním provisioningu.",
          updatedBy: member._id,
          updatedAt: now,
        });
        fixtureGrant = await ctx.db.get(fixtureGrant._id);
      } else {
        const fixtureGrantId = await ctx.db.insert("accessGrants", {
          email: fixtureEmail,
          fullName: fixtureFullName,
          role: "member",
          branchId: fixtureBranchId,
          membershipUntil: now + 365 * DAY_MS,
          status: "active",
          source: "manual",
          notes: "Člen doplněný při pilotním provisioningu.",
          createdBy: member._id,
          createdAt: now,
          updatedAt: now,
        });
        fixtureGrant = await ctx.db.get(fixtureGrantId);
      }
      if (!fixtureGrant) throw new ConvexError("additional_member_unavailable");

      const fixtureMember = await ctx.db
        .query("members")
        .withIndex("by_accessGrantId", (q) => q.eq("accessGrantId", fixtureGrant!._id))
        .unique();
      if (fixtureMember) {
        await ctx.db.patch(fixtureMember._id, {
          email: fixtureEmail,
          fullName: fixtureFullName,
          role: fixtureGrant.role,
          branchId: fixtureBranchId,
          membershipUntil: fixtureGrant.membershipUntil,
          status: "active",
          updatedAt: now,
        });
      }
      memberProvisionedCount += 1;
    }

    let assignmentCount = 0;
    for (const fixture of roleFixtures) {
      let grant = await ctx.db
        .query("accessGrants")
        .withIndex("by_email", (q) => q.eq("email", fixture.email))
        .unique();
      const fixtureBranchId = fixture.scope === "branch" ? branchId : undefined;
      if (!grant) {
        const grantId = await ctx.db.insert("accessGrants", {
          email: fixture.email,
          fullName: fixture.fullName,
          role: "member",
          branchId: fixtureBranchId,
          membershipUntil: now + 365 * DAY_MS,
          status: "active",
          source: "manual",
          notes: DEMO_NOTE,
          createdBy: member._id,
          createdAt: now,
          updatedAt: now,
        });
        grant = await ctx.db.get(grantId);
      } else {
        await ctx.db.patch(grant._id, {
          fullName: fixture.fullName,
          role: "member",
          branchId: fixtureBranchId,
          status: "active",
          notes: DEMO_NOTE,
          updatedBy: member._id,
          updatedAt: now,
        });
      }
      if (!grant) continue;

      const existingAssignment = await ctx.db
        .query("staffAssignments")
        .withIndex("by_grant_preset_scope", (q) =>
          q
            .eq("accessGrantId", grant!._id)
            .eq("preset", fixture.preset)
            .eq("organizationId", organization!._id)
            .eq("branchId", fixtureBranchId),
        )
        .unique();
      if (existingAssignment) {
        await ctx.db.patch(existingAssignment._id, {
          scope: fixture.scope,
          branchId: fixtureBranchId,
          status: "active",
          reason: DEMO_NOTE,
          revokedAt: undefined,
          updatedBy: member._id,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("staffAssignments", {
          accessGrantId: grant._id,
          preset: fixture.preset,
          scope: fixture.scope,
          organizationId: organization._id,
          branchId: fixtureBranchId,
          status: "active",
          reason: DEMO_NOTE,
          createdBy: member._id,
          createdAt: now,
          updatedAt: now,
        });
      }
      assignmentCount += 1;
    }

    const upsertPartner = async (input: {
      name: string;
      category: "cafe" | "publisher" | "service";
      scope: SeedScope;
      description: string;
      address?: string;
    }) => {
      const partnerBranchId = input.scope === "local" ? branchId : undefined;
      const rows = await ctx.db
        .query("partners")
        .withIndex("by_organization_branch_active", (q) =>
          q.eq("organizationId", organization!._id).eq("branchId", partnerBranchId),
        )
        .take(100);
      const existing = rows.find((row) => row.name === input.name);
      const payload = {
        organizationId: organization!._id,
        name: input.name,
        category: input.category,
        description: input.description,
        address: input.address,
        branchId: partnerBranchId,
        active: true,
        updatedBy: member!._id,
        updatedAt: now,
      };
      if (existing) {
        await ctx.db.patch(existing._id, payload);
        return existing._id;
      }
      return ctx.db.insert("partners", {
        ...payload,
        createdBy: member!._id,
        createdAt: now,
      });
    };

    const nationalBooks = await upsertPartner({
      name: "[DEMO] PsychoKnihy",
      category: "publisher",
      scope: "national",
      description: "Testovací partner pro ověření národních členských výhod.",
    });
    const ostravaCafe = await upsertPartner({
      name: "[DEMO] Kavárna Klid Ostrava",
      category: "cafe",
      scope: "local",
      description: "Testovací ostravský partner. Nabídky neslouží k reálnému uplatnění.",
      address: "Ostrava – testovací provozovna",
    });
    const nationalService = await upsertPartner({
      name: "[DEMO] Centrum duševní pohody",
      category: "service",
      scope: "national",
      description: "Testovací služba pro kompletní průchod členskou aplikací.",
    });

    const upsertOffer = async (input: {
      partnerId: Id<"partners">;
      title: string;
      value: string;
      scope: SeedScope;
      status: "draft" | "pending_approval" | "published" | "paused";
      description: string;
    }) => {
      const offerBranchId = input.scope === "local" ? branchId : undefined;
      const rows = await ctx.db
        .query("offers")
        .withIndex("by_partner_status", (q) => q.eq("partnerId", input.partnerId))
        .take(100);
      const existing = rows.find((row) => row.title === input.title);
      const payload = {
        organizationId: organization!._id,
        partnerId: input.partnerId,
        title: input.title,
        value: input.value,
        description: input.description,
        redemptionInstructions: "Vygeneruj testovací QR kód a projdi ověřením. Tato demo nabídka není určena k reálnému uplatnění.",
        terms: "DEMO: nabídka slouží výhradně k testování aplikace Psychočas.",
        scope: input.scope,
        branchId: offerBranchId,
        status: input.status,
        validFrom: now - DAY_MS,
        validUntil: now + 180 * DAY_MS,
        lastVerifiedAt: input.status === "published" ? now : undefined,
        updatedBy: member!._id,
        updatedAt: now,
      };
      if (existing) {
        await ctx.db.patch(existing._id, payload);
        return existing._id;
      }
      return ctx.db.insert("offers", {
        ...payload,
        createdBy: member!._id,
        createdAt: now,
      });
    };

    const publishedNationalOffer = await upsertOffer({
      partnerId: nationalBooks,
      title: "[DEMO] 15 % na psychologickou literaturu",
      value: "15 %",
      scope: "national",
      status: "published",
      description: "Publikovaná národní nabídka pro test seznamu, detailu, oblíbených a QR ověření.",
    });
    await upsertOffer({
      partnerId: ostravaCafe,
      title: "[DEMO] Nápoj k objednávce zdarma",
      value: "1 nápoj zdarma",
      scope: "local",
      status: "published",
      description: "Publikovaná lokální výhoda viditelná členům ostravské pobočky.",
    });
    await upsertOffer({
      partnerId: nationalService,
      title: "[DEMO] Měsíc online programu zdarma",
      value: "1 měsíc zdarma",
      scope: "national",
      status: "published",
      description: "Další aktivní nabídka pro test filtrování a oblíbených.",
    });
    await upsertOffer({
      partnerId: nationalBooks,
      title: "[DEMO] Připravovaná nabídka",
      value: "20 %",
      scope: "national",
      status: "draft",
      description: "Koncept nabídky pro test editace a schvalovacího workflow.",
    });
    const pendingOffer = await upsertOffer({
      partnerId: ostravaCafe,
      title: "[DEMO] Workshop v Ostravě",
      value: "20 %",
      scope: "local",
      status: "pending_approval",
      description: "Nabídka čekající na schválení výborem.",
    });
    await upsertOffer({
      partnerId: nationalService,
      title: "[DEMO] Pozastavená nabídka",
      value: "10 %",
      scope: "national",
      status: "paused",
      description: "Pozastavený obsah pro test správy životního cyklu.",
    });

    const pendingApprovals = await ctx.db
      .query("approvalRequests")
      .withIndex("by_entity", (q) => q.eq("entityType", "offer").eq("entityId", pendingOffer))
      .take(10);
    if (!pendingApprovals.some((row) => row.status === "pending")) {
      await ctx.db.insert("approvalRequests", {
        organizationId: organization._id,
        branchId,
        entityType: "offer",
        entityId: pendingOffer,
        requestedAction: "publish",
        status: "pending",
        requestedBy: member._id,
        createdAt: now,
        updatedAt: now,
      });
    }

    const upsertCampaign = async (title: string, status: "draft" | "active") => {
      const existing = (
        await ctx.db
          .query("campaigns")
          .withIndex("by_organization_status", (q) => q.eq("organizationId", organization!._id))
          .take(100)
      ).find((row) => row.title === title);
      const payload = {
        organizationId: organization!._id,
        title,
        description: `${DEMO_NOTE} Test notifikací a kampaní.`,
        status,
        validFrom: now - DAY_MS,
        validUntil: now + 30 * DAY_MS,
        updatedBy: member!._id,
        updatedAt: now,
      };
      if (existing) return ctx.db.patch(existing._id, payload);
      await ctx.db.insert("campaigns", { ...payload, createdBy: member!._id, createdAt: now });
    };
    await upsertCampaign("[DEMO] Nové členské výhody", "active");
    await upsertCampaign("[DEMO] Připravovaná zářijová kampaň", "draft");

    const upsertEvent = async (input: { title: string; local: boolean; dayOffset: number }) => {
      const existing = (
        await ctx.db
          .query("events")
          .withIndex("by_organization_status", (q) => q.eq("organizationId", organization!._id))
          .take(100)
      ).find((row) => row.title === input.title);
      const startsAt = now + input.dayOffset * DAY_MS;
      const payload = {
        organizationId: organization!._id,
        title: input.title,
        description: DEMO_NOTE,
        location: input.local ? "Ostrava – testovací místo" : "Online",
        capacity: 40,
        branchId: input.local ? branchId : undefined,
        startsAt,
        endsAt: startsAt + 2 * 60 * 60 * 1000,
        status: "scheduled" as const,
        updatedAt: now,
      };
      if (existing) return ctx.db.patch(existing._id, payload);
      await ctx.db.insert("events", { ...payload, createdBy: member!._id, createdAt: now });
    };
    await upsertEvent({ title: "[DEMO] Online setkání členů", local: false, dayOffset: 7 });
    await upsertEvent({ title: "[DEMO] Ostravský networking", local: true, dayOffset: 14 });

    const today = new Date(now).toISOString().slice(0, 10);
    const analyticsRows = await ctx.db
      .query("analyticsDaily")
      .withIndex("by_date", (q) => q.eq("dateKey", today))
      .take(100);
    const analyticsExisting = analyticsRows.find(
      (row) => row.branchId === branchId && row.offerId === publishedNationalOffer,
    );
    const analyticsPayload = {
      dateKey: today,
      branchId,
      partnerId: nationalBooks,
      offerId: publishedNationalOffer,
      generatedCount: 12,
      scannedCount: 9,
      validCount: 8,
      expiredCount: 1,
      duplicateScanCount: 1,
      rejectedCount: 0,
      updatedAt: now,
    };
    if (analyticsExisting) {
      await ctx.db.patch(analyticsExisting._id, analyticsPayload);
    } else {
      await ctx.db.insert("analyticsDaily", analyticsPayload);
    }

    const existingFeedback = (
      await ctx.db
        .query("feedback")
        .withIndex("by_member_createdAt", (q) => q.eq("memberId", member!._id))
        .take(100)
    ).find((row) => row.message === "[DEMO] Testovací podnět ke zpracování podpory.");
    if (!existingFeedback) {
      await ctx.db.insert("feedback", {
        memberId: member._id,
        category: "app",
        message: "[DEMO] Testovací podnět ke zpracování podpory.",
        status: "open",
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.insert("auditLogs", {
      actorMemberId: member._id,
      action: "demoSeed.apply",
      entityType: "demoSeed",
      entityId: "complete-role-and-content-fixtures-v1",
      summary: `Demo data připravena pro ${email} / ${branchCity}.`,
      createdAt: now,
    });

    return {
      status: "seeded" as const,
      organizationId: organization._id,
      branchId,
      accessGrantId: accessGrant._id,
      memberId: member._id,
      assignmentCount,
      memberProvisionedCount,
      publishedOfferCount: 3,
      welcomeScheduled: args.sendWelcome && member.welcomeEmailStatus === "scheduled",
    };
  },
});

export const run = action({
  args: {
    token: v.string(),
    targetEmail: v.string(),
    targetFullName: v.string(),
    branchCity: v.string(),
    sendWelcome: v.boolean(),
    additionalMembers: v.optional(v.array(additionalMember)),
  },
  handler: async (ctx, args): Promise<DemoSeedResult> => {
    const expected = process.env.PSYCHOCAS_SEED_TOKEN;
    if (!expected || expected.length < 24 || args.token !== expected) {
      throw new ConvexError("seed_not_authorized");
    }
    return ctx.runMutation(internal.demoSeed.apply, {
      targetEmail: args.targetEmail,
      targetFullName: args.targetFullName,
      branchCity: args.branchCity,
      sendWelcome: args.sendWelcome,
      additionalMembers: args.additionalMembers,
    });
  },
});
