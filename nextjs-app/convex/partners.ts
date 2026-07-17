import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { partnerCategory } from "./schema";
import { requireCapability, type ResourceScope } from "./authz";
import { getDefaultOrganization } from "./organization";

function normalizeWebsite(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ConvexError("invalid_partner_website");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ConvexError("invalid_partner_website");
  }
  return url.toString();
}

function resourceScope(
  organizationId: Id<"organizations">,
  scope: "national" | "local",
  branchId: Id<"branches"> | undefined,
): ResourceScope {
  if (scope === "local" && !branchId) throw new ConvexError("branch_required");
  if (scope === "national" && branchId) throw new ConvexError("branch_not_allowed");
  return { organizationId, branchId };
}

function presentPartner(partner: Doc<"partners">) {
  return {
    id: partner._id,
    name: partner.name,
    category: partner.category,
    website: partner.website ?? null,
    description: partner.description ?? null,
    address: partner.address ?? null,
    scope: partner.branchId ? ("local" as const) : ("national" as const),
    branchId: partner.branchId ?? null,
    active: partner.active,
    updatedAt: partner.updatedAt,
  };
}

export const listForManagement = query({
  args: {
    scope: v.union(v.literal("national"), v.literal("local")),
    branchId: v.optional(v.id("branches")),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const target = resourceScope(organization._id, args.scope, args.branchId);
    await requireCapability(ctx, "partner.draft", target);

    const rows = args.includeInactive
      ? await ctx.db
          .query("partners")
          .withIndex("by_organization_active", (q) => q.eq("organizationId", organization._id))
          .take(300)
      : await ctx.db
          .query("partners")
          .withIndex("by_organization_branch_active", (q) =>
            q
              .eq("organizationId", organization._id)
              .eq("branchId", args.branchId)
              .eq("active", true),
          )
          .take(300);

    return rows
      .filter((row) => row.branchId === args.branchId)
      .sort((a, b) => a.name.localeCompare(b.name, "cs"))
      .map(presentPartner);
  },
});

export const upsert = mutation({
  args: {
    id: v.optional(v.id("partners")),
    name: v.string(),
    category: partnerCategory,
    website: v.optional(v.string()),
    description: v.optional(v.string()),
    address: v.optional(v.string()),
    scope: v.union(v.literal("national"), v.literal("local")),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const target = resourceScope(organization._id, args.scope, args.branchId);
    const actor = await requireCapability(ctx, "partner.draft", target);
    const name = args.name.trim();
    if (name.length < 2 || name.length > 120) throw new ConvexError("invalid_partner_name");
    if (args.description && args.description.length > 1200) {
      throw new ConvexError("partner_description_too_long");
    }
    if (args.address && args.address.length > 240) throw new ConvexError("partner_address_too_long");

    if (args.branchId) {
      const branch = await ctx.db.get(args.branchId);
      if (!branch?.active) throw new ConvexError("branch_not_found");
      if (branch.organizationId && branch.organizationId !== organization._id) {
        throw new ConvexError("branch_scope_mismatch");
      }
      if (!branch.organizationId) {
        await ctx.db.patch(branch._id, { organizationId: organization._id, updatedAt: Date.now() });
      }
    }

    const now = Date.now();
    const payload = {
      organizationId: organization._id,
      name,
      category: args.category,
      website: normalizeWebsite(args.website),
      description: args.description?.trim() || undefined,
      address: args.address?.trim() || undefined,
      branchId: args.branchId,
      updatedBy: actor._id,
      updatedAt: now,
    };

    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new ConvexError("partner_not_found");
      await requireCapability(ctx, "partner.draft", {
        organizationId: existing.organizationId ?? organization._id,
        branchId: existing.branchId,
      });
      await ctx.db.patch(args.id, payload);
      await ctx.db.insert("auditLogs", {
        actorMemberId: actor._id,
        action: "partner.update",
        entityType: "partner",
        entityId: args.id,
        before: { name: existing.name, category: existing.category, branchId: existing.branchId, active: existing.active },
        after: { name, category: args.category, branchId: args.branchId, active: existing.active },
        createdAt: now,
      });
      return { status: "updated" as const, id: args.id };
    }

    const id = await ctx.db.insert("partners", {
      ...payload,
      active: true,
      createdBy: actor._id,
      createdAt: now,
    });
    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: "partner.create",
      entityType: "partner",
      entityId: id,
      after: { name, category: args.category, branchId: args.branchId, active: true },
      createdAt: now,
    });
    return { status: "created" as const, id };
  },
});

export const setActive = mutation({
  args: { id: v.id("partners"), active: v.boolean() },
  handler: async (ctx, args) => {
    const organization = await getDefaultOrganization(ctx);
    const partner = await ctx.db.get(args.id);
    if (!partner) throw new ConvexError("partner_not_found");
    const actor = await requireCapability(ctx, "partner.approve", {
      organizationId: partner.organizationId ?? organization._id,
      branchId: partner.branchId,
    });
    const now = Date.now();
    await ctx.db.patch(args.id, { active: args.active, updatedBy: actor._id, updatedAt: now });
    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: args.active ? "partner.activate" : "partner.archive",
      entityType: "partner",
      entityId: args.id,
      before: { active: partner.active },
      after: { active: args.active },
      createdAt: now,
    });
    return { status: "updated" as const };
  },
});
