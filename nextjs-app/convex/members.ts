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
  id: v.optional(v.id("accessGrants")),
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

const accessGrantImportRow = {
  email: v.string(),
  fullName: v.string(),
  role: memberRole,
  branchId: v.optional(v.id("branches")),
  membershipUntil: v.number(),
  status: accessStatus,
  notes: v.optional(v.string()),
};

const MAX_IMPORT_ROWS = 250;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatedImportEmail(value: string): string {
  const email = normalizeEmail(value);
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new ConvexError("invalid_import_email");
  }
  return email;
}

function validateImportBatchSize(length: number): void {
  if (length === 0) throw new ConvexError("empty_import");
  if (length > MAX_IMPORT_ROWS) throw new ConvexError("too_many_import_rows");
}

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
    const existingByEmail = await ctx.db
      .query("accessGrants")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    const existing = args.id ? await ctx.db.get(args.id) : existingByEmail;
    if (args.id && !existing) throw new ConvexError("access_grant_not_found");
    if (args.id && existingByEmail && existingByEmail._id !== args.id) {
      throw new ConvexError("email_already_allowed");
    }
    if (args.id && existing && normalizeEmail(existing.email) !== email) {
      throw new ConvexError("access_grant_email_immutable");
    }

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

export const previewAccessGrantImport = query({
  args: {
    emails: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireBoardOrAdmin(ctx);
    validateImportBatchSize(args.emails.length);

    const normalizedEmails = args.emails.map(validatedImportEmail);
    if (new Set(normalizedEmails).size !== normalizedEmails.length) {
      throw new ConvexError("duplicate_import_email");
    }

    const existingEmails: string[] = [];
    for (const email of normalizedEmails) {
      const existing = await ctx.db
        .query("accessGrants")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (existing) existingEmails.push(email);
    }

    return {
      totalCount: normalizedEmails.length,
      newCount: normalizedEmails.length - existingEmails.length,
      existingCount: existingEmails.length,
      existingEmails,
    };
  },
});

export const importAccessGrants = mutation({
  args: {
    rows: v.array(v.object(accessGrantImportRow)),
    updateExisting: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireBoardOrAdmin(ctx);
    validateImportBatchSize(args.rows.length);

    const now = Date.now();
    const reason = args.reason?.trim();
    if (reason && reason.length > 300) throw new ConvexError("import_reason_too_long");

    const seenEmails = new Set<string>();
    const branchCache = new Map<Id<"branches">, Doc<"branches">>();
    const prepared: Array<{
      email: string;
      fullName: string;
      role: Doc<"accessGrants">["role"];
      branchId?: Id<"branches">;
      membershipUntil: number;
      status: Doc<"accessGrants">["status"];
      notes?: string;
      existing: Doc<"accessGrants"> | null;
    }> = [];

    for (const row of args.rows) {
      const email = validatedImportEmail(row.email);
      if (seenEmails.has(email)) throw new ConvexError("duplicate_import_email");
      seenEmails.add(email);

      const fullName = row.fullName.trim();
      const notes = row.notes?.trim() || undefined;
      if (!fullName || fullName.length > 120) throw new ConvexError("invalid_import_name");
      if (notes && notes.length > 500) throw new ConvexError("import_notes_too_long");
      if (!Number.isFinite(row.membershipUntil) || row.membershipUntil <= 0) {
        throw new ConvexError("invalid_import_membership_date");
      }
      if (row.status === "active" && row.membershipUntil < now) {
        throw new ConvexError("active_import_membership_expired");
      }

      if (row.branchId) {
        let branch = branchCache.get(row.branchId);
        if (!branch) {
          branch = (await ctx.db.get(row.branchId)) ?? undefined;
          if (!branch) throw new ConvexError("import_branch_not_found");
          branchCache.set(row.branchId, branch);
        }
        if (row.status === "active" && !branch.active) {
          throw new ConvexError("import_branch_inactive");
        }
      }

      const existing = await ctx.db
        .query("accessGrants")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();

      prepared.push({
        email,
        fullName,
        role: row.role,
        branchId: row.branchId,
        membershipUntil: row.membershipUntil,
        status: row.status,
        notes,
        existing,
      });
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let protectedCount = 0;

    for (const row of prepared) {
      const payload = {
        email: row.email,
        fullName: row.fullName,
        role: row.role,
        branchId: row.branchId,
        membershipUntil: row.membershipUntil,
        status: row.status,
        notes: row.notes,
        source: "import" as const,
        updatedBy: actor._id,
        updatedAt: now,
      };

      if (row.existing) {
        if (!args.updateExisting) {
          skippedCount += 1;
          continue;
        }
        if (
          actor.accessGrantId === row.existing._id ||
          normalizeEmail(actor.email) === row.email
        ) {
          protectedCount += 1;
          continue;
        }
        await ctx.db.patch(row.existing._id, payload);
        updatedCount += 1;
        continue;
      }

      await ctx.db.insert("accessGrants", {
        ...payload,
        createdBy: actor._id,
        createdAt: now,
      });
      createdCount += 1;
    }

    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: "accessGrant.csvImport",
      entityType: "accessGrant",
      entityId: "csv-import",
      after: {
        totalCount: prepared.length,
        createdCount,
        updatedCount,
        skippedCount,
        protectedCount,
        updateExisting: args.updateExisting,
      },
      summary:
        reason ||
        `CSV import: ${createdCount} created, ${updatedCount} updated, ${skippedCount + protectedCount} skipped`,
      createdAt: now,
    });

    return {
      status: "completed" as const,
      totalCount: prepared.length,
      createdCount,
      updatedCount,
      skippedCount,
      protectedCount,
    };
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
