export const OTP_LENGTH = 8;
export const OTP_MAX_AGE_SECONDS = 10 * 60;

type RandomFill = (bytes: Uint8Array) => void;

export function generateNumericOtp(
  length = OTP_LENGTH,
  fillRandom: RandomFill = (bytes) => {
    crypto.getRandomValues(bytes);
  },
): string {
  if (!Number.isInteger(length) || length < 6 || length > 12) {
    throw new Error("invalid_otp_length");
  }

  let value = "";
  while (value.length < length) {
    const bytes = new Uint8Array(Math.max(16, (length - value.length) * 2));
    fillRandom(bytes);

    for (const byte of bytes) {
      // 250 is divisible by 10, which avoids modulo bias.
      if (byte >= 250) continue;
      value += String(byte % 10);
      if (value.length === length) break;
    }
  }

  return value;
}

export function buildOtpEmail(token: string) {
  if (!/^\d{6,12}$/.test(token)) {
    throw new Error("invalid_otp_token");
  }

  return {
    subject: "Přihlašovací kód do Psychočasu",
    text: [
      "Přihlášení do členské aplikace Psychočas",
      "",
      `Váš přihlašovací kód je: ${token}`,
      "",
      "Kód platí 10 minut a lze jej použít pouze jednou.",
      "Pokud jste o přihlášení nežádali, tento email ignorujte.",
    ].join("\n"),
    html: `<!doctype html>
<html lang="cs">
  <body style="margin:0;background:#f6f8fb;font-family:Arial,'Helvetica Neue',sans-serif;color:#172033">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent">Váš přihlašovací kód do členské aplikace Psychočas.</div>
    <div style="max-width:560px;margin:0 auto;padding:32px 20px">
      <div style="background:#ffffff;border:1px solid #dde7f0;border-radius:8px;padding:28px">
        <div style="margin:0 0 24px">
          <p style="margin:0;color:#1d4f7d;font-size:28px;line-height:1;font-weight:800;letter-spacing:1.5px">PSYCHO<span style="color:#049edb">ČAS</span></p>
          <div style="width:100%;height:1px;background:#1d4f7d;margin:10px 0 8px"></div>
          <p style="margin:0;color:#1d4f7d;font-size:11px;font-weight:700;letter-spacing:3px">PSYCHOLOGICKÁ ČESKÁ ASOCIACE STUDENTŮ</p>
        </div>
        <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#172033">Přihlašovací kód</h1>
        <p style="margin:0 0 22px;color:#536273;line-height:1.6">Zadejte tento kód v členské aplikaci Psychočas:</p>
        <div style="padding:16px;background:#eaf5ff;border:1px solid #d8ecfa;border-radius:8px;text-align:center;color:#12385b;font-family:'SFMono-Regular',Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:6px">${token}</div>
        <p style="margin:22px 0 0;color:#536273;font-size:14px;line-height:1.6">Kód platí 10 minut a lze jej použít pouze jednou. Pokud jste o přihlášení nežádali, email ignorujte.</p>
      </div>
    </div>
  </body>
</html>`,
  };
}

async function getResendErrorName(response: Response): Promise<string | null> {
  try {
    const payload = (await response.clone().json()) as { name?: unknown };
    return typeof payload.name === "string" ? payload.name : null;
  } catch {
    return null;
  }
}

export async function sendOtpWithResend(
  input: {
    apiKey: string;
    from: string;
    to: string;
    token: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const apiKey = input.apiKey.trim();
  const from = input.from.trim();
  const to = input.to.trim().toLowerCase();

  if (!apiKey || !from || !to) {
    throw new Error("email_provider_unavailable");
  }

  const email = buildOtpEmail(input.token);
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "Psychoapp/1.0",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });

  if (!response.ok) {
    const providerErrorName = await getResendErrorName(response);
    console.warn("Resend email delivery failed", {
      status: response.status,
      providerErrorName,
    });
    throw new Error(
      `email_delivery_failed:${response.status}${providerErrorName ? `:${providerErrorName}` : ""}`,
    );
  }
}
