import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("demo data seed", () => {
  it("assigns the target branch and creates repeatable role and offer fixtures", async () => {
    const t = convexTest(schema, modules);
    const args = {
      targetEmail: "owner@example.test",
      targetFullName: "Matias Bunnik",
      branchCity: "Ostrava",
      sendWelcome: false,
    };

    await expect(t.mutation(internal.demoSeed.apply, args)).resolves.toMatchObject({
      status: "seeded",
      assignmentCount: 8,
      publishedOfferCount: 3,
      welcomeScheduled: false,
    });
    await expect(t.mutation(internal.demoSeed.apply, args)).resolves.toMatchObject({
      status: "seeded",
      assignmentCount: 8,
      publishedOfferCount: 3,
    });

    const persisted = await t.run(async (ctx) => {
      const grant = await ctx.db
        .query("accessGrants")
        .withIndex("by_email", (q) => q.eq("email", args.targetEmail))
        .unique();
      const branch = grant?.branchId ? await ctx.db.get(grant.branchId) : null;
      const assignments = await ctx.db.query("staffAssignments").collect();
      const offers = await ctx.db.query("offers").collect();
      const partners = await ctx.db.query("partners").collect();
      const events = await ctx.db.query("events").collect();
      return { grant, branch, assignments, offers, partners, events };
    });

    expect(persisted.branch).toMatchObject({ name: "Ostrava", active: true });
    expect(persisted.assignments).toHaveLength(8);
    expect(persisted.partners).toHaveLength(3);
    expect(persisted.offers).toHaveLength(6);
    expect(persisted.offers.filter((offer) => offer.status === "published")).toHaveLength(3);
    expect(persisted.events).toHaveLength(2);
  });
});
