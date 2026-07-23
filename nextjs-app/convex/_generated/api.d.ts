/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as access from "../access.js";
import type * as analytics from "../analytics.js";
import type * as analyticsModel from "../analyticsModel.js";
import type * as approvals from "../approvals.js";
import type * as auth from "../auth.js";
import type * as authAccess from "../authAccess.js";
import type * as authMembership from "../authMembership.js";
import type * as authz from "../authz.js";
import type * as branches from "../branches.js";
import type * as campaigns from "../campaigns.js";
import type * as crons from "../crons.js";
import type * as demoSeed from "../demoSeed.js";
import type * as email from "../email.js";
import type * as emailDelivery from "../emailDelivery.js";
import type * as events from "../events.js";
import type * as feedback from "../feedback.js";
import type * as http from "../http.js";
import type * as iam from "../iam.js";
import type * as members from "../members.js";
import type * as notifications from "../notifications.js";
import type * as notificationsNode from "../notificationsNode.js";
import type * as offerEngagement from "../offerEngagement.js";
import type * as offers from "../offers.js";
import type * as operations from "../operations.js";
import type * as organization from "../organization.js";
import type * as otp from "../otp.js";
import type * as partners from "../partners.js";
import type * as permissions from "../permissions.js";
import type * as privacy from "../privacy.js";
import type * as qr from "../qr.js";
import type * as qrActions from "../qrActions.js";
import type * as qrCrypto from "../qrCrypto.js";
import type * as retention from "../retention.js";
import type * as support from "../support.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  access: typeof access;
  analytics: typeof analytics;
  analyticsModel: typeof analyticsModel;
  approvals: typeof approvals;
  auth: typeof auth;
  authAccess: typeof authAccess;
  authMembership: typeof authMembership;
  authz: typeof authz;
  branches: typeof branches;
  campaigns: typeof campaigns;
  crons: typeof crons;
  demoSeed: typeof demoSeed;
  email: typeof email;
  emailDelivery: typeof emailDelivery;
  events: typeof events;
  feedback: typeof feedback;
  http: typeof http;
  iam: typeof iam;
  members: typeof members;
  notifications: typeof notifications;
  notificationsNode: typeof notificationsNode;
  offerEngagement: typeof offerEngagement;
  offers: typeof offers;
  operations: typeof operations;
  organization: typeof organization;
  otp: typeof otp;
  partners: typeof partners;
  permissions: typeof permissions;
  privacy: typeof privacy;
  qr: typeof qr;
  qrActions: typeof qrActions;
  qrCrypto: typeof qrCrypto;
  retention: typeof retention;
  support: typeof support;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
