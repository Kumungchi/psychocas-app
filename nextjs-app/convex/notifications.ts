import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { effectiveAccessStatus } from "./access";
import { requireActiveMember, requireCapability } from "./authz";
import { getDefaultOrganization } from "./organization";

export const configuration = query({
  args: {},
  handler: async (ctx) => {
    await requireActiveMember(ctx);
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    return {
      pushConfigured: Boolean(
        publicKey &&
          process.env.VAPID_PRIVATE_KEY &&
          process.env.VAPID_SUBJECT,
      ),
      publicKey: publicKey ?? null,
    };
  },
});

export const subscribe = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgentGroup: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const member = await requireActiveMember(ctx);
    if (!args.endpoint.startsWith("https://") || args.endpoint.length > 2000) {
      throw new ConvexError("invalid_push_endpoint");
    }
    if (args.p256dh.length > 512 || args.auth.length > 512) throw new ConvexError("invalid_push_key");
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    const now = Date.now();
    if (existing) {
      if (existing.memberId !== member._id) throw new ConvexError("push_endpoint_conflict");
      await ctx.db.patch(existing._id, {
        p256dh: args.p256dh,
        auth: args.auth,
        userAgentGroup: args.userAgentGroup?.slice(0, 80),
        revokedAt: undefined,
      });
      return { status: "updated" as const, id: existing._id };
    }
    const id = await ctx.db.insert("pushSubscriptions", {
      memberId: member._id,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      userAgentGroup: args.userAgentGroup?.slice(0, 80),
      createdAt: now,
    });
    return { status: "subscribed" as const, id };
  },
});

export const unsubscribe = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const member = await requireActiveMember(ctx);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    if (!existing || existing.memberId !== member._id) return { status: "not_found" as const };
    await ctx.db.patch(existing._id, { revokedAt: Date.now() });
    return { status: "unsubscribed" as const };
  },
});

export const queueCampaign = mutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args): Promise<{ status: "queued"; queuedCount: number }> => {
    const organization = await getDefaultOrganization(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new ConvexError("campaign_not_found");
    await requireCapability(ctx, "campaign.send", {
      organizationId: campaign.organizationId ?? organization._id,
      branchId: campaign.branchId,
    });
    if (campaign.status !== "active" && campaign.status !== "scheduled") {
      throw new ConvexError("campaign_not_publishable");
    }
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
      throw new ConvexError("push_not_configured");
    }

    const subscriptions = await ctx.db.query("pushSubscriptions").take(5000);
    const now = Date.now();
    let queuedCount = 0;
    for (const subscription of subscriptions) {
      if (subscription.revokedAt) continue;
      const [member, preferences] = await Promise.all([
        ctx.db.get(subscription.memberId),
        ctx.db
          .query("notificationPreferences")
          .withIndex("by_member", (q) => q.eq("memberId", subscription.memberId))
          .unique(),
      ]);
      if (!member?.accessGrantId || !preferences?.newOffers) continue;
      const grant = await ctx.db.get(member.accessGrantId);
      if (!grant || effectiveAccessStatus(grant.status, grant.membershipUntil, now) !== "active") continue;
      if (campaign.branchId && grant.branchId !== campaign.branchId) continue;
      const existing = await ctx.db
        .query("deliveryJobs")
        .withIndex("by_campaign_subscription", (q) =>
          q.eq("campaignId", campaign._id).eq("subscriptionId", subscription._id),
        )
        .first();
      if (existing) continue;
      await ctx.db.insert("deliveryJobs", {
        campaignId: campaign._id,
        memberId: member._id,
        subscriptionId: subscription._id,
        status: "pending",
        attempts: 0,
        scheduledFor: Math.max(now, campaign.validFrom ?? now),
        createdAt: now,
        updatedAt: now,
      });
      queuedCount += 1;
    }
    if (queuedCount > 0) {
      await ctx.scheduler.runAfter(0, internal.notificationsNode.processCampaign, {
        campaignId: campaign._id,
      });
    }
    return { status: "queued", queuedCount };
  },
});

export const takePendingJobs = internalQuery({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("deliveryJobs")
      .withIndex("by_campaign_status", (q) => q.eq("campaignId", args.campaignId).eq("status", "pending"))
      .take(100);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return [];
    return Promise.all(
      jobs.map(async (job) => {
        const subscription = await ctx.db.get(job.subscriptionId);
        return subscription && !subscription.revokedAt
          ? {
              jobId: job._id,
              subscriptionId: subscription._id,
              endpoint: subscription.endpoint,
              p256dh: subscription.p256dh,
              auth: subscription.auth,
              title: campaign.title,
              body: campaign.description ?? "Novinka v členské aplikaci Psychočasu.",
            }
          : null;
      }),
    ).then((rows) => rows.filter((row): row is NonNullable<typeof row> => Boolean(row)));
  },
});

export const completeJob = internalMutation({
  args: {
    jobId: v.id("deliveryJobs"),
    subscriptionId: v.id("pushSubscriptions"),
    sent: v.boolean(),
    errorCode: v.optional(v.string()),
    revokeSubscription: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status !== "pending") return;
    const now = Date.now();
    await ctx.db.patch(args.jobId, {
      status: args.sent ? "sent" : "failed",
      attempts: job.attempts + 1,
      lastError: args.errorCode,
      sentAt: args.sent ? now : undefined,
      updatedAt: now,
    });
    if (args.revokeSubscription) await ctx.db.patch(args.subscriptionId, { revokedAt: now });
  },
});
