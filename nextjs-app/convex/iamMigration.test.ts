import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

async function seedAccessMigration(includeSecondBoard = true) {
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
    const actorUserId = await ctx.db.insert("users", { email: "actor@example.test" });
    const actorGrantId = await ctx.db.insert("accessGrants", {
      email: "actor@example.test",
      fullName: "Board Actor",
      role: "board",
      membershipUntil: now + 86_400_000,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const actorMemberId = await ctx.db.insert("members", {
      userId: actorUserId,
      accessGrantId: actorGrantId,
      email: "actor@example.test",
      fullName: "Board Actor",
      role: "board",
      membershipUntil: now + 86_400_000,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    if (!includeSecondBoard) {
      return { organizationId, actorUserId, actorGrantId, actorMemberId };
    }

    const targetUserId = await ctx.db.insert("users", { email: "pr@example.test" });
    const targetGrantId = await ctx.db.insert("accessGrants", {
      email: "pr@example.test",
      fullName: "PR Coordinator",
      role: "board",
      membershipUntil: now + 86_400_000,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const targetMemberId = await ctx.db.insert("members", {
      userId: targetUserId,
      accessGrantId: targetGrantId,
      email: "pr@example.test",
      fullName: "PR Coordinator",
      role: "board",
      membershipUntil: now + 86_400_000,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    return {
      organizationId,
      actorUserId,
      actorGrantId,
      actorMemberId,
      targetUserId,
      targetGrantId,
      targetMemberId,
    };
  });
  return { t, now, ...ids };
}

describe("least-privilege access migration", () => {
  it("atomically replaces a broad legacy role with a scoped coordinator assignment", async () => {
    const seeded = await seedAccessMigration();
    const asBoard = seeded.t.withIdentity({ subject: seeded.actorUserId });
    const asCoordinator = seeded.t.withIdentity({ subject: seeded.targetUserId! });

    await expect(
      asBoard.mutation(api.iam.upsertAssignment, {
        accessGrantId: seeded.targetGrantId!,
        preset: "coordinator_pr",
        scope: "organization",
        organizationId: seeded.organizationId,
        replaceLegacyRole: true,
        reason: "PR least privilege",
      }),
    ).resolves.toMatchObject({ status: "created" });

    const persisted = await seeded.t.run(async (ctx) => ({
      grant: await ctx.db.get(seeded.targetGrantId!),
      member: await ctx.db.get(seeded.targetMemberId!),
    }));
    expect(persisted.grant?.role).toBe("member");
    expect(persisted.member?.role).toBe("member");
    await expect(asCoordinator.query(api.iam.viewerAccess, {})).resolves.toMatchObject({
      legacyRole: "member",
      capabilities: ["campaign.draft"],
    });
    await expect(
      asCoordinator.query(api.members.listAccessGrants, { limit: 10 }),
    ).rejects.toThrow();
  });

  it("accepts board access from an assignment after the base role becomes member", async () => {
    const seeded = await seedAccessMigration();
    const asBoard = seeded.t.withIdentity({ subject: seeded.actorUserId });
    const asTarget = seeded.t.withIdentity({ subject: seeded.targetUserId! });

    await asBoard.mutation(api.iam.upsertAssignment, {
      accessGrantId: seeded.targetGrantId!,
      preset: "board",
      scope: "organization",
      organizationId: seeded.organizationId,
      replaceLegacyRole: true,
    });

    await expect(asTarget.query(api.members.listAccessGrants, { limit: 10 })).resolves.toHaveLength(2);
  });

  it("refuses to remove the final elevated access path", async () => {
    const seeded = await seedAccessMigration(false);
    const asOnlyBoard = seeded.t.withIdentity({ subject: seeded.actorUserId });

    await expect(
      asOnlyBoard.mutation(api.iam.upsertAssignment, {
        accessGrantId: seeded.actorGrantId,
        preset: "coordinator_pr",
        scope: "organization",
        organizationId: seeded.organizationId,
        replaceLegacyRole: true,
      }),
    ).rejects.toThrow("last_elevated_access");

    const grant = await seeded.t.run((ctx) => ctx.db.get(seeded.actorGrantId));
    expect(grant?.role).toBe("board");
  });
});
