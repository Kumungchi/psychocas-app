import { sendEmailWithResend } from "./email";

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
  <head><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"></head>
  <body style="margin:0;background:#f3f7fb;font-family:Arial,'Helvetica Neue',sans-serif;color:#172033">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent">Váš přihlašovací kód do členské aplikace Psychočas.</div>
    <div style="max-width:560px;margin:0 auto;padding:32px 20px">
      <div style="overflow:hidden;background:#ffffff;border:1px solid #dce7f1;border-radius:18px;box-shadow:0 8px 28px rgba(18,56,91,.08)">
        <div style="padding:28px;background:#12385b">
          <p style="margin:0;color:#ffffff;font-size:26px;line-height:1;font-weight:800;letter-spacing:1.4px">PSYCHO<span style="color:#42c4ef">ČAS</span></p>
          <p style="margin:10px 0 0;color:#cce9f6;font-size:10px;font-weight:700;letter-spacing:2.3px">PSYCHOLOGICKÁ ČESKÁ ASOCIACE STUDENTŮ</p>
        </div>
        <div style="padding:30px 28px 32px">
          <p style="margin:0 0 10px;color:#049edb;font-size:12px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase">Bezpečné přihlášení</p>
          <h1 style="margin:0 0 14px;font-size:26px;line-height:1.3;color:#172033">Tvůj přihlašovací kód</h1>
          <p style="margin:0 0 22px;color:#536273;line-height:1.6">Zkopíruj kód a vlož ho do členské aplikace Psychočas:</p>
          <div style="padding:18px 12px;background:#eef8fd;border:1px solid #d8ecfa;border-radius:12px;text-align:center;color:#12385b;font-family:'SFMono-Regular',Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:6px">${token}</div>
          <p style="margin:22px 0 0;color:#536273;font-size:14px;line-height:1.6">Kód platí <strong>10 minut</strong> a lze jej použít pouze jednou.</p>
          <p style="margin:10px 0 0;color:#7a8998;font-size:13px;line-height:1.6">Pokud ses přihlásit nepokoušel/a, e-mail můžeš bezpečně ignorovat.</p>
        </div>
      </div>
    </div>
  </body>
</html>`,
  };
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
  const email = buildOtpEmail(input.token);
  await sendEmailWithResend({ ...input, email }, fetchImpl);
}
