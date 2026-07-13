import { convexAuth } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { syncAuthUserToAccessGrant } from "./authMembership";
import { ResendOTP } from "./ResendOTP";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [ResendOTP],
  session: {
    totalDurationMs: SESSION_DURATION_MS,
    inactiveDurationMs: SESSION_DURATION_MS,
  },
  signIn: {
    maxFailedAttempsPerHour: 10,
  },
  callbacks: {
    async beforeSessionCreation(ctx, { userId }) {
      await syncAuthUserToAccessGrant(
        ctx as MutationCtx,
        userId as Id<"users">,
      );
    },
  },
});
