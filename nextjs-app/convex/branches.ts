import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireActiveMember, requireBoardOrAdmin } from "./authz";

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    await requireActiveMember(ctx);
    const rows = await ctx.db
      .query("branches")
      .withIndex("by_active", (q) => q.eq("active", true))
      .take(200);
    return rows
      .sort((a, b) => a.name.localeCompare(b.name, "cs"))
      .map((branch) => ({ id: branch._id, name: branch.name, city: branch.city }));
  },
});

export const listForAdmin = query({
  args: {
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireBoardOrAdmin(ctx);

    const rows = args.includeInactive
      ? await ctx.db.query("branches").take(200)
      : await ctx.db
          .query("branches")
          .withIndex("by_active", (q) => q.eq("active", true))
          .take(200);

    return rows
      .sort((a, b) => a.name.localeCompare(b.name, "cs"))
      .map((branch) => ({
        id: branch._id,
        name: branch.name,
        city: branch.city,
        active: branch.active,
        updatedAt: branch.updatedAt,
      }));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    city: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireBoardOrAdmin(ctx);
    const name = args.name.trim();
    const city = args.city.trim();

    if (!name || !city) {
      throw new ConvexError("missing_branch_fields");
    }

    const now = Date.now();
    const id = await ctx.db.insert("branches", {
      name,
      city,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: "branch.create",
      entityType: "branch",
      entityId: id,
      after: { name, city, active: true },
      createdAt: now,
    });

    return { status: "created" as const, id };
  },
});

export const setActive = mutation({
  args: {
    id: v.id("branches"),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const actor = await requireBoardOrAdmin(ctx);
    const existing = await ctx.db.get(args.id);

    if (!existing) {
      throw new ConvexError("branch_not_found");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      active: args.active,
      updatedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: args.active ? "branch.activate" : "branch.deactivate",
      entityType: "branch",
      entityId: args.id,
      before: existing,
      after: { ...existing, active: args.active, updatedAt: now },
      createdAt: now,
    });

    return { status: "updated" as const };
  },
});
