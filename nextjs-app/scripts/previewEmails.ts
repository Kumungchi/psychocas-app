import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildWelcomeEmail } from "../convex/email";
import { buildOtpEmail } from "../convex/otp";

async function main() {
  const outputDirectory = path.resolve(process.cwd(), ".email-previews");
  const otp = buildOtpEmail("48273105");
  const welcome = buildWelcomeEmail({
    fullName: "Alex Novák",
    appUrl: "https://app.psychocas.cz/home",
    feedbackUrl: "https://app.psychocas.cz/home?tab=profile",
  });

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, "otp.html"), otp.html, "utf8"),
    writeFile(path.join(outputDirectory, "welcome.html"), welcome.html, "utf8"),
    writeFile(
      path.join(outputDirectory, "index.html"),
      `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Náhled e-mailů Psychočas</title>
    <style>
      body{margin:0;padding:24px;background:#e8eef4;font-family:Arial,sans-serif;color:#172033}
      h1{max-width:1220px;margin:0 auto 20px;font-size:24px}.grid{max-width:1220px;margin:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:20px}
      section{overflow:hidden;background:#fff;border:1px solid #cbd8e4;border-radius:14px}h2{margin:0;padding:14px 18px;background:#12385b;color:#fff;font-size:15px}
      iframe{display:block;width:100%;height:820px;border:0;background:#f3f7fb}
    </style>
  </head>
  <body><h1>Náhled transakčních e-mailů</h1><main class="grid"><section><h2>OTP přihlášení</h2><iframe src="otp.html"></iframe></section><section><h2>První přihlášení</h2><iframe src="welcome.html"></iframe></section></main></body>
</html>`,
      "utf8",
    ),
  ]);

  console.log(`Email previews generated at ${path.join(outputDirectory, "index.html")}`);
}

void main();
