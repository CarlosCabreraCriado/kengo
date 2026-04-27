/**
 * Convierte un `_creationTime` de Convex (epoch ms) a ISO 8601.
 * Devuelve `undefined` si el valor es null/undefined/0.
 */
export function toIsoFromCreationTime(
  creationTime: number | undefined | null,
): string | undefined {
  return creationTime ? new Date(creationTime).toISOString() : undefined;
}

/**
 * Extrae el `_id` de un documento Convex como string. Vacío si falta.
 */
export function mapId(raw: { _id?: string } | null | undefined): string {
  return raw?._id ?? '';
}

/**
 * Devuelve los campos base del dominio (`id` + `dateCreated`) a partir de un
 * documento Convex con `_id` y `_creationTime`. Pensado para spreadear:
 *   `{ ...mapConvexBase(raw), titulo: raw.titulo, ... }`.
 */
export function mapConvexBase(
  raw: { _id?: string; _creationTime?: number } | null | undefined,
): { id: string; dateCreated: string | undefined } {
  return {
    id: mapId(raw),
    dateCreated: toIsoFromCreationTime(raw?._creationTime),
  };
}
