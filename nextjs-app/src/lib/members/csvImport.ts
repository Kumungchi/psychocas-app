import Papa from 'papaparse';

export type CsvMemberRole = 'member' | 'manager' | 'board' | 'admin';
export type CsvAccessStatus = 'active' | 'inactive' | 'expired' | 'revoked';

export type CsvImportBranch = {
  id: string;
  name: string;
  city: string;
  active: boolean;
};

export type ParsedMemberImportRow = {
  line: number;
  email: string;
  fullName: string;
  role: CsvMemberRole;
  status: CsvAccessStatus;
  membershipUntil: number;
  membershipDate: string;
  branchId?: string;
  branchLabel?: string;
  notes?: string;
};

export type CsvImportIssueCode =
  | 'empty_file'
  | 'too_many_rows'
  | 'missing_header'
  | 'parse_error'
  | 'missing_email'
  | 'invalid_email'
  | 'duplicate_email'
  | 'missing_name'
  | 'name_too_long'
  | 'invalid_role'
  | 'invalid_status'
  | 'missing_membership_date'
  | 'invalid_membership_date'
  | 'active_membership_expired'
  | 'unknown_branch'
  | 'inactive_branch'
  | 'notes_too_long';

export type CsvImportIssue = {
  code: CsvImportIssueCode;
  line?: number;
  field?: string;
  value?: string;
};

export type MemberCsvParseResult = {
  rows: ParsedMemberImportRow[];
  issues: CsvImportIssue[];
  rowCount: number;
};

type CanonicalColumn =
  | 'email'
  | 'fullName'
  | 'branch'
  | 'role'
  | 'membershipUntil'
  | 'status'
  | 'notes';

const MAX_IMPORT_ROWS = 250;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUIRED_COLUMNS: CanonicalColumn[] = ['email', 'fullName', 'membershipUntil'];

const headerAliases: Record<string, CanonicalColumn> = {
  email: 'email',
  mail: 'email',
  fullname: 'fullName',
  name: 'fullName',
  jmeno: 'fullName',
  celejmeno: 'fullName',
  branch: 'branch',
  pobocka: 'branch',
  role: 'role',
  membershipuntil: 'membershipUntil',
  validity: 'membershipUntil',
  platnost: 'membershipUntil',
  platnostdo: 'membershipUntil',
  clenstvido: 'membershipUntil',
  status: 'status',
  stav: 'status',
  notes: 'notes',
  note: 'notes',
  poznamka: 'notes',
};

const roleAliases: Record<string, CsvMemberRole> = {
  member: 'member',
  clen: 'member',
  student: 'member',
  manager: 'manager',
  manazer: 'manager',
  board: 'board',
  rada: 'board',
  admin: 'admin',
  administrator: 'admin',
};

const statusAliases: Record<string, CsvAccessStatus> = {
  active: 'active',
  aktivni: 'active',
  inactive: 'inactive',
  neaktivni: 'inactive',
  expired: 'expired',
  vyprselo: 'expired',
  revoked: 'revoked',
  zruseno: 'revoked',
};

export const MEMBER_CSV_TEMPLATE = [
  'email,fullName,branch,role,membershipUntil,status,notes',
  'student@example.cz,Jan Novak,Brno,member,2027-06-30,active,',
].join('\r\n');

function normalizedKey(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function canonicalHeader(value: string): string {
  return headerAliases[normalizedKey(value)] ?? value.trim();
}

function parseRole(value: string): CsvMemberRole | null {
  if (!value.trim()) return 'member';
  return roleAliases[normalizedKey(value)] ?? null;
}

function parseStatus(value: string): CsvAccessStatus | null {
  if (!value.trim()) return 'active';
  return statusAliases[normalizedKey(value)] ?? null;
}

function parseMembershipDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date.getTime();
}

function branchLookup(branches: CsvImportBranch[]): Map<string, CsvImportBranch | null> {
  const lookup = new Map<string, CsvImportBranch | null>();
  const add = (key: string, branch: CsvImportBranch) => {
    const normalized = normalizedKey(key);
    if (!normalized) return;
    const existing = lookup.get(normalized);
    lookup.set(normalized, existing && existing.id !== branch.id ? null : branch);
  };

  for (const branch of branches) {
    add(branch.name, branch);
    add(`${branch.name} ${branch.city}`, branch);
    add(branch.city, branch);
  }
  return lookup;
}

