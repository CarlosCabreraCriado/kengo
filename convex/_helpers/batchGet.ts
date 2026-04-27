import { QueryCtx } from "../_generated/server";
import { DataModel } from "../_generated/dataModel";
import { GenericId } from "convex/values";

type TableNames = keyof DataModel;
type Doc<T extends TableNames> = DataModel[T]["document"];

// Carga en paralelo varios documentos por id, deduplicando para evitar el
// patrón Promise.all(ids.map(id => ctx.db.get(id))) cuando los ids se repiten.
// Devuelve un array alineado con `ids` (mismo orden, mismo tamaño).
export async function batchGet<T extends TableNames>(
  ctx: QueryCtx,
  ids: GenericId<T>[],
): Promise<(Doc<T> | null)[]> {
  const unique = Array.from(new Set(ids));
  const docs = await Promise.all(unique.map((id) => ctx.db.get(id)));
  const map = new Map<GenericId<T>, Doc<T> | null>();
  unique.forEach((id, i) => map.set(id, docs[i] as Doc<T> | null));
  return ids.map((id) => map.get(id) ?? null);
}

// Variante que devuelve un Map<id, Doc> para lookup directo cuando el orden
// del input no importa (ej. enriquecer respuestas).
export async function batchGetMap<T extends TableNames>(
  ctx: QueryCtx,
  ids: GenericId<T>[],
): Promise<Map<GenericId<T>, Doc<T>>> {
  const unique = Array.from(new Set(ids));
  const docs = await Promise.all(unique.map((id) => ctx.db.get(id)));
  const map = new Map<GenericId<T>, Doc<T>>();
  unique.forEach((id, i) => {
    const doc = docs[i] as Doc<T> | null;
    if (doc) map.set(id, doc);
  });
  return map;
}
