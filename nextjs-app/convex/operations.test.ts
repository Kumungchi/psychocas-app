import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("privacy-safe operational status", () => {
  it("reports dependency health and aggregate pilot risks without member identity", async () => {
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
      const userId = await ctx.db.insert("users", { email: "board@example.test" });
      const grantId = await ctx.db.insert("accessGrants", {
        email: "board@example.test",
        fullName: "Board",
        role: "board",
        membershipUntil: now + 86_400_000,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const memberId = await ctx.db.insert("members", {
        userId,
        accessGrantId: grantId,
        email: "board@example.test",
        fullName: "Board",
        role: "board",
        membershipUntil: now + 86_400_000,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("accessGrants", {
        email: "expired@example.test",
        fullName: "Expired",
        role: "member",
        membershipUntil: now - 1,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("accessGrants", {
        email: "expiring@example.test",
        fullName: "Expiring",
        role: "member",
        membershipUntil: now + 7 * 86_400_000,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("retentionRuns", {
        policy: "operational-v1",
        processedCount: 0,
        deletedCount: 0,
        anonymizedCount: 0,
        startedAt: now - 100,
        finishedAt: now,
      });
      return { organizationId, userId, memberId };
    });

    await expect(t.query(api.operations.publicHealth, {})).resolves.toMatchObject({
      status: "ok",
      checks: { database: "ok", retention: "fresh" },
    });
    const result = await t
      .withIdentity({ subject: ids.userId })
      .query(api.operations.dashboard, { organizationId: ids.organizationId });
    expect(result.access).toMatchObject({
      expiredCount: 1,
      expiringWithin14DaysCount: 2,
    });
    expect(JSON.stringify(result)).not.toContain("@example.test");
  });
});
