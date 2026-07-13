import { Email } from "@convex-dev/auth/providers/Email";
import type { GenericActionCtxWithAuthConfig } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import {
  generateNumericOtp,
  OTP_MAX_AGE_SECONDS,
  sendOtpWithResend,
} from "./otp";

const defaultSender = "Psychočas <no-reply@psychocas.cz>";

export const ResendOTP = Email<DataModel>({
  id: "resend-otp",
  name: "Psychočas email OTP",
  apiKey: process.env.AUTH_RESEND_KEY ?? "",
  from: process.env.AUTH_EMAIL_FROM ?? defaultSender,
  maxAge: OTP_MAX_AGE_SECONDS,
  generateVerificationToken: async () => generateNumericOtp(),
  async sendVerificationRequest(
    { identifier, provider, token },
    ctx?: GenericActionCtxWithAuthConfig<DataModel>,
  ) {
    if (!ctx) {
      throw new Error("email_provider_unavailable");
    }

    const request = await ctx.runMutation(internal.authAccess.consumeOtpRequest, {
      email: identifier,
    });
    if (request.status !== "allowed") {
      throw new Error("otp_request_unavailable");
    }

    await sendOtpWithResend({
      apiKey: provider.apiKey ?? "",
      from: provider.from ?? defaultSender,
      to: identifier,
      token,
    });
  },
});
