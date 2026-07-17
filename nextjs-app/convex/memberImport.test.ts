import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { modules } from './test.setup';

async function seedMemberImport() {
  const t = convexTest(schema, modules);
  const now = Date.now();
  const ids = await t.run(async (ctx) => {
    const branchId = await ctx.db.insert('branches', {
      name: 'Brno',
      city: 'Brno',
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    const boardUserId = await ctx.db.insert('users', { email: 'board@example.test' });
    const boardGrantId = await ctx.db.insert('accessGrants', {
      email: 'board@example.test',
      fullName: 'Board Member',
      role: 'board',
      membershipUntil: now + 86_400_000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert('members', {
      userId: boardUserId,
      accessGrantId: boardGrantId,
      email: 'board@example.test',
      fullName: 'Board Member',
      role: 'board',
      membershipUntil: now + 86_400_000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    const memberUserId = await ctx.db.insert('users', { email: 'member@example.test' });
    const memberGrantId = await ctx.db.insert('accessGrants', {
      email: 'member@example.test',
      fullName: 'Existing Member',
      role: 'member',
      membershipUntil: now + 86_400_000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert('members', {
      userId: memberUserId,
      accessGrantId: memberGrantId,
      email: 'member@example.test',
      fullName: 'Existing Member',
      role: 'member',
      membershipUntil: now + 86_400_000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    return { branchId, boardUserId, boardGrantId, memberUserId, memberGrantId };
  });

  return {
    t,
    asBoard: t.withIdentity({ subject: ids.boardUserId }),
    asMember: t.withIdentity({ subject: ids.memberUserId }),
    ...ids,
  };
}

describe('member CSV import backend', () => {
  it('previews, creates, skips, updates, protects the actor, and audits a batch', async () => {
    const { t, asBoard, branchId, boardGrantId, memberGrantId } = await seedMemberImport();
    const membershipUntil = Date.now() + 7 * 86_400_000;

    await expect(
      asBoard.query(api.members.previewAccessGrantImport, {
        emails: ['new@example.test', 'MEMBER@example.test'],
      }),
    ).resolves.toMatchObject({ totalCount: 2, newCount: 1, existingCount: 1 });

    await expect(
      asBoard.mutation(api.members.importAccessGrants, {
        rows: [
          {
            email: 'new@example.test',
            fullName: 'New Member',
            role: 'member',
            branchId,
            membershipUntil,
            status: 'active',
          },
          {
            email: 'member@example.test',
            fullName: 'Skipped Member',
            role: 'manager',
            branchId,
            membershipUntil,
            status: 'active',
          },
        ],
        updateExisting: false,
        reason: 'Pilot import',
      }),
    ).resolves.toMatchObject({ createdCount: 1, updatedCount: 0, skippedCount: 1, protectedCount: 0 });

    await expect(
      asBoard.mutation(api.members.importAccessGrants, {
        rows: [
          {
            email: 'member@example.test',
            fullName: 'Updated Member',
            role: 'manager',
            branchId,
            membershipUntil,
            status: 'active',
          },
          {
            email: 'board@example.test',
            fullName: 'Changed Board',
            role: 'member',
            membershipUntil,
            status: 'inactive',
          },
        ],
        updateExisting: true,
      }),
    ).resolves.toMatchObject({ createdCount: 0, updatedCount: 1, skippedCount: 0, protectedCount: 1 });

    const persisted = await t.run(async (ctx) => ({
      created: await ctx.db
        .query('accessGrants')
        .withIndex('by_email', (q) => q.eq('email', 'new@example.test'))
        .unique(),
      member: await ctx.db.get(memberGrantId),
      board: await ctx.db.get(boardGrantId),
      audits: await ctx.db
        .query('auditLogs')
        .filter((q) => q.eq(q.field('action'), 'accessGrant.csvImport'))
        .collect(),
    }));

    expect(persisted.created).toMatchObject({ source: 'import', branchId, createdBy: expect.any(String) });
    expect(persisted.member).toMatchObject({ fullName: 'Updated Member', role: 'manager', source: 'import' });
    expect(persisted.board).toMatchObject({ fullName: 'Board Member', role: 'board', status: 'active' });
    expect(persisted.audits).toHaveLength(2);
    expect(persisted.audits[1].after).toMatchObject({ updatedCount: 1, protectedCount: 1 });
  });

  it('denies a regular member and rejects duplicate emails atomically', async () => {
    const { t, asBoard, asMember } = await seedMemberImport();
    const row = {
      email: 'duplicate@example.test',
      fullName: 'Duplicate Member',
      role: 'member' as const,
      membershipUntil: Date.now() + 86_400_000,
      status: 'active' as const,
    };

    await expect(
      asMember.mutation(api.members.importAccessGrants, {
        rows: [row],
        updateExisting: false,
      }),
    ).rejects.toThrow();

    await expect(
      asBoard.mutation(api.members.importAccessGrants, {
        rows: [row, { ...row, email: ' DUPLICATE@example.test ' }],
        updateExisting: false,
      }),
    ).rejects.toThrow('duplicate_import_email');

    const duplicate = await t.run((ctx) =>
      ctx.db
        .query('accessGrants')
        .withIndex('by_email', (q) => q.eq('email', 'duplicate@example.test'))
        .unique(),
    );
    expect(duplicate).toBeNull();
  });
});
