import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireActiveMember, requireCapability } from "./authz";
import { getDefaultOrganization } from "./organization";

const requestType = v.union(
  v.literal("access"),
  v.literal("correction"),
  v.literal("deletion"),
  v.literal("restriction"),
  v.literal("objection"),
);

export const myOverview = query({
  args: {},
  handler: async (ctx) => {
    const member = await requireActiveMember(ctx);
    const [preferences, requests] = await Promise.all([
      ctx.db.query("notificationPreferences").withIndex("by_member", (q) => q.eq("memberId", member._id)).unique(),
      ctx.db
        .query("privacyRequests")
        .withIndex("by_member_createdAt", (q) => q.eq("memberId", member._id))
        .order("desc")
        .take(20),
    ]);
    return {
      profile: {
        fullName: member.fullName,
        email: member.email,
        branchId: member.branchId ?? null,
        membershipUntil: member.membershipUntil,
      },
      preferences: preferences
        ? {
            membershipReminders: preferences.membershipReminders,
            newOffers: preferences.newOffers,
            events: preferences.events,
          }
        : { membershipReminders: false, newOffers: false, events: false },
      requests: requests.map((request) => ({
        id: request._id,
        type: request.type,
        status: request.status,
        message: request.message ?? null,
        resolution: request.resolution ?? null,
        createdAt: request.createdAt,
        handledAt: request.handledAt ?? null,
      })),
    };
  },
});

export const exportMyData = query({
  args: {},
  handler: async (ctx) => {
    const member = await requireActiveMember(ctx);
    const [grant, preferences, requests, feedbackRows, suggestions, tokens, checkIns, assignments, favorites, issueReports, redemptionRows] =
      await Promise.all([
        member.accessGrantId ? ctx.db.get(member.accessGrantId) : null,
        ctx.db
          .query("notificationPreferences")
          .withIndex("by_member", (q) => q.eq("memberId", member._id))
          .unique(),
        ctx.db
          .query("privacyRequests")
          .withIndex("by_member_createdAt", (q) => q.eq("memberId", member._id))
          .take(100),
        ctx.db
          .query("feedback")
          .withIndex("by_member_createdAt", (q) => q.eq("memberId", member._id))
          .take(500),
        ctx.db
          .query("partnerSuggestions")
          .withIndex("by_suggestedBy_createdAt", (q) => q.eq("suggestedBy", member._id))
          .take(500),
        ctx.db
          .query("tokens")
          .withIndex("by_member_status_expiresAt", (q) => q.eq("memberId", member._id))
          .take(1000),
        ctx.db
          .query("eventCheckIns")
          .withIndex("by_member", (q) => q.eq("memberId", member._id))
          .take(1000),
        member.accessGrantId
          ? ctx.db
              .query("staffAssignments")
              .withIndex("by_accessGrant_status", (q) => q.eq("accessGrantId", member.accessGrantId!))
              .take(100)
          : [],
        ctx.db
          .query("offerFavorites")
          .withIndex("by_member", (q) => q.eq("memberId", member._id))
          .take(500),
        ctx.db
          .query("offerIssueReports")
          .withIndex("by_member_offer", (q) => q.eq("memberId", member._id))
          .take(500),
        ctx.db
          .query("redemptionFeedback")
          .withIndex("by_member_createdAt", (q) => q.eq("memberId", member._id))
          .take(1000),
      ]);

    const tokenActivity = await Promise.all(
      tokens.map(async (token) => {
        const [offer, events] = await Promise.all([
          ctx.db.get(token.offerId),
          ctx.db
            .query("tokenEvents")
            .withIndex("by_token_createdAt", (q) => q.eq("tokenId", token._id))
            .take(100),
        ]);
        return {
          status: token.status,
          offerTitle: offer?.title ?? null,
          expiresAt: token.expiresAt,
          redeemedAt: token.redeemedAt ?? null,
          createdAt: token.createdAt,
          events: events.map((event) => ({ type: event.eventType, createdAt: event.createdAt })),
        };
      }),
    );

    const attendance = await Promise.all(
      checkIns.map(async (checkIn) => {
        const event = await ctx.db.get(checkIn.eventId);
        return {
          eventTitle: event?.title ?? null,
          eventStartsAt: event?.startsAt ?? null,
          checkedInAt: checkIn.checkedInAt,
        };
      }),
    );

    const favoriteOffers = await Promise.all(
      favorites.map(async (favorite) => {
        const offer = await ctx.db.get(favorite.offerId);
        return { offerTitle: offer?.title ?? null, savedAt: favorite.createdAt };
      }),
    );

    const reportedOffers = await Promise.all(
      issueReports.map(async (report) => {
        const offer = await ctx.db.get(report.offerId);
        return {
          offerTitle: offer?.title ?? null,
          reason: report.reason,
          note: report.note ?? null,
          status: report.status,
          createdAt: report.createdAt,
        };
      }),
    );

    return {
      exportedAt: Date.now(),
      controller: "Psychočas, z.s.",
      profile: {
        fullName: grant?.fullName ?? member.fullName,
        email: grant?.email ?? member.email,
        role: grant?.role ?? member.role,
        branchId: grant?.branchId ?? member.branchId ?? null,
        membershipUntil: grant?.membershipUntil ?? member.membershipUntil,
        status: grant?.status ?? member.status,
        createdAt: member.createdAt,
        lastSeenAt: member.lastSeenAt ?? null,
      },
      notificationPreferences: preferences
        ? {
            membershipReminders: preferences.membershipReminders,
            newOffers: preferences.newOffers,
            events: preferences.events,
            updatedAt: preferences.updatedAt,
          }
        : null,
      privacyRequests: requests.map((request) => ({
        type: request.type,
        status: request.status,
        message: request.message ?? null,
        resolution: request.resolution ?? null,
        createdAt: request.createdAt,
        handledAt: request.handledAt ?? null,
      })),
      feedback: feedbackRows.map((row) => ({
        category: row.category,
        message: row.message,
        status: row.status,
        createdAt: row.createdAt,
      })),
      partnerSuggestions: suggestions.map((row) => ({
        partnerName: row.partnerName,
        website: row.website ?? null,
        note: row.note ?? null,
        status: row.status,
        createdAt: row.createdAt,
      })),
      qrActivity: tokenActivity,
      favoriteOffers,
      offerIssueReports: reportedOffers,
      redemptionFeedback: redemptionRows.map((row) => ({
        experience: row.experience,
        createdAt: row.createdAt,
      })),
      eventAttendance: attendance,
      staffAssignments: assignments.map((assignment) => ({
        preset: assignment.preset,
        scope: assignment.scope,
        branchId: assignment.branchId ?? null,
        status: assignment.status,
        validUntil: assignment.validUntil ?? null,
      })),
    };
  },
});

