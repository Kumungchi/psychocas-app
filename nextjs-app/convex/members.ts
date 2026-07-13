import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { accessStatus, memberRole } from "./schema";
import {
  effectiveAccessStatus,
  getAuthenticatedUser,
  normalizeEmail,
  requireBoardOrAdmin,
} from "./authz";
import { isAuthAccessError, syncAuthUserToAccessGrant } from "./authMembership";

const accessGrantFields = {
  email: v.string(),
  fullName: v.string(),
  role: memberRole,
  branchId: v.optional(v.id("branches")),
  membershipUntil: v.number(),
  status: accessStatus,
  notes: v.optional(v.string()),
};

const accessGrantPatch = {
  role: v.optional(memberRole),
  branchId: v.optional(v.union(v.id("branches"), v.null())),
  membershipUntil: v.optional(v.number()),
  status: v.optional(accessStatus),
  notes: v.optional(v.string()),
};

function presentMember(
  member: Doc<"members">,
  accessGrant: Doc<"accessGrants">,
  branch: Doc<"branches"> | null,
) {
  const status = effectiveAccessStatus(accessGrant.status, accessGrant.membershipUntil);
  return {
    id: member._id,
    email: accessGrant.email,
    fullName: accessGrant.fullName,
    role: accessGrant.role,
    branchId: accessGrant.branchId ?? null,
    branch: branch
      ? {
          id: branch._id,
          name: branch.name,
          city: branch.city,
        }
      : null,
    membershipUntil: accessGrant.membershipUntil,
    status,
    membershipActive: status === "active",
    lastSeenAt: member.lastSeenAt ?? null,
    lastSyncedAt: member.lastSyncedAt ?? null,
  };
}

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx).catch(() => null);
    if (!user) {
      return { status: "unauthenticated" as const, user: null, member: null, accessGrant: null };
    }

    const email = user.email ? normalizeEmail(user.email) : null;
    const member = await ctx.db
      .query("members")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (member) {
      const accessGrant = member.accessGrantId
        ? await ctx.db.get(member.accessGrantId)
        : email
          ? await ctx.db
              .query("accessGrants")
              .withIndex("by_email", (q) => q.eq("email", email))
              .unique()
          : null;

      if (
        !accessGrant ||
        effectiveAccessStatus(accessGrant.status, accessGrant.membershipUntil) !== "active"
      ) {
        return {
          status: "not_allowed" as const,
          user: {
            id: user._id,
            email: user.email ?? null,
            name: user.name ?? user.fullName ?? null,
          },
          member: null,
          accessGrant: null,
        };
      }

      const branch = accessGrant.branchId ? await ctx.db.get(accessGrant.branchId) : null;
      return {
        status: "ready" as const,
        user: {
          id: user._id,
          email: user.email ?? null,
          name: user.name ?? user.fullName ?? null,
        },
        member: presentMember(member, accessGrant, branch),
        accessGrant: null,
      };
    }

    const accessGrant = email
      ? await ctx.db
          .query("accessGrants")
          .withIndex("by_email", (q) => q.eq("email", email))
          .unique()
      : null;

    return {
      status: accessGrant ? ("needs_sync" as const) : ("not_allowed" as const),
      user: {
        id: user._id,
        email: user.email ?? null,
        name: user.name ?? user.fullName ?? null,
      },
      member: null,
      accessGrant: accessGrant
        ? {
            id: accessGrant._id,
            email: accessGrant.email,
            status: effectiveAccessStatus(accessGrant.status, accessGrant.membershipUntil),
            role: accessGrant.role,
            membershipUntil: accessGrant.membershipUntil,
          }
        : null,
    };
  },
});

export const ensureViewer = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    try {
      const { member, accessGrant } = await syncAuthUserToAccessGrant(ctx, user._id);
      const branch = accessGrant.branchId ? await ctx.db.get(accessGrant.branchId) : null;
      return {
        status: "ready" as const,
        member: presentMember(member, accessGrant, branch),
      };
    } catch (error) {
      if (isAuthAccessError(error)) {
        return { status: "not_allowed" as const, member: null };
      }
      throw error;
    }
  },
});

