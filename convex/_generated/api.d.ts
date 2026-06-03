/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _helpers_authorization from "../_helpers/authorization.js";
import type * as _helpers_batchGet from "../_helpers/batchGet.js";
import type * as _helpers_datetime from "../_helpers/datetime.js";
import type * as _helpers_expectedExercises from "../_helpers/expectedExercises.js";
import type * as _helpers_mutationWithTriggers from "../_helpers/mutationWithTriggers.js";
import type * as _helpers_patientAccess from "../_helpers/patientAccess.js";
import type * as _helpers_permissions from "../_helpers/permissions.js";
import type * as _helpers_planStatus from "../_helpers/planStatus.js";
import type * as _helpers_rollupComputation from "../_helpers/rollupComputation.js";
import type * as _helpers_validators from "../_helpers/validators.js";
import type * as accessCodes_actions from "../accessCodes/actions.js";
import type * as accessCodes_mutations from "../accessCodes/mutations.js";
import type * as accessCodes_queries from "../accessCodes/queries.js";
import type * as accessTokens_actions from "../accessTokens/actions.js";
import type * as accessTokens_mutations from "../accessTokens/mutations.js";
import type * as accessTokens_queries from "../accessTokens/queries.js";
import type * as aggregates_executionsByClinic from "../aggregates/executionsByClinic.js";
import type * as aggregates_executionsByExercise from "../aggregates/executionsByExercise.js";
import type * as aggregates_executionsByPaciente from "../aggregates/executionsByPaciente.js";
import type * as aggregates_executionsByPacienteDolor from "../aggregates/executionsByPacienteDolor.js";
import type * as aggregates_patientsByClinicAdherencia from "../aggregates/patientsByClinicAdherencia.js";
import type * as aggregates_patientsByClinicRiskScore from "../aggregates/patientsByClinicRiskScore.js";
import type * as aggregates_plansByClinicActive from "../aggregates/plansByClinicActive.js";
import type * as aggregates_sessionsByClinic from "../aggregates/sessionsByClinic.js";
import type * as aggregates_triggers from "../aggregates/triggers.js";
import type * as alerts_internal from "../alerts/internal.js";
import type * as alerts_mutations from "../alerts/mutations.js";
import type * as alerts_queries from "../alerts/queries.js";
import type * as assignments_mutations from "../assignments/mutations.js";
import type * as assignments_queries from "../assignments/queries.js";
import type * as auth from "../auth.js";
import type * as auth_actions from "../auth/actions.js";
import type * as auth_mutations from "../auth/mutations.js";
import type * as auth_queries from "../auth/queries.js";
import type * as billing__helpers from "../billing/_helpers.js";
import type * as billing_actions from "../billing/actions.js";
import type * as billing_internal from "../billing/internal.js";
import type * as billing_migrations from "../billing/migrations.js";
import type * as billing_queries from "../billing/queries.js";
import type * as clinicMemberships_mutations from "../clinicMemberships/mutations.js";
import type * as clinicMemberships_queries from "../clinicMemberships/queries.js";
import type * as clinics_internal from "../clinics/internal.js";
import type * as clinics_mutations from "../clinics/mutations.js";
import type * as clinics_queries from "../clinics/queries.js";
import type * as compliance_internal from "../compliance/internal.js";
import type * as conversations_mutations from "../conversations/mutations.js";
import type * as conversations_queries from "../conversations/queries.js";
import type * as crons from "../crons.js";
import type * as dashboard_queries from "../dashboard/queries.js";
import type * as email_actions from "../email/actions.js";
import type * as email_templates from "../email/templates.js";
import type * as executions_mutations from "../executions/mutations.js";
import type * as executions_queries from "../executions/queries.js";
import type * as exercises_mutations from "../exercises/mutations.js";
import type * as exercises_queries from "../exercises/queries.js";
import type * as http from "../http.js";
import type * as me_queries from "../me/queries.js";
import type * as migrations_backfillClinicOwner from "../migrations/backfillClinicOwner.js";
import type * as migrations_backfillDailyByClinic from "../migrations/backfillDailyByClinic.js";
import type * as migrations_backfillExecutionsByPaciente from "../migrations/backfillExecutionsByPaciente.js";
import type * as migrations_backfillMonthlyByClinic from "../migrations/backfillMonthlyByClinic.js";
import type * as migrations_backfillPatientDirectAggregates from "../migrations/backfillPatientDirectAggregates.js";
import type * as migrations_backfillPlanClinicId from "../migrations/backfillPlanClinicId.js";
import type * as migrations_backfillPlanClinicIdFallback from "../migrations/backfillPlanClinicIdFallback.js";
import type * as migrations_backfillPlanClinicIdFromFisio from "../migrations/backfillPlanClinicIdFromFisio.js";
import type * as migrations_backfillPlanClinicIdFromPatient from "../migrations/backfillPlanClinicIdFromPatient.js";
import type * as migrations_backfillRollupsByClinic from "../migrations/backfillRollupsByClinic.js";
import type * as migrations_backfillRoutineClinicId from "../migrations/backfillRoutineClinicId.js";
import type * as migrations_backfillSessionsByClinic from "../migrations/backfillSessionsByClinic.js";
import type * as migrations_backfillWeeklyByClinic from "../migrations/backfillWeeklyByClinic.js";
import type * as migrations_clearExecutionAggregates from "../migrations/clearExecutionAggregates.js";
import type * as migrations_deleteClinicCascade from "../migrations/deleteClinicCascade.js";
import type * as migrations_deleteUserByEmail from "../migrations/deleteUserByEmail.js";
import type * as migrations_deleteUserByEmailMutation from "../migrations/deleteUserByEmailMutation.js";
import type * as migrations_disablePatientCodesWithoutEmail from "../migrations/disablePatientCodesWithoutEmail.js";
import type * as migrations_inspectPendingPlans from "../migrations/inspectPendingPlans.js";
import type * as migrations_legacyUsers from "../migrations/legacyUsers.js";
import type * as migrations_markVersionedAsModificado from "../migrations/markVersionedAsModificado.js";
import type * as migrations_patchPlanClinicId from "../migrations/patchPlanClinicId.js";
import type * as migrations_validation from "../migrations/validation.js";
import type * as notificationPreferences_mutations from "../notificationPreferences/mutations.js";
import type * as notificationPreferences_queries from "../notificationPreferences/queries.js";
import type * as pdf_actions from "../pdf/actions.js";
import type * as pdf_internal from "../pdf/internal.js";
import type * as plans_internal from "../plans/internal.js";
import type * as plans_mutations from "../plans/mutations.js";
import type * as plans_queries from "../plans/queries.js";
import type * as push_actions from "../push/actions.js";
import type * as push_crons from "../push/crons.js";
import type * as push_mutations from "../push/mutations.js";
import type * as push_queries from "../push/queries.js";
import type * as rollups_internal from "../rollups/internal.js";
import type * as rollups_mutations from "../rollups/mutations.js";
import type * as rollups_queries from "../rollups/queries.js";
import type * as routines_mutations from "../routines/mutations.js";
import type * as routines_queries from "../routines/queries.js";
import type * as sessions_internal from "../sessions/internal.js";
import type * as sessions_mutations from "../sessions/mutations.js";
import type * as sessions_queries from "../sessions/queries.js";
import type * as snapshots_internal from "../snapshots/internal.js";
import type * as snapshots_queries from "../snapshots/queries.js";
import type * as storage_actions from "../storage/actions.js";
import type * as storage_cleanup from "../storage/cleanup.js";
import type * as storage_internal from "../storage/internal.js";
import type * as storage_r2Client from "../storage/r2Client.js";
import type * as sync_actions from "../sync/actions.js";
import type * as sync_directusClient from "../sync/directusClient.js";
import type * as sync_internal from "../sync/internal.js";
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
  "_helpers/authorization": typeof _helpers_authorization;
  "_helpers/batchGet": typeof _helpers_batchGet;
  "_helpers/datetime": typeof _helpers_datetime;
  "_helpers/expectedExercises": typeof _helpers_expectedExercises;
  "_helpers/mutationWithTriggers": typeof _helpers_mutationWithTriggers;
  "_helpers/patientAccess": typeof _helpers_patientAccess;
  "_helpers/permissions": typeof _helpers_permissions;
  "_helpers/planStatus": typeof _helpers_planStatus;
  "_helpers/rollupComputation": typeof _helpers_rollupComputation;
  "_helpers/validators": typeof _helpers_validators;
  "accessCodes/actions": typeof accessCodes_actions;
  "accessCodes/mutations": typeof accessCodes_mutations;
  "accessCodes/queries": typeof accessCodes_queries;
  "accessTokens/actions": typeof accessTokens_actions;
  "accessTokens/mutations": typeof accessTokens_mutations;
  "accessTokens/queries": typeof accessTokens_queries;
  "aggregates/executionsByClinic": typeof aggregates_executionsByClinic;
  "aggregates/executionsByExercise": typeof aggregates_executionsByExercise;
  "aggregates/executionsByPaciente": typeof aggregates_executionsByPaciente;
  "aggregates/executionsByPacienteDolor": typeof aggregates_executionsByPacienteDolor;
  "aggregates/patientsByClinicAdherencia": typeof aggregates_patientsByClinicAdherencia;
  "aggregates/patientsByClinicRiskScore": typeof aggregates_patientsByClinicRiskScore;
  "aggregates/plansByClinicActive": typeof aggregates_plansByClinicActive;
  "aggregates/sessionsByClinic": typeof aggregates_sessionsByClinic;
  "aggregates/triggers": typeof aggregates_triggers;
  "alerts/internal": typeof alerts_internal;
  "alerts/mutations": typeof alerts_mutations;
  "alerts/queries": typeof alerts_queries;
  "assignments/mutations": typeof assignments_mutations;
  "assignments/queries": typeof assignments_queries;
  auth: typeof auth;
  "auth/actions": typeof auth_actions;
  "auth/mutations": typeof auth_mutations;
  "auth/queries": typeof auth_queries;
  "billing/_helpers": typeof billing__helpers;
  "billing/actions": typeof billing_actions;
  "billing/internal": typeof billing_internal;
  "billing/migrations": typeof billing_migrations;
  "billing/queries": typeof billing_queries;
  "clinicMemberships/mutations": typeof clinicMemberships_mutations;
  "clinicMemberships/queries": typeof clinicMemberships_queries;
  "clinics/internal": typeof clinics_internal;
  "clinics/mutations": typeof clinics_mutations;
  "clinics/queries": typeof clinics_queries;
  "compliance/internal": typeof compliance_internal;
  "conversations/mutations": typeof conversations_mutations;
  "conversations/queries": typeof conversations_queries;
  crons: typeof crons;
  "dashboard/queries": typeof dashboard_queries;
  "email/actions": typeof email_actions;
  "email/templates": typeof email_templates;
  "executions/mutations": typeof executions_mutations;
  "executions/queries": typeof executions_queries;
  "exercises/mutations": typeof exercises_mutations;
  "exercises/queries": typeof exercises_queries;
  http: typeof http;
  "me/queries": typeof me_queries;
  "migrations/backfillClinicOwner": typeof migrations_backfillClinicOwner;
  "migrations/backfillDailyByClinic": typeof migrations_backfillDailyByClinic;
  "migrations/backfillExecutionsByPaciente": typeof migrations_backfillExecutionsByPaciente;
  "migrations/backfillMonthlyByClinic": typeof migrations_backfillMonthlyByClinic;
  "migrations/backfillPatientDirectAggregates": typeof migrations_backfillPatientDirectAggregates;
  "migrations/backfillPlanClinicId": typeof migrations_backfillPlanClinicId;
  "migrations/backfillPlanClinicIdFallback": typeof migrations_backfillPlanClinicIdFallback;
  "migrations/backfillPlanClinicIdFromFisio": typeof migrations_backfillPlanClinicIdFromFisio;
  "migrations/backfillPlanClinicIdFromPatient": typeof migrations_backfillPlanClinicIdFromPatient;
  "migrations/backfillRollupsByClinic": typeof migrations_backfillRollupsByClinic;
  "migrations/backfillRoutineClinicId": typeof migrations_backfillRoutineClinicId;
  "migrations/backfillSessionsByClinic": typeof migrations_backfillSessionsByClinic;
  "migrations/backfillWeeklyByClinic": typeof migrations_backfillWeeklyByClinic;
  "migrations/clearExecutionAggregates": typeof migrations_clearExecutionAggregates;
  "migrations/deleteClinicCascade": typeof migrations_deleteClinicCascade;
  "migrations/deleteUserByEmail": typeof migrations_deleteUserByEmail;
  "migrations/deleteUserByEmailMutation": typeof migrations_deleteUserByEmailMutation;
  "migrations/disablePatientCodesWithoutEmail": typeof migrations_disablePatientCodesWithoutEmail;
  "migrations/inspectPendingPlans": typeof migrations_inspectPendingPlans;
  "migrations/legacyUsers": typeof migrations_legacyUsers;
  "migrations/markVersionedAsModificado": typeof migrations_markVersionedAsModificado;
  "migrations/patchPlanClinicId": typeof migrations_patchPlanClinicId;
  "migrations/validation": typeof migrations_validation;
  "notificationPreferences/mutations": typeof notificationPreferences_mutations;
  "notificationPreferences/queries": typeof notificationPreferences_queries;
  "pdf/actions": typeof pdf_actions;
  "pdf/internal": typeof pdf_internal;
  "plans/internal": typeof plans_internal;
  "plans/mutations": typeof plans_mutations;
  "plans/queries": typeof plans_queries;
  "push/actions": typeof push_actions;
  "push/crons": typeof push_crons;
  "push/mutations": typeof push_mutations;
  "push/queries": typeof push_queries;
  "rollups/internal": typeof rollups_internal;
  "rollups/mutations": typeof rollups_mutations;
  "rollups/queries": typeof rollups_queries;
  "routines/mutations": typeof routines_mutations;
  "routines/queries": typeof routines_queries;
  "sessions/internal": typeof sessions_internal;
  "sessions/mutations": typeof sessions_mutations;
  "sessions/queries": typeof sessions_queries;
  "snapshots/internal": typeof snapshots_internal;
  "snapshots/queries": typeof snapshots_queries;
  "storage/actions": typeof storage_actions;
  "storage/cleanup": typeof storage_cleanup;
  "storage/internal": typeof storage_internal;
  "storage/r2Client": typeof storage_r2Client;
  "sync/actions": typeof sync_actions;
  "sync/directusClient": typeof sync_directusClient;
  "sync/internal": typeof sync_internal;
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
  stripe: import("@convex-dev/stripe/_generated/component.js").ComponentApi<"stripe">;
  executionsByPaciente: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"executionsByPaciente">;
  executionsByClinic: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"executionsByClinic">;
  executionsByExercise: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"executionsByExercise">;
  executionsByPacienteDolor: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"executionsByPacienteDolor">;
  sessionsByClinic: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"sessionsByClinic">;
  plansByClinicActive: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"plansByClinicActive">;
  patientsByClinicAdherencia: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"patientsByClinicAdherencia">;
  patientsByClinicRiskScore: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"patientsByClinicRiskScore">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
