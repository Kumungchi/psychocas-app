export type TransactionalEmail = {
  subject: string;
  text: string;
  html: string;
};

export const DEFAULT_EMAIL_SENDER = "Psychočas <no-reply@psychocas.cz>";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailShell(input: {
  preheader: string;
  eyebrow: string;
  title: string;
  body: string;
}): string {
  return `<!doctype html>
<html lang="cs">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
  </head>
  <body style="margin:0;background:#f3f7fb;font-family:Arial,'Helvetica Neue',sans-serif;color:#172033">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0">${input.preheader}</div>
    <div style="max-width:600px;margin:0 auto;padding:32px 16px">
      <div style="overflow:hidden;background:#ffffff;border:1px solid #dce7f1;border-radius:18px;box-shadow:0 8px 28px rgba(18,56,91,.08)">
        <div style="padding:28px 28px 24px;background:#12385b">
          <p style="margin:0;color:#ffffff;font-size:26px;line-height:1;font-weight:800;letter-spacing:1.4px">PSYCHO<span style="color:#42c4ef">ČAS</span></p>
          <p style="margin:10px 0 0;color:#cce9f6;font-size:10px;font-weight:700;letter-spacing:2.3px">PSYCHOLOGICKÁ ČESKÁ ASOCIACE STUDENTŮ</p>
        </div>
        <div style="padding:30px 28px 32px">
          <p style="margin:0 0 10px;color:#049edb;font-size:12px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase">${input.eyebrow}</p>
          <h1 style="margin:0 0 16px;color:#172033;font-size:26px;line-height:1.25">${input.title}</h1>
          ${input.body}
        </div>
      </div>
      <p style="margin:18px 10px 0;color:#7a8998;font-size:12px;line-height:1.6;text-align:center">Psychočas · členská aplikace<br>Na tento automatický e-mail prosím neodpovídejte.</p>
    </div>
  </body>
</html>`;
}

export function buildWelcomeEmail(input: {
  fullName: string;
  appUrl?: string;
  feedbackUrl?: string;
}): TransactionalEmail {
  const firstName = input.fullName.trim().split(/\s+/, 1)[0] || "";
  const greeting = firstName ? `Ahoj ${firstName},` : "Ahoj,";
  const safeGreeting = escapeHtml(greeting);
  const appUrl = escapeHtml((input.appUrl || "https://app.psychocas.cz/home").trim());
  const feedbackUrl = escapeHtml((input.feedbackUrl || `${input.appUrl || "https://app.psychocas.cz"}/home?tab=profile`).trim());

  return {
    subject: "Vítej v členské aplikaci Psychočas 💙",
    text: [
      greeting,
      "",
      "vítej v členské aplikaci Psychočas. Tvoje členství, aktuální výhody a akce máš teď přehledně na jednom místě.",
      "",
      "V aplikaci můžeš procházet členské výhody, ukládat si oblíbené nabídky a rychle se prokázat u partnerů.",
      "",
      `Otevřít aplikaci: ${input.appUrl || "https://app.psychocas.cz/home"}`,
      `Poslat feedback: ${input.feedbackUrl || `${input.appUrl || "https://app.psychocas.cz"}/home?tab=profile`}`,
      "",
      "Budeme rádi za každý postřeh. Pomůže nám aplikaci dál zlepšovat a rozšiřovat členské výhody.",
      "",
      "Tým Psychočasu",
    ].join("\n"),
    html: emailShell({
      preheader: "Vítej v členské aplikaci Psychočas. Objev své členské výhody.",
      eyebrow: "Tvoje členství je připravené",
      title: "Vítej v Psychočasu 💙",
      body: `
        <p style="margin:0 0 14px;color:#34485c;font-size:16px;line-height:1.7">${safeGreeting}</p>
        <p style="margin:0 0 22px;color:#536273;font-size:15px;line-height:1.7">Tvoje členství, aktuální výhody a akce máš teď přehledně na jednom místě.</p>
        <div style="margin:0 0 24px;padding:18px;background:#eef8fd;border-radius:12px">
          <p style="margin:0 0 10px;color:#12385b;font-size:14px;font-weight:700">Co v aplikaci najdeš</p>
          <p style="margin:0;color:#536273;font-size:14px;line-height:1.8">✓ členské výhody a nabídky<br>✓ oblíbené nabídky po ruce<br>✓ rychlé ověření členství u partnerů</p>
        </div>
        <a href="${appUrl}" style="display:block;padding:14px 20px;background:#049edb;border-radius:10px;color:#ffffff;font-size:15px;font-weight:700;text-align:center;text-decoration:none">Otevřít aplikaci</a>
        <p style="margin:24px 0 0;color:#536273;font-size:14px;line-height:1.7">Budeme rádi za každý postřeh. <a href="${feedbackUrl}" style="color:#047caf;font-weight:700;text-decoration:underline">Napiš nám feedback</a> — pomůže nám aplikaci dál zlepšovat a rozšiřovat členské výhody.</p>
        <p style="margin:22px 0 0;color:#34485c;font-size:14px;line-height:1.6">Ať ti dobře slouží,<br><strong>tým Psychočasu</strong></p>`,
    }),
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

export async function sendEmailWithResend(
  input: {
    apiKey: string;
    from: string;
    to: string;
    email: TransactionalEmail;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const apiKey = input.apiKey.trim();
  const from = input.from.trim();
  const to = input.to.trim().toLowerCase();
  if (!apiKey || !from || !to) throw new Error("email_provider_unavailable");

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
      subject: input.email.subject,
      text: input.email.text,
      html: input.email.html,
    }),
  });

  if (!response.ok) {
    const providerErrorName = await getResendErrorName(response);
    console.warn("Resend email delivery failed", { status: response.status, providerErrorName });
    throw new Error(`email_delivery_failed:${response.status}${providerErrorName ? `:${providerErrorName}` : ""}`);
  }
}
