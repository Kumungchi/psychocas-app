import type { Doc } from "./_generated/dataModel";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function effectiveAccessStatus(
  status: Doc<"accessGrants">["status"],
  membershipUntil: number,
  now = Date.now(),
): Doc<"accessGrants">["status"] {
  if (status === "active" && membershipUntil < now) {
    return "expired";
  }
  return status;
}
