import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireActiveMember, requireCapability } from "./authz";
import { getDefaultOrganization } from "./organization";
import { effectiveAccessStatus, normalizeEmail } from "./access";

function scopeTarget(organizationId: Id<"organizations">, scope: "national" | "local", branchId?: Id<"branches">) {
  if (scope === "local" && !branchId) throw new ConvexError("branch_required");
  if (scope === "national" && branchId) throw new ConvexError("branch_not_allowed");
  return { organizationId, branchId };
}

export const listForViewer = query({
  args: {},
  handler: async (ctx) => {
    const [member, organization] = await Promise.all([requireActiveMember(ctx), getDefaultOrganization(ctx)]);
    const rows = await ctx.db
      .query("events")
      .withIndex("by_organization_status", (q) => q.eq("organizationId", organization._id))
      .take(300);
    const now = Date.now();
    return rows
      .filter(
        (event) =>
          (event.status === "active" || event.status === "scheduled") &&
          event.startsAt >= now - 6 * 60 * 60 * 1000 &&
          (!event.branchId || event.branchId === member.branchId),
      )
      .sort((a, b) => a.startsAt - b.startsAt)
      .map((event) => ({
        id: event._id,
        title: event.title,
        description: event.description ?? null,
        location: event.location ?? null,
        startsAt: event.startsAt,
        endsAt: event.endsAt ?? null,
        branchId: event.branchId ?? null,
      }));
  },
});

export const listForManagement = query({
  args: {
    scope: v.union(v.literal("national"), v.literal("local")),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const target = scopeTarget(organization._id, args.scope, args.branchId);
    await requireCapability(ctx, "event.manage", target);
    const rows = await ctx.db
      .query("events")
      .withIndex("by_organization_status", (q) => q.eq("organizationId", organization._id))
      .take(500);
    const scopedRows = rows
      .filter((event) => event.branchId === args.branchId)
      .sort((a, b) => a.startsAt - b.startsAt);
    return Promise.all(
      scopedRows.map(async (event) => ({
        ...event,
        checkInCount: (
          await ctx.db
            .query("eventCheckIns")
            .withIndex("by_event", (q) => q.eq("eventId", event._id))
            .take(event.capacity ?? 1000)
        ).length,
      })),
    );
  },
});

export const eligibleMembers = query({
  args: {
    eventId: v.id("events"),
    search: v.string(),
  },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new ConvexError("event_not_found");
    await requireCapability(ctx, "event.check_in", {
      organizationId: event.organizationId ?? organization._id,
      branchId: event.branchId,
    });
    const search = normalizeEmail(args.search);
    if (search.length < 2) return [];
    const exact = search.includes("@");
    const rows = exact
      ? [
          await ctx.db
            .query("accessGrants")
            .withIndex("by_email", (q) => q.eq("email", search))
            .unique(),
        ].filter((row): row is NonNullable<typeof row> => Boolean(row))
      : await ctx.db.query("accessGrants").take(500);
    return rows
      .filter((grant) => !event.branchId || grant.branchId === event.branchId)
      .filter(
        (grant) =>
          exact ||
          normalizeEmail(grant.fullName).includes(search) ||
          normalizeEmail(grant.email).includes(search),
      )
      .slice(0, 20)
      .map((grant) => ({
        accessGrantId: grant._id,
        fullName: grant.fullName,
        email: grant.email,
        status: effectiveAccessStatus(grant.status, grant.membershipUntil),
      }));
  },
});