export function parseMemberCsv(
  text: string,
  branches: CsvImportBranch[],
  now = Date.now(),
): MemberCsvParseResult {
  if (!text.trim()) {
    return { rows: [], issues: [{ code: 'empty_file' }], rowCount: 0 };
  }

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: canonicalHeader,
    transform: (value) => value.trim(),
  });
  const issues: CsvImportIssue[] = parsed.errors.map((error) => ({
    code: 'parse_error',
    line: typeof error.row === 'number' ? error.row + 2 : undefined,
    value: error.message,
  }));
  const fields = new Set(parsed.meta.fields ?? []);
  for (const column of REQUIRED_COLUMNS) {
    if (!fields.has(column)) issues.push({ code: 'missing_header', field: column });
  }

  const rowCount = parsed.data.length;
  if (rowCount === 0) issues.push({ code: 'empty_file' });
  if (rowCount > MAX_IMPORT_ROWS) issues.push({ code: 'too_many_rows', value: String(rowCount) });
  if (issues.some((issue) => issue.code === 'missing_header' || issue.code === 'too_many_rows')) {
    return { rows: [], issues, rowCount };
  }

  const branchesByLabel = branchLookup(branches);
  const seenEmails = new Set<string>();
  const rows: ParsedMemberImportRow[] = [];

  parsed.data.forEach((raw, index) => {
    const line = index + 2;
    const rowIssues: CsvImportIssue[] = [];
    const email = (raw.email ?? '').trim().toLowerCase();
    const fullName = (raw.fullName ?? '').trim();
    const membershipDate = (raw.membershipUntil ?? '').trim();
    const role = parseRole(raw.role ?? '');
    const status = parseStatus(raw.status ?? '');
    const membershipUntil = parseMembershipDate(membershipDate);
    const branchValue = (raw.branch ?? '').trim();
    const branch = branchValue ? branchesByLabel.get(normalizedKey(branchValue)) : undefined;
    const notes = (raw.notes ?? '').trim();

    if (!email) rowIssues.push({ code: 'missing_email', line, field: 'email' });
    else if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      rowIssues.push({ code: 'invalid_email', line, field: 'email', value: email });
    } else if (seenEmails.has(email)) {
      rowIssues.push({ code: 'duplicate_email', line, field: 'email', value: email });
    } else {
      seenEmails.add(email);
    }

    if (!fullName) rowIssues.push({ code: 'missing_name', line, field: 'fullName' });
    else if (fullName.length > 120) rowIssues.push({ code: 'name_too_long', line, field: 'fullName' });
    if (!role) rowIssues.push({ code: 'invalid_role', line, field: 'role', value: raw.role });
    if (!status) rowIssues.push({ code: 'invalid_status', line, field: 'status', value: raw.status });
    if (!membershipDate) {
      rowIssues.push({ code: 'missing_membership_date', line, field: 'membershipUntil' });
    } else if (membershipUntil === null) {
      rowIssues.push({ code: 'invalid_membership_date', line, field: 'membershipUntil', value: membershipDate });
    } else if (status === 'active' && membershipUntil < now) {
      rowIssues.push({ code: 'active_membership_expired', line, field: 'membershipUntil', value: membershipDate });
    }
    if (branchValue && branch === undefined) {
      rowIssues.push({ code: 'unknown_branch', line, field: 'branch', value: branchValue });
    } else if (branch === null) {
      rowIssues.push({ code: 'unknown_branch', line, field: 'branch', value: branchValue });
    } else if (status === 'active' && branch && !branch.active) {
      rowIssues.push({ code: 'inactive_branch', line, field: 'branch', value: branchValue });
    }
    if (notes.length > 500) rowIssues.push({ code: 'notes_too_long', line, field: 'notes' });

    issues.push(...rowIssues);
    if (rowIssues.length > 0 || !role || !status || membershipUntil === null) return;

    rows.push({
      line,
      email,
      fullName,
      role,
      status,
      membershipUntil,
      membershipDate,
      branchId: branch?.id,
      branchLabel: branch ? `${branch.name}, ${branch.city}` : undefined,
      notes: notes || undefined,
    });
  });

  return { rows, issues, rowCount };
}
