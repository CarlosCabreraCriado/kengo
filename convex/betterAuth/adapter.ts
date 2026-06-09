/**
 * Funciones del componente Better-Auth (LOCAL INSTALL).
 *
 * Replica el único fichero de funciones que exponía el componente empaquetado
 * (`@convex-dev/better-auth/src/component/adapter.ts`): los 7 CRUD que el cliente
 * (`authComponent`) invoca para leer/escribir las tablas de Better-Auth.
 *
 * Diferencia respecto al empaquetado: aquí pasamos NUESTRO `createAuthOptions`
 * (con el plugin `admin` activo) en vez de las opciones por defecto de la librería,
 * para que `getAuthTables(...)` derive el mismo conjunto de campos que declara
 * `./schema.ts` (incluidos los del plugin admin). `createApi` invoca
 * `createAuthOptions({})` en carga de módulo solo para derivar metadatos del schema
 * — no usa el adapter de base de datos, así que el ctx vacío es seguro.
 */

import { createApi } from "@convex-dev/better-auth";
import schema from "./schema";
import { createAuthOptions } from "../auth";

export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
} = createApi(schema, createAuthOptions);
