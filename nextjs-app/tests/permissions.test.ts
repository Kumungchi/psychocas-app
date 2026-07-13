import { describe, expect, it } from 'vitest';
import {
  capabilitiesForPreset,
  legacyPresetForRole,
  presetHasCapability,
  scopeAllows,
} from '../convex/permissions';

describe('scoped staff permissions', () => {
  it('keeps membership changes limited to board and admin', () => {
    expect(presetHasCapability('coordinator_hr', 'membership.manage')).toBe(false);
    expect(presetHasCapability('manager', 'membership.manage')).toBe(false);
    expect(presetHasCapability('board', 'membership.manage')).toBe(true);
    expect(presetHasCapability('admin', 'membership.manage')).toBe(true);
  });

  it('separates draft and publish capabilities', () => {
    expect(presetHasCapability('coordinator_partnerships', 'offer.draft')).toBe(true);
    expect(presetHasCapability('coordinator_partnerships', 'offer.publish')).toBe(false);
    expect(presetHasCapability('manager', 'offer.publish')).toBe(true);
  });

  it('allows organization assignments across branches but isolates branch assignments', () => {
    expect(
      scopeAllows({
        assignmentScope: 'organization',
        assignmentOrganizationId: 'org',
        targetOrganizationId: 'org',
        targetBranchId: 'brno',
      }),
    ).toBe(true);
    expect(
      scopeAllows({
        assignmentScope: 'branch',
        assignmentOrganizationId: 'org',
        assignmentBranchId: 'praha',
        targetOrganizationId: 'org',
        targetBranchId: 'brno',
      }),
    ).toBe(false);
  });

  it('does not cross organization boundaries', () => {
    expect(
      scopeAllows({
        assignmentScope: 'organization',
        assignmentOrganizationId: 'org-a',
        targetOrganizationId: 'org-b',
      }),
    ).toBe(false);
  });

  it('maps only elevated legacy roles into staff presets', () => {
    expect(legacyPresetForRole('member')).toBeNull();
    expect(legacyPresetForRole('manager')).toBe('manager');
    expect(capabilitiesForPreset('support').has('support.read')).toBe(true);
  });
});
