import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export const memberRole = v.union(
  v.literal("member"),
  v.literal("manager"),
  v.literal("board"),
  v.literal("admin"),
);

export const accessStatus = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("expired"),
  v.literal("revoked"),
);

export const staffPreset = v.union(
  v.literal("support"),
  v.literal("coordinator_hr"),
  v.literal("coordinator_pr"),
  v.literal("coordinator_partnerships"),
  v.literal("coordinator_events"),
  v.literal("manager"),
  v.literal("board"),
  v.literal("admin"),
);

export const assignmentScope = v.union(
  v.literal("organization"),
  v.literal("branch"),
);

export const assignmentStatus = v.union(
  v.literal("active"),
  v.literal("revoked"),
);

export const partnerCategory = v.union(
  v.literal("cafe"),
  v.literal("shop"),
  v.literal("publisher"),
  v.literal("practice"),
  v.literal("event"),
  v.literal("service"),
  v.literal("other"),
);

export const offerScope = v.union(v.literal("national"), v.literal("local"));
export const offerStatus = v.union(
  v.literal("draft"),
  v.literal("pending_approval"),
  v.literal("published"),
  v.literal("active"),
  v.literal("paused"),
  v.literal("archived"),
);
const tokenStatus = v.union(v.literal("active"), v.literal("expired"), v.literal("scanned"), v.literal("redeemed"), v.literal("revoked"));
const tokenEventType = v.union(
  v.literal("created"),
  v.literal("public_scan"),
  v.literal("valid_result"),
  v.literal("expired_result"),
  v.literal("duplicate_scan"),
  v.literal("revoked_result"),
);
const reviewStatus = v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.literal("archived"));
export const campaignStatus = v.union(v.literal("draft"), v.literal("scheduled"), v.literal("active"), v.literal("finished"), v.literal("archived"));
const feedbackStatus = v.union(v.literal("open"), v.literal("reviewing"), v.literal("closed"));
export const offerIssueReason = v.union(
  v.literal("unavailable"),
  v.literal("terms_mismatch"),
  v.literal("staff_unaware"),
  v.literal("wrong_info"),
  v.literal("other"),
);
export const offerIssueStatus = v.union(
  v.literal("open"),
  v.literal("reviewing"),
  v.literal("resolved"),
);
export const redemptionExperience = v.union(
  v.literal("accepted"),
  v.literal("not_accepted"),
  v.literal("problem"),
);
const approvalStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("cancelled"),
);
const privacyRequestType = v.union(
  v.literal("access"),
  v.literal("correction"),
  v.literal("deletion"),
  v.literal("restriction"),
  v.literal("objection"),
);
const privacyRequestStatus = v.union(
  v.literal("submitted"),
  v.literal("in_review"),
  v.literal("completed"),
  v.literal("rejected"),
);

