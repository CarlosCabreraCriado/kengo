/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _helpers_permissions from "../_helpers/permissions.js";
import type * as _helpers_validators from "../_helpers/validators.js";
import type * as accessCodes_mutations from "../accessCodes/mutations.js";
import type * as accessCodes_queries from "../accessCodes/queries.js";
import type * as accessTokens_actions from "../accessTokens/actions.js";
import type * as accessTokens_mutations from "../accessTokens/mutations.js";
import type * as accessTokens_queries from "../accessTokens/queries.js";
import type * as assignments_mutations from "../assignments/mutations.js";
import type * as assignments_queries from "../assignments/queries.js";
import type * as auth from "../auth.js";
import type * as auth_actions from "../auth/actions.js";
import type * as auth_mutations from "../auth/mutations.js";
import type * as auth_queries from "../auth/queries.js";
import type * as clinicMemberships_mutations from "../clinicMemberships/mutations.js";
import type * as clinicMemberships_queries from "../clinicMemberships/queries.js";
import type * as clinics_mutations from "../clinics/mutations.js";
import type * as clinics_queries from "../clinics/queries.js";
import type * as compliance_internal from "../compliance/internal.js";
import type * as compliance_mutations from "../compliance/mutations.js";
import type * as compliance_queries from "../compliance/queries.js";
import type * as contact_actions from "../contact/actions.js";
import type * as crons from "../crons.js";
import type * as dashboard_queries from "../dashboard/queries.js";
import type * as email_actions from "../email/actions.js";
import type * as email_templates from "../email/templates.js";
import type * as exercises_mutations from "../exercises/mutations.js";
import type * as exercises_queries from "../exercises/queries.js";
import type * as http from "../http.js";
import type * as notifications_internal from "../notifications/internal.js";
import type * as notifications_mutations from "../notifications/mutations.js";
import type * as notifications_queries from "../notifications/queries.js";
import type * as pdf_actions from "../pdf/actions.js";
import type * as pdf_internal from "../pdf/internal.js";
import type * as plans_internal from "../plans/internal.js";
import type * as plans_mutations from "../plans/mutations.js";
import type * as plans_queries from "../plans/queries.js";
import type * as records_mutations from "../records/mutations.js";
import type * as records_queries from "../records/queries.js";
import type * as routines_mutations from "../routines/mutations.js";
import type * as routines_queries from "../routines/queries.js";
import type * as seed_reconcileUsers from "../seed/reconcileUsers.js";
import type * as seed_seedAccessCodes from "../seed/seedAccessCodes.js";
import type * as seed_seedAssignments from "../seed/seedAssignments.js";
import type * as seed_seedClinicMemberships from "../seed/seedClinicMemberships.js";
import type * as seed_seedClinics from "../seed/seedClinics.js";
import type * as seed_seedExercises from "../seed/seedExercises.js";
import type * as seed_seedPhase5 from "../seed/seedPhase5.js";
import type * as seed_seedPlans from "../seed/seedPlans.js";
import type * as seed_seedRoutines from "../seed/seedRoutines.js";
import type * as seed_seedUserDetails from "../seed/seedUserDetails.js";
import type * as seed_seedUsers from "../seed/seedUsers.js";
import type * as sessions_mutations from "../sessions/mutations.js";
import type * as sessions_queries from "../sessions/queries.js";
import type * as storage_actions from "../storage/actions.js";
import type * as storage_r2Client from "../storage/r2Client.js";
import type * as users_actions from "../users/actions.js";
import type * as users_details from "../users/details.js";
import type * as users_internal from "../users/internal.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_helpers/permissions": typeof _helpers_permissions;
  "_helpers/validators": typeof _helpers_validators;
  "accessCodes/mutations": typeof accessCodes_mutations;
  "accessCodes/queries": typeof accessCodes_queries;
  "accessTokens/actions": typeof accessTokens_actions;
  "accessTokens/mutations": typeof accessTokens_mutations;
  "accessTokens/queries": typeof accessTokens_queries;
  "assignments/mutations": typeof assignments_mutations;
  "assignments/queries": typeof assignments_queries;
  auth: typeof auth;
  "auth/actions": typeof auth_actions;
  "auth/mutations": typeof auth_mutations;
  "auth/queries": typeof auth_queries;
  "clinicMemberships/mutations": typeof clinicMemberships_mutations;
  "clinicMemberships/queries": typeof clinicMemberships_queries;
  "clinics/mutations": typeof clinics_mutations;
  "clinics/queries": typeof clinics_queries;
  "compliance/internal": typeof compliance_internal;
  "compliance/mutations": typeof compliance_mutations;
  "compliance/queries": typeof compliance_queries;
  "contact/actions": typeof contact_actions;
  crons: typeof crons;
  "dashboard/queries": typeof dashboard_queries;
  "email/actions": typeof email_actions;
  "email/templates": typeof email_templates;
  "exercises/mutations": typeof exercises_mutations;
  "exercises/queries": typeof exercises_queries;
  http: typeof http;
  "notifications/internal": typeof notifications_internal;
  "notifications/mutations": typeof notifications_mutations;
  "notifications/queries": typeof notifications_queries;
  "pdf/actions": typeof pdf_actions;
  "pdf/internal": typeof pdf_internal;
  "plans/internal": typeof plans_internal;
  "plans/mutations": typeof plans_mutations;
  "plans/queries": typeof plans_queries;
  "records/mutations": typeof records_mutations;
  "records/queries": typeof records_queries;
  "routines/mutations": typeof routines_mutations;
  "routines/queries": typeof routines_queries;
  "seed/reconcileUsers": typeof seed_reconcileUsers;
  "seed/seedAccessCodes": typeof seed_seedAccessCodes;
  "seed/seedAssignments": typeof seed_seedAssignments;
  "seed/seedClinicMemberships": typeof seed_seedClinicMemberships;
  "seed/seedClinics": typeof seed_seedClinics;
  "seed/seedExercises": typeof seed_seedExercises;
  "seed/seedPhase5": typeof seed_seedPhase5;
  "seed/seedPlans": typeof seed_seedPlans;
  "seed/seedRoutines": typeof seed_seedRoutines;
  "seed/seedUserDetails": typeof seed_seedUserDetails;
  "seed/seedUsers": typeof seed_seedUsers;
  "sessions/mutations": typeof sessions_mutations;
  "sessions/queries": typeof sessions_queries;
  "storage/actions": typeof storage_actions;
  "storage/r2Client": typeof storage_r2Client;
  "users/actions": typeof users_actions;
  "users/details": typeof users_details;
  "users/internal": typeof users_internal;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
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

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