export const updateNotificationPreferences = mutation({
  args: {
    membershipReminders: v.boolean(),
    newOffers: v.boolean(),
    events: v.boolean(),
  },
  handler: async (ctx, args) => {
    const member = await requireActiveMember(ctx);
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedByMemberAt: now, updatedAt: now });
      return { status: "updated" as const };
    }
    await ctx.db.insert("notificationPreferences", {
      memberId: member._id,
      ...args,
      updatedByMemberAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return { status: "created" as const };
  },
});

export const submitRequest = mutation({
  args: { type: requestType, message: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const member = await requireActiveMember(ctx);
    const message = args.message?.trim();
    if (message && message.length > 2000) throw new ConvexError("privacy_message_too_long");
    const existing = await ctx.db
      .query("privacyRequests")
      .withIndex("by_member_createdAt", (q) => q.eq("memberId", member._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), args.type),
          q.or(q.eq(q.field("status"), "submitted"), q.eq(q.field("status"), "in_review")),
        ),
      )
      .first();
    if (existing) throw new ConvexError("privacy_request_already_open");
    const now = Date.now();
    const id = await ctx.db.insert("privacyRequests", {
      memberId: member._id,
      type: args.type,
      status: "submitted",
      message: message || undefined,
      createdAt: now,
      updatedAt: now,
    });
    return { status: "submitted" as const, id };
  },
});

export const listRequests = query({
  args: {
    status: v.optional(v.union(v.literal("submitted"), v.literal("in_review"), v.literal("completed"), v.literal("rejected"))),
  },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    await requireCapability(ctx, "privacy.manage", { organizationId: organization._id });
    const rows = args.status
      ? await ctx.db
          .query("privacyRequests")
          .withIndex("by_status_createdAt", (q) => q.eq("status", args.status!))
          .order("desc")
          .take(300)
      : await ctx.db.query("privacyRequests").order("desc").take(300);
    return Promise.all(
      rows.map(async (row) => {
        const member = await ctx.db.get(row.memberId);
        return {
          id: row._id,
          type: row.type,
          status: row.status,
          message: row.message ?? null,
          resolution: row.resolution ?? null,
          member: member ? { fullName: member.fullName, email: member.email } : null,
          createdAt: row.createdAt,
          handledAt: row.handledAt ?? null,
        };
      }),
    );
  },
});

export const resolveRequest = mutation({
  args: {
    id: v.id("privacyRequests"),
    status: v.union(v.literal("in_review"), v.literal("completed"), v.literal("rejected")),
    resolution: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const actor = await requireCapability(ctx, "privacy.manage", { organizationId: organization._id });
    const request = await ctx.db.get(args.id);
    if (!request) throw new ConvexError("privacy_request_not_found");
    const resolution = args.resolution?.trim();
    if (resolution && resolution.length > 2000) throw new ConvexError("privacy_resolution_too_long");
    if ((args.status === "completed" || args.status === "rejected") && (!resolution || resolution.length < 10)) {
      throw new ConvexError("privacy_resolution_required");
    }
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: args.status,
      resolution: resolution || undefined,
      handledBy: actor._id,
      handledAt: args.status === "in_review" ? undefined : now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: "privacyRequest.update",
      entityType: "privacyRequest",
      entityId: args.id,
      before: { status: request.status },
      after: { status: args.status },
      createdAt: now,
    });
    return { status: args.status };
  },
});
