import { customCtx, customMutation } from "convex-helpers/server/customFunctions";
import {
  mutation as rawMutation,
  internalMutation as rawInternalMutation,
} from "../_generated/server";
import { triggers } from "../aggregates/triggers";

/**
 * Wrappers de `mutation` e `internalMutation` que aplican los triggers de
 * aggregate registrados en `convex/aggregates/triggers.ts`.
 *
 * Cualquier archivo que escriba en `exerciseExecutions`, `sessions` o `plans`
 * DEBE importar `mutation`/`internalMutation` desde aquí en lugar de
 * `_generated/server` — de lo contrario los aggregates se desincronizan
 * silenciosamente respecto a la tabla origen.
 *
 * El resto de archivos pueden seguir importando de `_generated/server`. No es
 * obligatorio migrarlos.
 */
export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB));
export const internalMutation = customMutation(
  rawInternalMutation,
  customCtx(triggers.wrapDB),
);
