import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { assignmentScope, staffPreset } from "./schema";
import {
  effectiveCapabilities,
  getActiveStaffAssignments,
  requireActiveMember,
  requireCapability,
} from "./authz";
import { legacyPresetForRole, type StaffPreset } from "./permissions";

const DEFAULT_ORGANIZATION_SLUG = "psychocas";

function assignmentIsCurrent(assignment: Doc<"staffAssignments">, now = Date.now()): boolean {
  return assignment.status === "active" && (!assignment.validUntil || assignment.validUntil >= now);
}

async function presentAssignment(ctx: QueryCtx, assignment: Doc<"staffAssignments">) {
  const [grant, branch] = await Promise.all([
    ctx.db.get(assignment.accessGrantId),
    assignment.branchId ? ctx.db.get(assignment.branchId) : null,
  ]);

  return {
    id: assignment._id,
    accessGrantId: assignment.accessGrantId,
    memberId: assignment.memberId ?? null,
    email: grant?.email ?? null,
    fullName: grant?.fullName ?? null,
    preset: assignment.preset,
    scope: assignment.scope,
    organizationId: assignment.organizationId,
    branch: branch ? { id: branch._id, name: branch.name, city: branch.city } : null,
    status: assignment.status,
    validUntil: assignment.validUntil ?? null,
    reason: assignment.reason ?? null,
    updatedAt: assignment.updatedAt,
  };
}