const timestamps = {
  createdAt: v.number(),
  updatedAt: v.number(),
};

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    fullName: v.optional(v.string()),
    lastSeenAt: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  accessGrants: defineTable({
    email: v.string(),
    fullName: v.string(),
    role: memberRole,
    branchId: v.optional(v.id("branches")),
    membershipUntil: v.number(),
    status: accessStatus,
    notes: v.optional(v.string()),
    source: v.optional(v.union(v.literal("manual"), v.literal("import"), v.literal("migration"))),
    createdBy: v.optional(v.id("members")),
    updatedBy: v.optional(v.id("members")),
    ...timestamps,
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_role_status", ["role", "status"])
    .index("by_branch_status", ["branchId", "status"])
    .index("by_status_membershipUntil", ["status", "membershipUntil"]),

  otpRequestLimits: defineTable({
    email: v.string(),
    windowStartedAt: v.number(),
    requestCount: v.number(),
    lastRequestedAt: v.number(),
    updatedAt: v.number(),
  }).index("by_email", ["email"]),

  systemRateLimits: defineTable({
    key: v.string(),
    windowStartedAt: v.number(),
    requestCount: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  members: defineTable({
    userId: v.optional(v.id("users")),
    accessGrantId: v.optional(v.id("accessGrants")),
    authSubject: v.optional(v.string()),
    email: v.string(),
    fullName: v.string(),
    role: memberRole,
    branchId: v.optional(v.id("branches")),
    membershipUntil: v.number(),
    status: accessStatus,
    lastSyncedAt: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()),
    welcomeEmailStatus: v.optional(
      v.union(v.literal("scheduled"), v.literal("sending"), v.literal("sent"), v.literal("failed")),
    ),
    welcomeEmailAttempts: v.optional(v.number()),
    welcomeEmailSentAt: v.optional(v.number()),
    ...timestamps,
  })
    .index("by_userId", ["userId"])
    .index("by_authSubject", ["authSubject"])
    .index("by_email", ["email"])
    .index("by_accessGrantId", ["accessGrantId"])
    .index("by_role_status", ["role", "status"])
    .index("by_branch_status", ["branchId", "status"]),

  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    active: v.boolean(),
    ...timestamps,
  })
    .index("by_slug", ["slug"])
    .index("by_active", ["active"]),

  staffAssignments: defineTable({
    accessGrantId: v.id("accessGrants"),
    memberId: v.optional(v.id("members")),
    preset: staffPreset,
    scope: assignmentScope,
    organizationId: v.id("organizations"),
    branchId: v.optional(v.id("branches")),
    status: assignmentStatus,
    validUntil: v.optional(v.number()),
    reason: v.optional(v.string()),
    createdBy: v.id("members"),
    updatedBy: v.optional(v.id("members")),
    revokedAt: v.optional(v.number()),
    ...timestamps,
  })
    .index("by_accessGrant_status", ["accessGrantId", "status"])
    .index("by_member_status", ["memberId", "status"])
    .index("by_organization_status", ["organizationId", "status"])
    .index("by_branch_status", ["branchId", "status"])
    .index("by_preset_status", ["preset", "status"])
    .index("by_grant_preset_scope", ["accessGrantId", "preset", "organizationId", "branchId"]),

  branches: defineTable({
    organizationId: v.optional(v.id("organizations")),
    name: v.string(),
    city: v.string(),
    active: v.boolean(),
    ...timestamps,
  })
    .index("by_active", ["active"])
    .index("by_city", ["city"]),

  partners: defineTable({
    organizationId: v.optional(v.id("organizations")),
    name: v.string(),
    category: partnerCategory,
    website: v.optional(v.string()),
    description: v.optional(v.string()),
    address: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    branchId: v.optional(v.id("branches")),
    active: v.boolean(),
    createdBy: v.optional(v.id("members")),
    updatedBy: v.optional(v.id("members")),
    ...timestamps,
  })
    .index("by_active", ["active"])
    .index("by_organization_active", ["organizationId", "active"])
    .index("by_organization_branch_active", ["organizationId", "branchId", "active"])
    .index("by_branch_active", ["branchId", "active"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["active", "branchId", "category"],
    }),

  campaigns: defineTable({
    organizationId: v.optional(v.id("organizations")),
    branchId: v.optional(v.id("branches")),
    title: v.string(),
    description: v.optional(v.string()),
    status: campaignStatus,
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    createdBy: v.id("members"),
    updatedBy: v.optional(v.id("members")),
    ...timestamps,
  })
    .index("by_status", ["status"])
    .index("by_organization_status", ["organizationId", "status"])
    .index("by_branch_status", ["branchId", "status"])
    .index("by_validFrom", ["validFrom"]),

  offers: defineTable({
    organizationId: v.optional(v.id("organizations")),
    partnerId: v.id("partners"),
    title: v.string(),
    value: v.string(),
    description: v.optional(v.string()),
    redemptionInstructions: v.optional(v.string()),
    terms: v.optional(v.string()),
    scope: offerScope,
    branchId: v.optional(v.id("branches")),
    status: offerStatus,
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    campaignId: v.optional(v.id("campaigns")),
    lastVerifiedAt: v.optional(v.number()),
    createdBy: v.id("members"),
    updatedBy: v.optional(v.id("members")),
    ...timestamps,
  })
    .index("by_partner_status", ["partnerId", "status"])
    .index("by_scope_status", ["scope", "status"])
    .index("by_branch_status", ["branchId", "status"])
    .index("by_campaign", ["campaignId"])
    .index("by_organization_status", ["organizationId", "status"])
    .index("by_organization_branch_status", ["organizationId", "branchId", "status"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["status", "scope", "branchId"],
    }),

  offerFavorites: defineTable({
    memberId: v.id("members"),
    offerId: v.id("offers"),
    createdAt: v.number(),
  })
    .index("by_member", ["memberId"])
    .index("by_member_offer", ["memberId", "offerId"])
    .index("by_offer", ["offerId"]),

  offerIssueReports: defineTable({
    memberId: v.optional(v.id("members")),
    organizationId: v.id("organizations"),
    branchId: v.optional(v.id("branches")),
    offerId: v.id("offers"),
    reason: offerIssueReason,
    note: v.optional(v.string()),
    status: offerIssueStatus,
    resolvedBy: v.optional(v.id("members")),
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_member_offer", ["memberId", "offerId"])
    .index("by_organization_status", ["organizationId", "status"])
    .index("by_branch_status", ["branchId", "status"])
    .index("by_offer_status", ["offerId", "status"])
    .index("by_createdAt", ["createdAt"]),

  redemptionFeedback: defineTable({
    memberId: v.optional(v.id("members")),
    tokenId: v.optional(v.id("tokens")),
    organizationId: v.id("organizations"),
    branchId: v.optional(v.id("branches")),
    offerId: v.id("offers"),
    experience: redemptionExperience,
    createdAt: v.number(),
  })
    .index("by_token", ["tokenId"])
    .index("by_member_createdAt", ["memberId", "createdAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_organization_createdAt", ["organizationId", "createdAt"])
    .index("by_branch_createdAt", ["branchId", "createdAt"])
    .index("by_offer_createdAt", ["offerId", "createdAt"]),

  approvalRequests: defineTable({
    organizationId: v.id("organizations"),
    branchId: v.optional(v.id("branches")),
    entityType: v.union(v.literal("partner"), v.literal("offer"), v.literal("campaign")),
    entityId: v.string(),
    requestedAction: v.string(),
    status: approvalStatus,
    requestedBy: v.id("members"),
    reviewedBy: v.optional(v.id("members")),
    reviewerComment: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    ...timestamps,
  })
    .index("by_organization_status", ["organizationId", "status"])
    .index("by_branch_status", ["branchId", "status"])
    .index("by_entity", ["entityType", "entityId"]),

  tokens: defineTable({
    memberId: v.id("members"),
    offerId: v.id("offers"),
    publicHash: v.string(),
    shortCodeHash: v.string(),
    status: tokenStatus,
    expiresAt: v.number(),
    scannedAt: v.optional(v.number()),
    redeemedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    ...timestamps,
  })
    .index("by_publicHash", ["publicHash"])
    .index("by_shortCodeHash", ["shortCodeHash"])
    .index("by_member_status_expiresAt", ["memberId", "status", "expiresAt"])
    .index("by_offer_status", ["offerId", "status"])
    .index("by_status_expiresAt", ["status", "expiresAt"]),

  tokenEvents: defineTable({
    tokenId: v.id("tokens"),
    eventType: tokenEventType,
    result: v.optional(v.string()),
    anonymousDeviceHash: v.optional(v.string()),
    userAgentGroup: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_token_createdAt", ["tokenId", "createdAt"])
    .index("by_eventType_createdAt", ["eventType", "createdAt"]),

  analyticsDaily: defineTable({
    dateKey: v.string(),
    branchId: v.optional(v.id("branches")),
    partnerId: v.optional(v.id("partners")),
    offerId: v.optional(v.id("offers")),
    generatedCount: v.number(),
    scannedCount: v.number(),
    validCount: v.number(),
    expiredCount: v.number(),
    duplicateScanCount: v.number(),
    rejectedCount: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_date", ["dateKey"])
    .index("by_branch_date", ["branchId", "dateKey"])
    .index("by_partner_date", ["partnerId", "dateKey"])
    .index("by_offer_date", ["offerId", "dateKey"]),

  auditLogs: defineTable({
    actorMemberId: v.optional(v.id("members")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    summary: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_actor_createdAt", ["actorMemberId", "createdAt"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_createdAt", ["createdAt"]),

  feedback: defineTable({
    memberId: v.optional(v.id("members")),
    category: v.string(),
    message: v.string(),
    status: feedbackStatus,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status_createdAt", ["status", "createdAt"])
    .index("by_member_createdAt", ["memberId", "createdAt"]),

  partnerSuggestions: defineTable({
    suggestedBy: v.id("members"),
    partnerName: v.string(),
    website: v.optional(v.string()),
    note: v.optional(v.string()),
    branchId: v.optional(v.id("branches")),
    status: reviewStatus,
    reviewedBy: v.optional(v.id("members")),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status_createdAt", ["status", "createdAt"])
    .index("by_branch_status", ["branchId", "status"])
    .index("by_suggestedBy_createdAt", ["suggestedBy", "createdAt"]),

  pushSubscriptions: defineTable({
    memberId: v.id("members"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgentGroup: v.optional(v.string()),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_member", ["memberId"])
    .index("by_endpoint", ["endpoint"]),

  deliveryJobs: defineTable({
    campaignId: v.optional(v.id("campaigns")),
    eventId: v.optional(v.id("events")),
    memberId: v.id("members"),
    subscriptionId: v.id("pushSubscriptions"),
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("failed"), v.literal("cancelled")),
    attempts: v.number(),
    lastError: v.optional(v.string()),
    scheduledFor: v.number(),
    sentAt: v.optional(v.number()),
    ...timestamps,
  })
    .index("by_status_scheduledFor", ["status", "scheduledFor"])
    .index("by_campaign_status", ["campaignId", "status"])
    .index("by_campaign_subscription", ["campaignId", "subscriptionId"])
    .index("by_member_status", ["memberId", "status"]),

  notificationPreferences: defineTable({
    memberId: v.id("members"),
    membershipReminders: v.boolean(),
    newOffers: v.boolean(),
    events: v.boolean(),
    updatedByMemberAt: v.number(),
    ...timestamps,
  }).index("by_member", ["memberId"]),

  privacyRequests: defineTable({
    memberId: v.id("members"),
    type: privacyRequestType,
    status: privacyRequestStatus,
    message: v.optional(v.string()),
    resolution: v.optional(v.string()),
    handledBy: v.optional(v.id("members")),
    handledAt: v.optional(v.number()),
    ...timestamps,
  })
    .index("by_member_createdAt", ["memberId", "createdAt"])
    .index("by_status_createdAt", ["status", "createdAt"]),

  retentionRuns: defineTable({
    policy: v.string(),
    processedCount: v.number(),
    deletedCount: v.number(),
    anonymizedCount: v.number(),
    startedAt: v.number(),
    finishedAt: v.number(),
  }).index("by_finishedAt", ["finishedAt"]),

  events: defineTable({
    organizationId: v.optional(v.id("organizations")),
    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    capacity: v.optional(v.number()),
    branchId: v.optional(v.id("branches")),
    startsAt: v.number(),
    endsAt: v.optional(v.number()),
    status: campaignStatus,
    createdBy: v.id("members"),
    ...timestamps,
  })
    .index("by_branch_startsAt", ["branchId", "startsAt"])
    .index("by_status_startsAt", ["status", "startsAt"])
    .index("by_organization_status", ["organizationId", "status"]),

  eventCheckIns: defineTable({
    eventId: v.id("events"),
    memberId: v.id("members"),
    checkedInBy: v.optional(v.id("members")),
    checkedInAt: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_member", ["memberId"])
    .index("by_event_member", ["eventId", "memberId"]),
});
