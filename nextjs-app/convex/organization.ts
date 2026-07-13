import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

export const DEFAULT_ORGANIZATION_SLUG = "psychocas";

export async function getDefaultOrganization(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"organizations">> {
  const organization = await ctx.db
    .query("organizations")
    .withIndex("by_slug", (q) => q.eq("slug", DEFAULT_ORGANIZATION_SLUG))
    .unique();
  if (!organization?.active) throw new ConvexError("organization_not_ready");
  return organization;
}
