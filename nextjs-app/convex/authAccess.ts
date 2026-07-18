import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { effectiveAccessStatus, normalizeEmail } from "./access";
import { parseBootstrapEmails } from "./authMembership";

const OTP_COOLDOWN_MS = 60 * 1000;
const OTP_WINDOW_MS = 15 * 60 * 1000;
const OTP_MAX_REQUESTS_PER_WINDOW = 5;
const OTP_GLOBAL_LIMIT_KEY = "otp-email";
const OTP_GLOBAL_MAX_REQUESTS_PER_WINDOW = 200;

export const consumeOtpRequest = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const grant = await ctx.db
      .query("accessGrants")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    let hasAccess =
      grant !== null &&
      effectiveAccessStatus(grant.status, grant.membershipUntil) === "active";

    if (!grant && !hasAccess && parseBootstrapEmails().has(email)) {
      const existingElevated = await ctx.db
        .query("accessGrants")
        .filter((q) =>
          q.or(q.eq(q.field("role"), "admin"), q.eq(q.field("role"), "board")),
        )
        .first();
      hasAccess = existingElevated === null;
    }

    if (!hasAccess) {
      return { status: "denied" as const, retryAfterMs: 0 };
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("otpRequestLimits")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing && now - existing.lastRequestedAt < OTP_COOLDOWN_MS) {
      return {
        status: "cooldown" as const,
        retryAfterMs: OTP_COOLDOWN_MS - (now - existing.lastRequestedAt),
      };
    }

    const insideWindow = existing && now - existing.windowStartedAt < OTP_WINDOW_MS;
    if (insideWindow && existing.requestCount >= OTP_MAX_REQUESTS_PER_WINDOW) {
      return {
        status: "rate_limited" as const,
        retryAfterMs: OTP_WINDOW_MS - (now - existing.windowStartedAt),
      };
    }

    const globalLimit = await ctx.db
      .query("systemRateLimits")
      .withIndex("by_key", (q) => q.eq("key", OTP_GLOBAL_LIMIT_KEY))
      .unique();
    const insideGlobalWindow =
      globalLimit && now - globalLimit.windowStartedAt < OTP_WINDOW_MS;
    if (
      insideGlobalWindow &&
      globalLimit.requestCount >= OTP_GLOBAL_MAX_REQUESTS_PER_WINDOW
    ) {
      return {
        status: "global_rate_limited" as const,
        retryAfterMs: OTP_WINDOW_MS - (now - globalLimit.windowStartedAt),
      };
    }

    if (globalLimit) {
      await ctx.db.patch(globalLimit._id, {
        windowStartedAt: insideGlobalWindow ? globalLimit.windowStartedAt : now,
        requestCount: insideGlobalWindow ? globalLimit.requestCount + 1 : 1,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("systemRateLimits", {
        key: OTP_GLOBAL_LIMIT_KEY,
        windowStartedAt: now,
        requestCount: 1,
        updatedAt: now,
      });
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        windowStartedAt: insideWindow ? existing.windowStartedAt : now,
        requestCount: insideWindow ? existing.requestCount + 1 : 1,
        lastRequestedAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("otpRequestLimits", {
        email,
        windowStartedAt: now,
        requestCount: 1,
        lastRequestedAt: now,
        updatedAt: now,
      });
    }

    return { status: "allowed" as const, retryAfterMs: OTP_COOLDOWN_MS };
  },
});
