import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { effectiveAccessStatus, normalizeEmail } from "./access";
import {
  capabilitiesForPreset,
  legacyPresetForRole,
  presetHasCapability,
  scopeAllows,
  type Capability,
  type StaffPreset,
} from "./permissions";

export { effectiveAccessStatus, normalizeEmail } from "./access";

export type AuthCtx = QueryCtx | MutationCtx;
export type ElevatedRole = "board" | "admin";
export type ResourceScope = {
  organizationId: Id<"organizations">;
  branchId?: Id<"branches">;
};

const elevatedRoles = new Set<string>(["board", "admin"]);
const managerRoles = new Set<string>(["manager", "board", "admin"]);

export async function getAuthenticatedUser(ctx: AuthCtx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("unauthenticated");
  }

  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError("auth_user_not_found");
  }

  return user;
}

export async function getCurrentMember(ctx: AuthCtx): Promise<Doc<"members">> {
  const user = await getAuthenticatedUser(ctx);
  const member = await ctx.db
    .query("members")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .unique();

  if (!member) {
    throw new ConvexError("member_not_synced");
  }

  return member;
}

export async function requireActiveMember(ctx: AuthCtx): Promise<Doc<"members">> {
  const member = await getCurrentMember(ctx);
  const accessGrant = member.accessGrantId
    ? await ctx.db.get(member.accessGrantId)
    : await ctx.db
        .query("accessGrants")
        .withIndex("by_email", (q) => q.eq("email", normalizeEmail(member.email)))
        .unique();

  if (!accessGrant || normalizeEmail(accessGrant.email) !== normalizeEmail(member.email)) {
    throw new ConvexError("membership_inactive");
  }

  const status = effectiveAccessStatus(accessGrant.status, accessGrant.membershipUntil);

  if (status !== "active") {
    throw new ConvexError("membership_inactive");
  }

  return {
    ...member,
    email: accessGrant.email,
    fullName: accessGrant.fullName,
    role: accessGrant.role,
    branchId: accessGrant.branchId,
    membershipUntil: accessGrant.membershipUntil,
    status: accessGrant.status,
  };
}

export async function requireBoardOrAdmin(ctx: AuthCtx): Promise<Doc<"members">> {
  const member = await requireActiveMember(ctx);

  if (elevatedRoles.has(member.role)) return member;

  const assignments = await getActiveStaffAssignments(ctx, member);
  if (!assignments.some((assignment) => elevatedRoles.has(assignment.preset))) {
    throw new ConvexError("forbidden");
  }

  return member;
}

export async function requireManagerBoardOrAdmin(ctx: AuthCtx): Promise<Doc<"members">> {
  const member = await requireActiveMember(ctx);

  if (managerRoles.has(member.role)) return member;

  const assignments = await getActiveStaffAssignments(ctx, member);
  if (!assignments.some((assignment) => managerRoles.has(assignment.preset))) {
    throw new ConvexError("forbidden");
  }

  return member;
}

export function canManageBranch(member: Doc<"members">, branchId: Id<"branches"> | undefined): boolean {
  if (elevatedRoles.has(member.role)) {
    return true;
  }

  if (member.role !== "manager") {
    return false;
  }

  return !!branchId && !!member.branchId && branchId === member.branchId;
}

function assignmentIsActive(assignment: Doc<"staffAssignments">, now = Date.now()): boolean {
  return assignment.status === "active" && (!assignment.validUntil || assignment.validUntil >= now);
}

export async function getActiveStaffAssignments(
  ctx: AuthCtx,
  member: Doc<"members">,
): Promise<Doc<"staffAssignments">[]> {
  if (!member.accessGrantId) return [];
  const assignments = await ctx.db
    .query("staffAssignments")
    .withIndex("by_accessGrant_status", (q) =>
      q.eq("accessGrantId", member.accessGrantId!).eq("status", "active"),
    )
    .take(100);
  return assignments.filter((assignment) => assignmentIsActive(assignment));
}

export async function hasCapability(
  ctx: AuthCtx,
  member: Doc<"members">,
  capability: Capability,
  target: ResourceScope,
): Promise<boolean> {
  const assignments = await getActiveStaffAssignments(ctx, member);

  if (
    assignments.some(
      (assignment) =>
        presetHasCapability(assignment.preset as StaffPreset, capability) &&
        scopeAllows({
          assignmentScope: assignment.scope,
          assignmentOrganizationId: assignment.organizationId,
          assignmentBranchId: assignment.branchId,
          targetOrganizationId: target.organizationId,
          targetBranchId: target.branchId,
        }),
    )
  ) {
    return true;
  }

  const legacyPreset = legacyPresetForRole(member.role);
  if (!legacyPreset || !presetHasCapability(legacyPreset, capability)) return false;

  if (legacyPreset === "board" || legacyPreset === "admin") return true;
  return Boolean(target.branchId && member.branchId && target.branchId === member.branchId);
}

export async function requireCapability(
  ctx: AuthCtx,
  capability: Capability,
  target: ResourceScope,
): Promise<Doc<"members">> {
  const member = await requireActiveMember(ctx);
  if (!(await hasCapability(ctx, member, capability, target))) {
    throw new ConvexError("forbidden");
  }
  return member;
}

export async function effectiveCapabilities(
  ctx: AuthCtx,
  member: Doc<"members">,
): Promise<Capability[]> {
  const capabilities = new Set<Capability>();
  const assignments = await getActiveStaffAssignments(ctx, member);
  for (const assignment of assignments) {
    for (const capability of capabilitiesForPreset(assignment.preset as StaffPreset)) {
      capabilities.add(capability);
    }
  }

  const legacyPreset = legacyPresetForRole(member.role);
  if (legacyPreset) {
    for (const capability of capabilitiesForPreset(legacyPreset)) capabilities.add(capability);
  }
  return Array.from(capabilities).sort();
}
