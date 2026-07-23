import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import { buildWelcomeEmail, DEFAULT_EMAIL_SENDER, sendEmailWithResend } from "./email";

const MAX_WELCOME_ATTEMPTS = 3;

export const beginWelcome = internalMutation({
  args: { memberId: v.id("members") },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (
      !member ||
      member.welcomeEmailStatus === "sent" ||
      member.welcomeEmailStatus === "sending" ||
      (member.welcomeEmailAttempts ?? 0) >= MAX_WELCOME_ATTEMPTS
    ) {
      return null;
    }

    const attempts = (member.welcomeEmailAttempts ?? 0) + 1;
    await ctx.db.patch(member._id, {
      welcomeEmailStatus: "sending",
      welcomeEmailAttempts: attempts,
    });
    return {
      email: member.email,
      fullName: member.fullName,
      attempts,
    };
  },
});

export const finishWelcome = internalMutation({
  args: {
    memberId: v.id("members"),
    sent: v.boolean(),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member || member.welcomeEmailStatus === "sent") return;
    await ctx.db.patch(member._id, {
      welcomeEmailStatus: args.sent ? "sent" : "failed",
      welcomeEmailSentAt: args.sent ? Date.now() : undefined,
    });
  },
});

export const sendWelcome = internalAction({
  args: { memberId: v.id("members") },
  handler: async (ctx, args) => {
    const delivery = await ctx.runMutation(internal.emailDelivery.beginWelcome, args);
    if (!delivery) return;

    try {
      const siteUrl = (process.env.SITE_URL || "https://app.psychocas.cz").replace(/\/$/, "");
      await sendEmailWithResend({
        apiKey: process.env.AUTH_RESEND_KEY ?? "",
        from: process.env.AUTH_EMAIL_FROM ?? DEFAULT_EMAIL_SENDER,
        to: delivery.email,
        email: buildWelcomeEmail({
          fullName: delivery.fullName,
          appUrl: `${siteUrl}/home`,
          feedbackUrl: `${siteUrl}/home?tab=profile`,
        }),
      });
      await ctx.runMutation(internal.emailDelivery.finishWelcome, {
        memberId: args.memberId,
        sent: true,
      });
    } catch (error) {
      console.warn("Welcome email delivery failed", {
        memberId: args.memberId,
        attempt: delivery.attempts,
        errorCode: error instanceof Error ? error.message.split(":", 1)[0] : "unknown",
      });
      await ctx.runMutation(internal.emailDelivery.finishWelcome, {
        memberId: args.memberId,
        sent: false,
      });
      if (delivery.attempts < MAX_WELCOME_ATTEMPTS) {
        await ctx.scheduler.runAfter(60_000 * delivery.attempts, internal.emailDelivery.sendWelcome, args);
      }
    }
  },
});
