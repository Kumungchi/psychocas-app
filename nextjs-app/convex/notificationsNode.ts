"use node";

import { v } from "convex/values";
import webpush from "web-push";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const processCampaign = internalAction({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args): Promise<{ processed: number }> => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject) return { processed: 0 };
    webpush.setVapidDetails(subject, publicKey, privateKey);
    const jobs = await ctx.runQuery(internal.notifications.takePendingJobs, {
      campaignId: args.campaignId,
    });
    for (const job of jobs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: job.endpoint,
            keys: { p256dh: job.p256dh, auth: job.auth },
          },
          JSON.stringify({
            title: job.title,
            body: job.body,
            icon: "/faviconV1.png",
            badge: "/faviconV1.png",
            url: "/home?tab=offers",
          }),
          { TTL: 3600 },
        );
        await ctx.runMutation(internal.notifications.completeJob, {
          jobId: job.jobId,
          subscriptionId: job.subscriptionId,
          sent: true,
        });
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : undefined;
        await ctx.runMutation(internal.notifications.completeJob, {
          jobId: job.jobId,
          subscriptionId: job.subscriptionId,
          sent: false,
          errorCode: statusCode ? `push_${statusCode}` : "push_failed",
          revokeSubscription: statusCode === 404 || statusCode === 410,
        });
      }
    }
    return { processed: jobs.length };
  },
});
