export const CAPABILITIES = [
  "membership.read",
  "membership.manage",
  "branch.manage",
  "assignment.manage",
  "support.read",
  "support.session_revoke",
  "partner.draft",
  "partner.approve",
  "offer.draft",
  "offer.publish",
  "campaign.draft",
  "campaign.send",
  "event.manage",
  "event.check_in",
  "metrics.read",
  "audit.read",
  "privacy.manage",
] as const;

export type Capability = (typeof CAPABILITIES)[number];
export type StaffPreset =
  | "support"
  | "coordinator_hr"
  | "coordinator_pr"
  | "coordinator_partnerships"
  | "coordinator_events"
  | "manager"
  | "board"
  | "admin";
export type LegacyRole = "member" | "manager" | "board" | "admin";

const ALL_CAPABILITIES = new Set<Capability>(CAPABILITIES);

const PRESET_CAPABILITIES: Record<StaffPreset, ReadonlySet<Capability>> = {
  support: new Set(["support.read"]),
  coordinator_hr: new Set(["membership.read"]),
  coordinator_pr: new Set(["campaign.draft"]),
  coordinator_partnerships: new Set([
    "partner.draft",
    "offer.draft",
    "metrics.read",
  ]),
  coordinator_events: new Set(["event.manage", "event.check_in"]),
  manager: new Set([
    "membership.read",
    "support.read",
    "partner.draft",
    "partner.approve",
    "offer.draft",
    "offer.publish",
    "campaign.draft",
    "campaign.send",
    "event.manage",
    "event.check_in",
    "metrics.read",
  ]),
  board: ALL_CAPABILITIES,
  admin: ALL_CAPABILITIES,
};

export function capabilitiesForPreset(preset: StaffPreset): ReadonlySet<Capability> {
  return PRESET_CAPABILITIES[preset];
}

export function presetHasCapability(preset: StaffPreset, capability: Capability): boolean {
  return PRESET_CAPABILITIES[preset].has(capability);
}

export function legacyPresetForRole(role: LegacyRole): StaffPreset | null {
  if (role === "member") return null;
  return role;
}

export function scopeAllows(input: {
  assignmentScope: "organization" | "branch";
  assignmentOrganizationId: string;
  assignmentBranchId?: string;
  targetOrganizationId: string;
  targetBranchId?: string;
}): boolean {
  if (input.assignmentOrganizationId !== input.targetOrganizationId) return false;
  if (input.assignmentScope === "organization") return true;
  return Boolean(
    input.targetBranchId &&
      input.assignmentBranchId &&
      input.assignmentBranchId === input.targetBranchId,
  );
}
