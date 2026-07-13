import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { hashQrValue, isQrSecret, normalizeShortCode } from "./qrCrypto";

const http = httpRouter();

auth.addHttpRoutes(http);

function validationHeaders(origin: string | null): Headers {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return headers;
}

function allowedOrigin(request: Request): string | null | false {
  const origin = request.headers.get("Origin");
  const siteUrl = process.env.SITE_URL?.replace(/\/$/, "");
  if (!origin) return null;
  return siteUrl && origin === siteUrl ? origin : false;
}

http.route({
  path: "/qr/validate",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    const origin = allowedOrigin(request);
    if (origin === false) return new Response(null, { status: 403 });
    const headers = validationHeaders(origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "600");
    return new Response(null, { status: 204, headers });
  }),
});

http.route({
  path: "/qr/validate",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const origin = allowedOrigin(request);
    if (origin === false) {
      return new Response(JSON.stringify({ status: "invalid" }), {
        status: 403,
        headers: validationHeaders(null),
      });
    }
    const contentLength = Number(request.headers.get("Content-Length") ?? "0");
    if (contentLength > 2048) {
      return new Response(JSON.stringify({ status: "invalid" }), {
        status: 413,
        headers: validationHeaders(origin),
      });
    }

    let payload: { secret?: unknown; shortCode?: unknown };
    try {
      payload = await request.json();
    } catch {
      return new Response(JSON.stringify({ status: "invalid" }), {
        status: 400,
        headers: validationHeaders(origin),
      });
    }
    const secret = typeof payload.secret === "string" ? payload.secret.trim() : undefined;
    const shortCode =
      typeof payload.shortCode === "string" ? normalizeShortCode(payload.shortCode) : undefined;
    if ((!secret || !isQrSecret(secret)) && (!shortCode || shortCode.length !== 8)) {
      return new Response(JSON.stringify({ status: "invalid" }), {
        status: 400,
        headers: validationHeaders(origin),
      });
    }
    const [publicHash, shortCodeHash] = await Promise.all([
      secret && isQrSecret(secret) ? hashQrValue(secret) : undefined,
      shortCode?.length === 8 ? hashQrValue(shortCode) : undefined,
    ]);
    const result = await ctx.runMutation(internal.qr.validatePublic, { publicHash, shortCodeHash });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: validationHeaders(origin),
    });
  }),
});

export default http;
