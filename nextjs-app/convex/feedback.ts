import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireActiveMember, requireCapability } from "./authz";
import { getDefaultOrganization } from "./organization";

const feedbackCategory = v.union(
  v.literal("app"),
  v.literal("offer"),
  v.literal("partner"),
  v.literal("other"),
);

export const submit = mutation({
  args: { category: feedbackCategory, message: v.string() },
  handler: async (ctx, args) => {
    const member = await requireActiveMember(ctx);
    const message = args.message.trim();
    if (message.length < 10 || message.length > 2000) throw new ConvexError("invalid_feedback");
    const now = Date.now();
    const id = await ctx.db.insert("feedback", {
      memberId: member._id,
      category: args.category,
      message,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
    return { status: "submitted" as const, id };
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const member = await requireActiveMember(ctx);
    return ctx.db
      .query("feedback")
      .withIndex("by_member_createdAt", (q) => q.eq("memberId", member._id))
      .order("desc")
      .take(30);
  },
});

export const submitPartnerSuggestion = mutation({
  args: {
    partnerName: v.string(),
    website: v.optional(v.string()),
    note: v.optional(v.string()),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const member = await requireActiveMember(ctx);
    const partnerName = args.partnerName.trim();
    if (partnerName.length < 2 || partnerName.length > 120) throw new ConvexError("invalid_partner_name");
    if (args.note && args.note.length > 1200) throw new ConvexError("suggestion_note_too_long");
    if (args.branchId && member.branchId !== args.branchId) throw new ConvexError("branch_scope_mismatch");
    const now = Date.now();
    const id = await ctx.db.insert("partnerSuggestions", {
      suggestedBy: member._id,
      partnerName,
      website: args.website?.trim() || undefined,
      note: args.note?.trim() || undefined,
      branchId: args.branchId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return { status: "submitted" as const, id };
  },
});

export const myPartnerSuggestions = query({
  args: {},
  handler: async (ctx) => {
    const member = await requireActiveMember(ctx);
    return ctx.db
      .query("partnerSuggestions")
      .withIndex("by_suggestedBy_createdAt", (q) => q.eq("suggestedBy", member._id))
      .order("desc")
      .take(30);
  },
});

export const listPartnerSuggestions = query({
  args: {
    scope: v.union(v.literal("national"), v.literal("local")),
    branchId: v.optional(v.id("branches")),
    status: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.literal("archived"))),
  },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    if (args.scope === "local" && !args.branchId) throw new ConvexError("branch_required");
    await requireCapability(ctx, "partner.draft", {
      organizationId: organization._id,
      branchId: args.branchId,
    });
    const rows = args.status
      ? await ctx.db
          .query("partnerSuggestions")
          .withIndex("by_branch_status", (q) => q.eq("branchId", args.branchId).eq("status", args.status!))
          .take(300)
      : await ctx.db
          .query("partnerSuggestions")
          .withIndex("by_branch_status", (q) => q.eq("branchId", args.branchId))
          .take(300);
    return Promise.all(
      rows.map(async (row) => {
        const member = await ctx.db.get(row.suggestedBy);
        return {
          id: row._id,
          partnerName: row.partnerName,
          website: row.website ?? null,
          note: row.note ?? null,
          branchId: row.branchId ?? null,
          status: row.status,
          suggestedBy: member?.fullName ?? "Člen Psychočasu",
          createdAt: row.createdAt,
        };
      }),
    );
  },
});

export const reviewPartnerSuggestion = mutation({
  args: {
    id: v.id("partnerSuggestions"),
    approve: v.boolean(),
  },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const suggestion = await ctx.db.get(args.id);
    if (!suggestion) throw new ConvexError("suggestion_not_found");
    const actor = await requireCapability(ctx, "partner.approve", {
      organizationId: organization._id,
      branchId: suggestion.branchId,
    });
    const now = Date.now();
    const status = args.approve ? ("approved" as const) : ("rejected" as const);
    await ctx.db.patch(args.id, { status, reviewedBy: actor._id, reviewedAt: now, updatedAt: now });
    return { status };
  },
});
