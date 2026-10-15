/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as alerts from "../alerts.js";
import type * as archive from "../archive.js";
import type * as auditAlerts from "../auditAlerts.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as cleanupLog from "../cleanupLog.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as equipment from "../equipment.js";
import type * as http from "../http.js";
import type * as incidentIntake from "../incidentIntake.js";
import type * as incidentMail from "../incidentMail.js";
import type * as incidents from "../incidents.js";
import type * as incidents_documents from "../incidents/documents.js";
import type * as incidents_helpers from "../incidents/helpers.js";
import type * as incidents_notes from "../incidents/notes.js";
import type * as incidents_trash from "../incidents/trash.js";
import type * as maintenance from "../maintenance.js";
import type * as manuals from "../manuals.js";
import type * as members from "../members.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as notify from "../notify.js";
import type * as partRequests from "../partRequests.js";
import type * as partRequests_helpers from "../partRequests/helpers.js";
import type * as partRequests_trash from "../partRequests/trash.js";
import type * as permissions from "../permissions.js";
import type * as publicCodes from "../publicCodes.js";
import type * as purchasing from "../purchasing.js";
import type * as purchasing_helpers from "../purchasing/helpers.js";
import type * as purchasing_queries from "../purchasing/queries.js";
import type * as references from "../references.js";
import type * as reportUploads from "../reportUploads.js";
import type * as seed from "../seed.js";
import type * as spareParts from "../spareParts.js";
import type * as storageCleanup from "../storageCleanup.js";
import type * as trash from "../trash.js";
import type * as uploads from "../uploads.js";
import type * as users from "../users.js";
import type * as weeklyReport from "../weeklyReport.js";
import type * as workshopReset from "../workshopReset.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  alerts: typeof alerts;
  archive: typeof archive;
  auditAlerts: typeof auditAlerts;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  cleanupLog: typeof cleanupLog;
  crons: typeof crons;
  dashboard: typeof dashboard;
  equipment: typeof equipment;
  http: typeof http;
  incidentIntake: typeof incidentIntake;
  incidentMail: typeof incidentMail;
  incidents: typeof incidents;
  "incidents/documents": typeof incidents_documents;
  "incidents/helpers": typeof incidents_helpers;
  "incidents/notes": typeof incidents_notes;
  "incidents/trash": typeof incidents_trash;
  maintenance: typeof maintenance;
  manuals: typeof manuals;
  members: typeof members;
  messages: typeof messages;
  notifications: typeof notifications;
  notify: typeof notify;
  partRequests: typeof partRequests;
  "partRequests/helpers": typeof partRequests_helpers;
  "partRequests/trash": typeof partRequests_trash;
  permissions: typeof permissions;
  publicCodes: typeof publicCodes;
  purchasing: typeof purchasing;
  "purchasing/helpers": typeof purchasing_helpers;
  "purchasing/queries": typeof purchasing_queries;
  references: typeof references;
  reportUploads: typeof reportUploads;
  seed: typeof seed;
  spareParts: typeof spareParts;
  storageCleanup: typeof storageCleanup;
  trash: typeof trash;
  uploads: typeof uploads;
  users: typeof users;
  weeklyReport: typeof weeklyReport;
  workshopReset: typeof workshopReset;
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
