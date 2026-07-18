import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const NOW = Date.UTC(2026, 6, 18, 12, 0, 0);

async function seedActiveGrant(t: ReturnType<typeof convexTest>, email: string) {
  await t.run((ctx) =>
    ctx.db.insert("accessGrants", {
      email,
      fullName: "OTP Test",
      role: "member",
      membershipUntil: NOW + 86_400_000,
      status: "active",
      createdAt: NOW,
      updatedAt: NOW,
    }),
  );
}

describe("OTP request limits", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows an active member and applies the per-email cooldown", async () => {
    const t = convexTest(schema, modules);
    await seedActiveGrant(t, "member@example.test");

    await expect(
      t.mutation(internal.authAccess.consumeOtpRequest, { email: "MEMBER@example.test" }),
    ).resolves.toMatchObject({ status: "allowed" });
    await expect(
      t.mutation(internal.authAccess.consumeOtpRequest, { email: "member@example.test" }),
    ).resolves.toMatchObject({ status: "cooldown" });
  });

  it("stops delivery when the deployment-wide OTP budget is exhausted", async () => {
    const t = convexTest(schema, modules);
    await seedActiveGrant(t, "member@example.test");
    await t.run((ctx) =>
      ctx.db.insert("systemRateLimits", {
        key: "otp-email",
        windowStartedAt: NOW,
        requestCount: 200,
        updatedAt: NOW,
      }),
    );

    await expect(
      t.mutation(internal.authAccess.consumeOtpRequest, { email: "member@example.test" }),
    ).resolves.toMatchObject({ status: "global_rate_limited" });
  });
});
