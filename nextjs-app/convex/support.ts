import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import { effectiveAccessStatus, normalizeEmail } from "./access";
import { hasCapability, requireActiveMember } from "./authz";
import { getDefaultOrganization } from "./organization";

export const directory = query({
  args: {
    search: v.string(),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const [actor, organization] = await Promise.all([
      requireActiveMember(ctx),
      getDefaultOrganization(ctx),
    ]);
    const target = { organizationId: organization._id, branchId: args.branchId };
    const [canSupport, canReadMembership] = await Promise.all([
      hasCapability(ctx, actor, "support.read", target),
      hasCapability(ctx, actor, "membership.read", target),
    ]);
    if (!canSupport && !canReadMembership) throw new ConvexError("forbidden");

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
    const filtered = rows
      .filter((row) => !args.branchId || row.branchId === args.branchId)
      .filter(
        (row) =>
          exact ||
          normalizeEmail(row.fullName).includes(search) ||
          normalizeEmail(row.email).includes(search),
      )
      .slice(0, 50);

    return Promise.all(
      filtered.map(async (grant) => {
        const [member, branch] = await Promise.all([
          ctx.db
            .query("members")
            .withIndex("by_accessGrantId", (q) => q.eq("accessGrantId", grant._id))
            .unique(),
          grant.branchId ? ctx.db.get(grant.branchId) : null,
        ]);
        return {
          accessGrantId: grant._id,
          fullName: grant.fullName,
          email: grant.email,
          status: effectiveAccessStatus(grant.status, grant.membershipUntil),
          membershipUntil: grant.membershipUntil,
          branch: branch ? { id: branch._id, name: branch.name } : null,
          lastSeenAt: member?.lastSeenAt ?? null,
        };
      }),
    );
  },
});