export const listAccessGrants = query({
  args: {
    status: v.optional(accessStatus),
    role: v.optional(memberRole),
    branchId: v.optional(v.id("branches")),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireBoardOrAdmin(ctx);

    const limit = Math.min(args.limit ?? 100, 250);
    let rows: Doc<"accessGrants">[];
    const status = args.status;
    const branchId = args.branchId;

    if (branchId && status) {
      rows = await ctx.db
        .query("accessGrants")
        .withIndex("by_branch_status", (q) => q.eq("branchId", branchId).eq("status", status))
        .take(limit);
    } else if (status) {
      rows = await ctx.db
        .query("accessGrants")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(limit);
    } else {
      rows = await ctx.db.query("accessGrants").take(limit);
    }

    const search = args.search ? normalizeEmail(args.search) : null;
    return rows
      .filter((row) => !args.role || row.role === args.role)
      .filter((row) => !args.branchId || row.branchId === args.branchId)
      .filter((row) => {
        if (!search) return true;
        return normalizeEmail(row.email).includes(search) || normalizeEmail(row.fullName).includes(search);
      })
      .map((row) => ({
        id: row._id,
        email: row.email,
        fullName: row.fullName,
        role: row.role,
        branchId: row.branchId ?? null,
        membershipUntil: row.membershipUntil,
        status: effectiveAccessStatus(row.status, row.membershipUntil),
        notes: row.notes ?? null,
        updatedAt: row.updatedAt,
      }));
  },
});

export const upsertAccessGrant = mutation({
  args: accessGrantFields,
  handler: async (ctx, args) => {
    const actor = await requireBoardOrAdmin(ctx);
    const now = Date.now();
    const email = normalizeEmail(args.email);
    const existing = await ctx.db
      .query("accessGrants")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    const payload = {
      email,
      fullName: args.fullName.trim(),
      role: args.role,
      branchId: args.branchId,
      membershipUntil: args.membershipUntil,
      status: args.status,
      notes: args.notes?.trim() || undefined,
      source: "manual" as const,
      updatedBy: actor._id,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      await ctx.db.insert("auditLogs", {
        actorMemberId: actor._id,
        action: "accessGrant.update",
        entityType: "accessGrant",
        entityId: existing._id,
        before: existing,
        after: { ...existing, ...payload },
        createdAt: now,
      });
      return { status: "updated" as const, id: existing._id };
    }

    const id = await ctx.db.insert("accessGrants", {
      ...payload,
      createdBy: actor._id,
      createdAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: "accessGrant.create",
      entityType: "accessGrant",
      entityId: id,
      after: { ...payload, createdAt: now },
      createdAt: now,
    });

    return { status: "created" as const, id };
  },
});

export const bulkUpdateAccessGrants = mutation({
  args: {
    ids: v.array(v.id("accessGrants")),
    patch: v.object(accessGrantPatch),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireBoardOrAdmin(ctx);

    if (args.ids.length === 0) {
      throw new ConvexError("no_rows_selected");
    }

    if (args.ids.length > 250) {
      throw new ConvexError("too_many_rows_selected");
    }

    const patchEntries = Object.entries(args.patch).filter(([, value]) => value !== undefined);
    if (patchEntries.length === 0) {
      throw new ConvexError("empty_patch");
    }

    const now = Date.now();
    const changed: Id<"accessGrants">[] = [];
    const before: Doc<"accessGrants">[] = [];
    const normalizedPatch: Partial<Doc<"accessGrants">> = {
      updatedBy: actor._id,
      updatedAt: now,
    };

    if (args.patch.role !== undefined) normalizedPatch.role = args.patch.role;
    if (args.patch.branchId !== undefined) {
      normalizedPatch.branchId = args.patch.branchId === null ? undefined : args.patch.branchId;
    }
    if (args.patch.membershipUntil !== undefined) {
      normalizedPatch.membershipUntil = args.patch.membershipUntil;
    }
    if (args.patch.status !== undefined) normalizedPatch.status = args.patch.status;
    if (args.patch.notes !== undefined) normalizedPatch.notes = args.patch.notes.trim() || undefined;

    for (const id of args.ids) {
      const row = await ctx.db.get(id);
      if (!row) {
        continue;
      }
      before.push(row);
      await ctx.db.patch(id, normalizedPatch);
      changed.push(id);
    }

    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: "accessGrant.bulkUpdate",
      entityType: "accessGrant",
      entityId: "bulk",
      before,
      after: { ids: changed, patch: normalizedPatch },
      summary: args.reason ?? `Bulk updated ${changed.length} access grants`,
      createdAt: now,
    });

    return {
      status: "updated" as const,
      requestedCount: args.ids.length,
      updatedCount: changed.length,
      skippedCount: args.ids.length - changed.length,
    };
  },
});
