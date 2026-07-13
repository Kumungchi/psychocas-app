import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { exportJWK, exportPKCS8, generateKeyPair } from 'jose';
import webPush from 'web-push';

const production = process.argv.includes('--prod');
const deploymentLabel = production ? 'production' : 'development';
const siteUrl = process.env.PSYCHOCAS_SITE_URL?.trim();
const resendKey = process.env.AUTH_RESEND_KEY?.trim();
const bootstrapAdmins = process.env.BOOTSTRAP_ADMIN_EMAILS?.trim();
const emailFrom = process.env.AUTH_EMAIL_FROM?.trim() || 'Psychočas <no-reply@psychocas.cz>';
const vapidSubject = process.env.VAPID_SUBJECT?.trim() || 'mailto:info@psychocas.cz';

if (!siteUrl || !/^https?:\/\//.test(siteUrl)) {
  throw new Error('Set PSYCHOCAS_SITE_URL to the frontend origin before provisioning.');
}
if (!resendKey) {
  throw new Error('Set AUTH_RESEND_KEY in the process environment before provisioning.');
}
if (!bootstrapAdmins) {
  throw new Error('Set BOOTSTRAP_ADMIN_EMAILS before provisioning.');
}

const keys = await generateKeyPair('RS256', { extractable: true });
const privateKey = (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\r?\n/g, ' ');
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: 'sig', ...publicKey }] });
const vapid = webPush.generateVAPIDKeys();

const values = {
  SITE_URL: siteUrl.replace(/\/$/, ''),
  JWT_PRIVATE_KEY: privateKey,
  JWKS: jwks,
  AUTH_RESEND_KEY: resendKey,
  AUTH_EMAIL_FROM: emailFrom,
  BOOTSTRAP_ADMIN_EMAILS: bootstrapAdmins,
  QR_TOKEN_PEPPER: randomBytes(48).toString('base64url'),
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  VAPID_SUBJECT: vapidSubject,
};

const convexCli = fileURLToPath(new URL('../node_modules/convex/bin/main.js', import.meta.url));

for (const [name, value] of Object.entries(values)) {
  const args = [convexCli, 'env', 'set'];
  if (production) args.push('--prod');
  args.push(name);

  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    input: `${value}\n`,
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || 'unknown Convex CLI error';
    throw new Error(`Unable to set ${name} on ${deploymentLabel}: ${detail}`);
  }
  process.stdout.write(`Configured ${name} on ${deploymentLabel}.\n`);
}

process.stdout.write(`Convex ${deploymentLabel} secrets are configured.\n`);