export const ensureBootstrap = mutation({
  args: {},
  handler: async (ctx) => {
    const actor = await requireActiveMember(ctx);
    const now = Date.now();
    let organization = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", DEFAULT_ORGANIZATION_SLUG))
      .unique();

    if (!organization) {
      const organizationId = await ctx.db.insert("organizations", {
        name: "Psychočas",
        slug: DEFAULT_ORGANIZATION_SLUG,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      organization = await ctx.db.get(organizationId);
    }

    if (!organization) throw new ConvexError("organization_unavailable");

    const preset = legacyPresetForRole(actor.role);
    if (!preset || !actor.accessGrantId) {
      return { organizationId: organization._id, assignmentId: null };
    }

    const scope = preset === "manager" ? "branch" : "organization";
    const branchId = scope === "branch" ? actor.branchId : undefined;
    if (scope === "branch" && !branchId) throw new ConvexError("manager_branch_required");

    if (branchId) {
      const branch = await ctx.db.get(branchId);
      if (branch && !branch.organizationId) {
        await ctx.db.patch(branchId, { organizationId: organization._id, updatedAt: now });
      }
    }

    const existing = await ctx.db
      .query("staffAssignments")
      .withIndex("by_grant_preset_scope", (q) =>
        q
          .eq("accessGrantId", actor.accessGrantId!)
          .eq("preset", preset)
          .eq("organizationId", organization!._id)
          .eq("branchId", branchId),
      )
      .unique();

    if (existing) {
      if (!assignmentIsCurrent(existing) || existing.memberId !== actor._id) {
        await ctx.db.patch(existing._id, {
          memberId: actor._id,
          status: "active",
          revokedAt: undefined,
          validUntil: undefined,
          updatedBy: actor._id,
          updatedAt: now,
        });
      }
      return { organizationId: organization._id, assignmentId: existing._id };
    }

    const assignmentId = await ctx.db.insert("staffAssignments", {
      accessGrantId: actor.accessGrantId,
      memberId: actor._id,
      preset,
      scope,
      organizationId: organization._id,
      branchId,
      status: "active",
      reason: "Migrated from the original Psychočas role.",
      createdBy: actor._id,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: "staffAssignment.bootstrap",
      entityType: "staffAssignment",
      entityId: assignmentId,
      after: { preset, scope, organizationId: organization._id, branchId },
      createdAt: now,
    });

    return { organizationId: organization._id, assignmentId };
  },
});

export const viewerAccess = query({
  args: {},
  handler: async (ctx) => {
    const member = await requireActiveMember(ctx);
    const assignments = await getActiveStaffAssignments(ctx, member);
    const capabilities = await effectiveCapabilities(ctx, member);

    return {
      legacyRole: member.role,
      capabilities,
      assignments: assignments.map((assignment) => ({
        id: assignment._id,
        preset: assignment.preset,
        scope: assignment.scope,
        organizationId: assignment.organizationId,
        branchId: assignment.branchId ?? null,
        validUntil: assignment.validUntil ?? null,
      })),
    };
  },
});

export const listOrganizations = query({
  args: {},
  handler: async (ctx) => {
    await requireActiveMember(ctx);
    const organizations = await ctx.db
      .query("organizations")
      .withIndex("by_active", (q) => q.eq("active", true))
      .take(20);
    return organizations.map((organization) => ({
      id: organization._id,
      name: organization.name,
      slug: organization.slug,
    }));
  },
});

export const listAssignments = query({
  args: {
    organizationId: v.id("organizations"),
    includeRevoked: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireCapability(ctx, "assignment.manage", { organizationId: args.organizationId });
    const assignments = args.includeRevoked
      ? await ctx.db
          .query("staffAssignments")
          .withIndex("by_organization_status", (q) => q.eq("organizationId", args.organizationId))
          .take(500)
      : await ctx.db
          .query("staffAssignments")
          .withIndex("by_organization_status", (q) =>
            q.eq("organizationId", args.organizationId).eq("status", "active"),
          )
          .take(500);

    return Promise.all(assignments.map((assignment) => presentAssignment(ctx, assignment)));
  },
});

export const upsertAssignment = mutation({
  args: {
    accessGrantId: v.id("accessGrants"),
    preset: staffPreset,
    scope: assignmentScope,
    organizationId: v.id("organizations"),
    branchId: v.optional(v.id("branches")),
    validUntil: v.optional(v.number()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireCapability(ctx, "assignment.manage", {
      organizationId: args.organizationId,
    });
    const [organization, grant] = await Promise.all([
      ctx.db.get(args.organizationId),
      ctx.db.get(args.accessGrantId),
    ]);
    if (!organization?.active) throw new ConvexError("organization_not_found");
    if (!grant) throw new ConvexError("access_grant_not_found");

    const preset = args.preset as StaffPreset;
    if ((preset === "board" || preset === "admin") && args.scope !== "organization") {
      throw new ConvexError("elevated_scope_must_be_organization");
    }
    if (preset === "manager" && args.scope !== "branch") {
      throw new ConvexError("manager_scope_must_be_branch");
    }
    if (args.scope === "branch" && !args.branchId) throw new ConvexError("branch_required");
    if (args.scope === "organization" && args.branchId) throw new ConvexError("branch_not_allowed");

    let branch: Doc<"branches"> | null = null;
    if (args.branchId) {
      branch = await ctx.db.get(args.branchId);
      if (!branch?.active) throw new ConvexError("branch_not_found");
      if (branch.organizationId && branch.organizationId !== args.organizationId) {
        throw new ConvexError("branch_scope_mismatch");
      }
    }

    const member = await ctx.db
      .query("members")
      .withIndex("by_accessGrantId", (q) => q.eq("accessGrantId", args.accessGrantId))
      .unique();
    const now = Date.now();
    if (branch && !branch.organizationId) {
      await ctx.db.patch(branch._id, { organizationId: args.organizationId, updatedAt: now });
    }

    const existing = await ctx.db
      .query("staffAssignments")
      .withIndex("by_grant_preset_scope", (q) =>
        q
          .eq("accessGrantId", args.accessGrantId)
          .eq("preset", args.preset)
          .eq("organizationId", args.organizationId)
          .eq("branchId", args.branchId),
      )
      .unique();
    const patch = {
      memberId: member?._id,
      status: "active" as const,
      validUntil: args.validUntil,
      reason: args.reason?.trim() || undefined,
      revokedAt: undefined,
      updatedBy: actor._id,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      await ctx.db.insert("auditLogs", {
        actorMemberId: actor._id,
        action: "staffAssignment.update",
        entityType: "staffAssignment",
        entityId: existing._id,
        before: { preset: existing.preset, scope: existing.scope, status: existing.status },
        after: { preset: args.preset, scope: args.scope, status: "active" },
        summary: args.reason?.trim() || undefined,
        createdAt: now,
      });
      return { status: "updated" as const, id: existing._id };
    }

    const id = await ctx.db.insert("staffAssignments", {
      accessGrantId: args.accessGrantId,
      memberId: member?._id,
      preset: args.preset,
      scope: args.scope,
      organizationId: args.organizationId,
      branchId: args.branchId,
      status: "active",
      validUntil: args.validUntil,
      reason: args.reason?.trim() || undefined,
      createdBy: actor._id,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: "staffAssignment.create",
      entityType: "staffAssignment",
      entityId: id,
      after: { preset: args.preset, scope: args.scope, organizationId: args.organizationId, branchId: args.branchId },
      summary: args.reason?.trim() || undefined,
      createdAt: now,
    });
    return { status: "created" as const, id };
  },
});

export const revokeAssignment = mutation({
  args: {
    id: v.id("staffAssignments"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get(args.id);
    if (!assignment) throw new ConvexError("assignment_not_found");
    const actor = await requireCapability(ctx, "assignment.manage", {
      organizationId: assignment.organizationId,
      branchId: assignment.branchId,
    });
    if (assignment.status === "revoked") return { status: "already_revoked" as const };

    if (assignment.preset === "board" || assignment.preset === "admin") {
      const organizationAssignments = await ctx.db
        .query("staffAssignments")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", assignment.organizationId).eq("status", "active"),
        )
        .take(500);
      const elevated = organizationAssignments.filter(
        (row) =>
          assignmentIsCurrent(row) && (row.preset === "board" || row.preset === "admin"),
      );
      if (elevated.length <= 1) throw new ConvexError("last_elevated_assignment");
    }

    const reason = args.reason.trim();
    if (!reason) throw new ConvexError("revoke_reason_required");
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "revoked",
      reason,
      revokedAt: now,
      updatedBy: actor._id,
      updatedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      actorMemberId: actor._id,
      action: "staffAssignment.revoke",
      entityType: "staffAssignment",
      entityId: args.id,
      before: { preset: assignment.preset, scope: assignment.scope, status: assignment.status },
      after: { status: "revoked" },
      summary: reason,
      createdAt: now,
    });
    return { status: "revoked" as const };
  },
});
