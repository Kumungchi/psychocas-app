import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  generateQrSecret,
  generateShortCode,
  hashQrValue,
  isQrSecret,
  normalizeShortCode,
} from "./qrCrypto";

type IssueResult = {
  tokenId: Id<"tokens">;
  expiresAt: number;
  offer: { id: Id<"offers">; title: string; value: string };
  partner: { id: Id<"partners">; name: string };
  secret: string;
  shortCode: string;
  verificationPath: string;
};

type PublicValidationResult = {
  status: "invalid" | "valid" | "already_validated" | "expired" | "revoked";
  checkedAt: number;
  validatedAt?: number;
  offerTitle?: string;
  offerValue?: string;
  partnerName?: string;
};

export const issue = action({
  args: { offerId: v.id("offers") },
  handler: async (ctx, args): Promise<IssueResult> => {
    const secret = generateQrSecret();
    const shortCode = generateShortCode();
    const [publicHash, shortCodeHash] = await Promise.all([
      hashQrValue(secret),
      hashQrValue(shortCode),
    ]);
    const result: Omit<IssueResult, "secret" | "shortCode" | "verificationPath"> =
      await ctx.runMutation(internal.qr.issueInternal, {
      offerId: args.offerId,
      publicHash,
      shortCodeHash,
      });
    return {
      ...result,
      secret,
      shortCode,
      verificationPath: `/v#t=${secret}`,
    };
  },
});

export const preparePublicValidation = action({
  args: {
    secret: v.optional(v.string()),
    shortCode: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<PublicValidationResult> => {
    const secret = args.secret?.trim();
    const shortCode = args.shortCode ? normalizeShortCode(args.shortCode) : undefined;
    if ((!secret || !isQrSecret(secret)) && (!shortCode || shortCode.length !== 8)) {
      return { status: "invalid" as const, checkedAt: Date.now() };
    }
    const [publicHash, shortCodeHash] = await Promise.all([
      secret && isQrSecret(secret) ? hashQrValue(secret) : undefined,
      shortCode?.length === 8 ? hashQrValue(shortCode) : undefined,
    ]);
    return (await ctx.runMutation(internal.qr.validatePublic, {
      publicHash,
      shortCodeHash,
    })) as PublicValidationResult;
  },
});
