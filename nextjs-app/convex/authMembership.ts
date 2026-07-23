import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { effectiveAccessStatus, normalizeEmail } from "./access";

const BOOTSTRAP_MEMBERSHIP_MS = 365 * 24 * 60 * 60 * 1000;
const ACCESS_ERROR_CODES = new Set([
  "access_denied",
  "membership_inactive",
  "member_account_conflict",
  "missing_email",
]);

export function parseBootstrapEmails(raw = process.env.BOOTSTRAP_ADMIN_EMAILS ?? ""): Set<string> {
  return new Set(
    raw
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean),
  );
}

export function isAuthAccessError(error: unknown): boolean {
  return error instanceof Error && ACCESS_ERROR_CODES.has(error.message);
}

async function resolveOrBootstrapAccessGrant(
  ctx: MutationCtx,
  user: Doc<"users">,
): Promise<Doc<"accessGrants">> {
  if (!user.email) {
    throw new Error("missing_email");
  }

  const email = normalizeEmail(user.email);
  const existing = await ctx.db
    .query("accessGrants")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();

  if (existing) {
    return existing;
  }

  if (!parseBootstrapEmails().has(email)) {
    throw new Error("access_denied");
  }

  const existingElevated = await ctx.db
    .query("accessGrants")
    .filter((q) =>
      q.or(
        q.eq(q.field("role"), "admin"),
        q.eq(q.field("role"), "board"),
      ),
    )
    .first();

  if (existingElevated) {
    throw new Error("access_denied");
  }

  const now = Date.now();
  const fullName =
    user.fullName?.trim() ||
    user.name?.trim() ||
    email.split("@", 1)[0] ||
    "Správce Psychočasu";
  const id = await ctx.db.insert("accessGrants", {
    email,
    fullName,
    role: "admin",
    membershipUntil: now + BOOTSTRAP_MEMBERSHIP_MS,
    status: "active",
    source: "manual",
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.insert("auditLogs", {
    action: "accessGrant.bootstrap",
    entityType: "accessGrant",
    entityId: id,
    summary: "Initial admin access created during verified email sign-in.",
    createdAt: now,
  });

  const created = await ctx.db.get(id);
  if (!created) {
    throw new Error("access_denied");
  }
  return created;
}

export async function syncAuthUserToAccessGrant(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<{ member: Doc<"members">; accessGrant: Doc<"accessGrants"> }> {
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("access_denied");
  }

  const accessGrant = await resolveOrBootstrapAccessGrant(ctx, user);
  const status = effectiveAccessStatus(accessGrant.status, accessGrant.membershipUntil);
  if (status !== "active") {
    throw new Error("membership_inactive");
  }

  const byUser = await ctx.db
    .query("members")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  const byGrant = await ctx.db
    .query("members")
    .withIndex("by_accessGrantId", (q) => q.eq("accessGrantId", accessGrant._id))
    .unique();

  if (byUser && byGrant && byUser._id !== byGrant._id) {
    throw new Error("member_account_conflict");
  }
  if (byGrant?.userId && byGrant.userId !== userId) {
    throw new Error("member_account_conflict");
  }

  const now = Date.now();
  const memberPatch = {
    userId,
    accessGrantId: accessGrant._id,
    authSubject: userId,
    email: accessGrant.email,
    fullName: accessGrant.fullName,
    role: accessGrant.role,
    branchId: accessGrant.branchId,
    membershipUntil: accessGrant.membershipUntil,
    status: accessGrant.status,
    lastSyncedAt: now,
    lastSeenAt: now,
    updatedAt: now,
  };

  const existing = byUser ?? byGrant;
  const shouldScheduleWelcome = !existing?.welcomeEmailStatus;
  let memberId: Id<"members">;
  if (existing) {
    await ctx.db.patch(existing._id, {
      ...memberPatch,
      ...(shouldScheduleWelcome
        ? { welcomeEmailStatus: "scheduled" as const, welcomeEmailAttempts: 0 }
        : {}),
    });
    memberId = existing._id;
  } else {
    memberId = await ctx.db.insert("members", {
      ...memberPatch,
      welcomeEmailStatus: "scheduled",
      welcomeEmailAttempts: 0,
      createdAt: now,
    });
  }
  if (shouldScheduleWelcome || !existing) {
    await ctx.scheduler.runAfter(0, internal.emailDelivery.sendWelcome, { memberId });
  }

  await ctx.db.patch(userId, {
    fullName: accessGrant.fullName,
    lastSeenAt: now,
    updatedAt: now,
  });

  const member = await ctx.db.get(memberId);
  if (!member) {
    throw new Error("access_denied");
  }

  return { member, accessGrant };
}
