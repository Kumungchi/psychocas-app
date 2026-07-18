import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const repositoryRoot = path.resolve(projectRoot, '..');
const trackedFiles = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  {
  cwd: repositoryRoot,
  encoding: 'utf8',
  },
)
  .split('\0')
  .filter(Boolean);

const forbiddenPatterns = [
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Resend API key', pattern: /\bre_[A-Za-z0-9_-]{20,}\b/ },
  { name: 'Convex deploy key', pattern: /\b(?:dev|prod|preview):[a-z0-9-]+\|[A-Za-z0-9_-]{20,}\b/i },
];

const findings = [];
for (const relativePath of trackedFiles) {
  const absolutePath = path.join(repositoryRoot, relativePath);
  let content;
  try {
    content = readFileSync(absolutePath, 'utf8');
  } catch {
    continue;
  }

  for (const { name, pattern } of forbiddenPatterns) {
    if (pattern.test(content)) findings.push(`${relativePath}: ${name}`);
  }
}

if (findings.length > 0) {
  console.error(`Potential secrets found in tracked files:\n${findings.join('\n')}`);
  process.exit(1);
}

console.log(`Secret scan passed for ${trackedFiles.length} versioned and pending files.`);
