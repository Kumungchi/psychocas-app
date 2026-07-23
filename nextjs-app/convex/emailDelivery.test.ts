import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("welcome email delivery", () => {
  it("claims a scheduled welcome email only once and never reclaims a sent email", async () => {
    const t = convexTest(schema, modules);
    const now = Date.UTC(2026, 6, 20, 12, 0, 0);
    const memberId = await t.run((ctx) =>
      ctx.db.insert("members", {
        email: "member@example.test",
        fullName: "Alex Novák",
        role: "member",
        membershipUntil: now + 86_400_000,
        status: "active",
        welcomeEmailStatus: "scheduled",
        welcomeEmailAttempts: 0,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await expect(
      t.mutation(internal.emailDelivery.beginWelcome, { memberId }),
    ).resolves.toMatchObject({ email: "member@example.test", attempts: 1 });
    await expect(
      t.mutation(internal.emailDelivery.beginWelcome, { memberId }),
    ).resolves.toBeNull();

    await t.mutation(internal.emailDelivery.finishWelcome, { memberId, sent: true });
    await expect(
      t.mutation(internal.emailDelivery.beginWelcome, { memberId }),
    ).resolves.toBeNull();
  });
});
