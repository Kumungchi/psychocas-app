import { describe, expect, it } from 'vitest';
import { parseMemberCsv } from '@/lib/members/csvImport';

const branches = [
  { id: 'branch-brno', name: 'Brno', city: 'Brno', active: true },
  { id: 'branch-praha', name: 'Praha', city: 'Praha', active: false },
];
const now = new Date(2026, 6, 17, 12).getTime();

describe('member CSV import parser', () => {
  it('parses comma-separated canonical headers and applies safe defaults', () => {
    const result = parseMemberCsv(
      [
        'email,fullName,branch,role,membershipUntil,status,notes',
        ' Student@Example.cz , Jan Novak , Brno , , 2027-06-30 , , Pilot ',
      ].join('\n'),
      branches,
      now,
    );

    expect(result.issues).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      line: 2,
      email: 'student@example.cz',
      fullName: 'Jan Novak',
      branchId: 'branch-brno',
      role: 'member',
      status: 'active',
      membershipDate: '2027-06-30',
      notes: 'Pilot',
    });
  });

  it('accepts Czech headers, labels, and semicolon-separated Excel output', () => {
    const result = parseMemberCsv(
      [
        'email;jméno;pobočka;role;platnost do;stav;poznámka',
        'manager@example.cz;Test Manager;Brno;manažer;2027-08-31;aktivní;',
      ].join('\r\n'),
      branches,
      now,
    );

    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      email: 'manager@example.cz',
      role: 'manager',
      status: 'active',
      branchId: 'branch-brno',
    });
  });

  it('reports duplicates and invalid row values before import', () => {
    const result = parseMemberCsv(
      [
        'email,fullName,branch,role,membershipUntil,status',
        'member@example.cz,Member One,Brno,member,2027-06-30,active',
        'member@example.cz,Member Two,Unknown,owner,2025-01-01,active',
      ].join('\n'),
      branches,
      now,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'duplicate_email',
        'invalid_role',
        'active_membership_expired',
        'unknown_branch',
      ]),
    );
  });

  it('rejects an inactive branch for an active member', () => {
    const result = parseMemberCsv(
      'email,fullName,branch,membershipUntil\nmember@example.cz,Member,Praha,2027-06-30',
      branches,
      now,
    );

    expect(result.rows).toEqual([]);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'inactive_branch', line: 2 }));
  });

  it('requires the canonical minimum columns', () => {
    const result = parseMemberCsv('email,name\nmember@example.cz,Member', branches, now);

    expect(result.rows).toEqual([]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'missing_header', field: 'membershipUntil' }),
    );
  });
});
