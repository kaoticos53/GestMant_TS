/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _incidents_documents from "../_incidents/documents.js";
import type * as _incidents_helpers from "../_incidents/helpers.js";
import type * as _incidents_notes from "../_incidents/notes.js";
import type * as _incidents_trash from "../_incidents/trash.js";
import type * as _mail_deliver from "../_mail/deliver.js";
import type * as _partRequests_helpers from "../_partRequests/helpers.js";
import type * as _partRequests_incidentSync from "../_partRequests/incidentSync.js";
import type * as _partRequests_trash from "../_partRequests/trash.js";
import type * as _purchasing_helpers from "../_purchasing/helpers.js";
import type * as _purchasing_queries from "../_purchasing/queries.js";
import type * as alerts from "../alerts.js";
import type * as archive from "../archive.js";
import type * as audit from "../audit.js";
import type * as auditAlerts from "../auditAlerts.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as catalogs from "../catalogs.js";
import type * as cleanupLog from "../cleanupLog.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as equipment from "../equipment.js";
import type * as equipmentModels from "../equipmentModels.js";
import type * as http from "../http.js";
import type * as incidentIntake from "../incidentIntake.js";
import type * as incidentMail from "../incidentMail.js";
import type * as incidents from "../incidents.js";
import type * as mailLog from "../mailLog.js";
import type * as mailSettings from "../mailSettings.js";
import type * as maintenance from "../maintenance.js";
import type * as manuals from "../manuals.js";
import type * as members from "../members.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as notify from "../notify.js";
import type * as partRequests from "../partRequests.js";
import type * as permissions from "../permissions.js";
import type * as publicCodes from "../publicCodes.js";
import type * as publicLookupLimits from "../publicLookupLimits.js";
import type * as publicStats from "../publicStats.js";
import type * as purchasing from "../purchasing.js";
import type * as references from "../references.js";
import type * as reportUploads from "../reportUploads.js";
import type * as seed from "../seed.js";
import type * as seedPurchasing from "../seedPurchasing.js";
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
  "_incidents/documents": typeof _incidents_documents;
  "_incidents/helpers": typeof _incidents_helpers;
  "_incidents/notes": typeof _incidents_notes;
  "_incidents/trash": typeof _incidents_trash;
  "_mail/deliver": typeof _mail_deliver;
  "_partRequests/helpers": typeof _partRequests_helpers;
  "_partRequests/incidentSync": typeof _partRequests_incidentSync;
  "_partRequests/trash": typeof _partRequests_trash;
  "_purchasing/helpers": typeof _purchasing_helpers;
  "_purchasing/queries": typeof _purchasing_queries;
  alerts: typeof alerts;
  archive: typeof archive;
  audit: typeof audit;
  auditAlerts: typeof auditAlerts;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  catalogs: typeof catalogs;
  cleanupLog: typeof cleanupLog;
  crons: typeof crons;
  dashboard: typeof dashboard;
  equipment: typeof equipment;
  equipmentModels: typeof equipmentModels;
  http: typeof http;
  incidentIntake: typeof incidentIntake;
  incidentMail: typeof incidentMail;
  incidents: typeof incidents;
  mailLog: typeof mailLog;
  mailSettings: typeof mailSettings;
  maintenance: typeof maintenance;
  manuals: typeof manuals;
  members: typeof members;
  messages: typeof messages;
  notifications: typeof notifications;
  notify: typeof notify;
  partRequests: typeof partRequests;
  permissions: typeof permissions;
  publicCodes: typeof publicCodes;
  publicLookupLimits: typeof publicLookupLimits;
  publicStats: typeof publicStats;
  purchasing: typeof purchasing;
  references: typeof references;
  reportUploads: typeof reportUploads;
  seed: typeof seed;
  seedPurchasing: typeof seedPurchasing;
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