export const upsertDraft = mutation({
  args: {
    id: v.optional(v.id("events")),
    scope: v.union(v.literal("national"), v.literal("local")),
    branchId: v.optional(v.id("branches")),
    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    capacity: v.optional(v.number()),
    startsAt: v.number(),
    endsAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const target = scopeTarget(organization._id, args.scope, args.branchId);
    const actor = await requireCapability(ctx, "event.manage", target);
    const title = args.title.trim();
    if (title.length < 2 || title.length > 140) throw new ConvexError("invalid_event_title");
    if (args.endsAt && args.endsAt <= args.startsAt) throw new ConvexError("invalid_event_dates");
    if (args.capacity !== undefined && (args.capacity < 1 || args.capacity > 10000)) throw new ConvexError("invalid_event_capacity");
    const now = Date.now();
    const payload = {
      organizationId: organization._id,
      title,
      description: args.description?.trim() || undefined,
      location: args.location?.trim() || undefined,
      capacity: args.capacity,
      branchId: args.branchId,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      status: "draft" as const,
      updatedAt: now,
    };
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new ConvexError("event_not_found");
      await requireCapability(ctx, "event.manage", {
        organizationId: existing.organizationId ?? organization._id,
        branchId: existing.branchId,
      });
      await ctx.db.patch(args.id, payload);
      await ctx.db.insert("auditLogs", {
        actorMemberId: actor._id,
        action: "event.updateDraft",
        entityType: "event",
        entityId: args.id,
        before: { title: existing.title, branchId: existing.branchId, startsAt: existing.startsAt, status: existing.status },
        after: { title, branchId: args.branchId, startsAt: args.startsAt, status: "draft" },
        createdAt: now,
      });
      return { status: "updated" as const, id: args.id };
    }
    const id = await ctx.db.insert("events", { ...payload, createdBy: actor._id, createdAt: now });
    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: "event.createDraft",
      entityType: "event",
      entityId: id,
      after: { title, branchId: args.branchId, startsAt: args.startsAt },
      createdAt: now,
    });
    return { status: "created" as const, id };
  },
});

export const publish = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const event = await ctx.db.get(args.id);
    if (!event) throw new ConvexError("event_not_found");
    const actor = await requireCapability(ctx, "event.manage", {
      organizationId: event.organizationId ?? organization._id,
      branchId: event.branchId,
    });
    const now = Date.now();
    const status = event.startsAt > now ? ("scheduled" as const) : ("active" as const);
    await ctx.db.patch(args.id, { status, updatedAt: now });
    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: "event.publish",
      entityType: "event",
      entityId: args.id,
      before: { status: event.status },
      after: { status },
      createdAt: now,
    });
    return { status };
  },
});

export const checkIn = mutation({
  args: {
    eventId: v.id("events"),
    accessGrantId: v.id("accessGrants"),
  },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new ConvexError("event_not_found");
    const actor = await requireCapability(ctx, "event.check_in", {
      organizationId: event.organizationId ?? organization._id,
      branchId: event.branchId,
    });
    if (event.status !== "active" && event.status !== "scheduled") throw new ConvexError("event_not_active");
    const member = await ctx.db
      .query("members")
      .withIndex("by_accessGrantId", (q) => q.eq("accessGrantId", args.accessGrantId))
      .unique();
    if (!member) throw new ConvexError("member_not_synced");
    const grant = await ctx.db.get(args.accessGrantId);
    if (!grant || grant.status !== "active" || grant.membershipUntil < Date.now()) throw new ConvexError("membership_inactive");
    if (event.branchId && grant.branchId !== event.branchId) throw new ConvexError("branch_scope_mismatch");
    const existing = await ctx.db
      .query("eventCheckIns")
      .withIndex("by_event_member", (q) => q.eq("eventId", event._id).eq("memberId", member._id))
      .unique();
    if (existing) return { status: "already_checked_in" as const, checkedInAt: existing.checkedInAt };
    if (event.capacity) {
      const checkIns = await ctx.db.query("eventCheckIns").withIndex("by_event", (q) => q.eq("eventId", event._id)).take(event.capacity);
      if (checkIns.length >= event.capacity) throw new ConvexError("event_capacity_reached");
    }
    const now = Date.now();
    await ctx.db.insert("eventCheckIns", { eventId: event._id, memberId: member._id, checkedInBy: actor._id, checkedInAt: now });
    return { status: "checked_in" as const, checkedInAt: now };
  },
});

export const attendees = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new ConvexError("event_not_found");
    await requireCapability(ctx, "event.manage", {
      organizationId: event.organizationId ?? organization._id,
      branchId: event.branchId,
    });
    const rows = await ctx.db.query("eventCheckIns").withIndex("by_event", (q) => q.eq("eventId", event._id)).take(1000);
    return Promise.all(rows.map(async (row) => {
      const member = await ctx.db.get(row.memberId);
      return { id: row._id, fullName: member?.fullName ?? "Neaktivní člen", checkedInAt: row.checkedInAt };
    }));
  },
});
