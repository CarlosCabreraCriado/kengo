import "dotenv/config";
import {
  createDirectus,
  rest,
  staticToken,
  authentication,
  createItem,
  createItems,
  readItem,
  readItems,
  updateItem,
  deleteItem,
  withToken,
  type DirectusClient,
  UnpackList,
} from "@directus/sdk";

export type ID = string | number;
export type Schema = {
  // Colección personalizada para magic link / QR
  login_tokens: {
    id: ID;
    user: ID; // relación a directus.users
    token: string; // aleatorio (único)
    expires_at: string; // ISO datetime
    consumed_at: string | null;
    created_at: string;
  };
  // Tabla puente usuarios_clinicas que mencionas
  usuarios_clinicas: {
    id: ID;
    id_usuario: ID; // relación a users
    id_clinica: ID; // relación a clinicas
    puesto: number; // 2 = paciente (tu caso)
  };
  directus_users: {
    first_name: string;
  };
  // Si quieres tipar más colecciones, añádelas aquí...
};

const url = process.env.DIRECTUS_URL;
if (!url) throw new Error("Falta DIRECTUS_URL en .env");

const staticTokenValue = process.env.DIRECTUS_STATIC_TOKEN || "";

export let directus = createDirectus<Schema>(url).with(rest());
directus = directus.with(staticToken(staticTokenValue));

export async function directusLogin(email: string, password: string) {
  const res = await fetch(`${process.env.DIRECTUS_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // mode session para recibir cookies httpOnly
    body: JSON.stringify({ email, password, mode: "session" }),
  });
  if (!res.ok) throw new Error(`Directus login ${res.status}`);

  // Obtener headers Set-Cookie para reenviar al cliente
  const setCookieHeader = res.headers.get('set-cookie');
  const json = await res.json();

  return {
    data: json.data,
    setCookieHeader
  };
}

export async function patchUserMagicFields(
  userId: string,
  data: {
    url: string;
  },
) {
  const res = await fetch(`${process.env.DIRECTUS_URL}/users/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
    },
    body: JSON.stringify({
      magic_link_url: data.url,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH users failed: ${res.status} ${text}`);
  }
  return (await res.json()).data;
}

// Helpers comunes (CRUD genérico con items)
export async function createOne<T extends keyof Schema>(
  collection: T,
  data: Partial<UnpackList<Schema[T]>>,
) {
  try {
    console.log("Creando item en Directus:", collection, data);

    return directus.request(createItem(collection, data as any));
  } catch (error) {
    console.error("Error creando item en Directus:", error);
  }
}

export async function createMany<T extends keyof Schema>(
  collection: T,
  data: Partial<UnpackList<Schema[T]>>[],
) {
  return directus.request(createItems(collection, data as any));
}

export async function getOne<T extends keyof Schema>(
  collection: never,
  id: ID,
  params?: any,
) {
  return directus.request(readItem(collection, id, params));
}

export async function getMany(collection: string, params?: any) {
  return directus.request(readItems(collection as never, params));
}

export async function patchOne<T extends keyof Schema>(
  collection: string,
  id: ID,
  data: Partial<Schema[T]>,
) {
  return directus.request(updateItem(collection as never, id, data as any));
}

export async function removeOne<T extends keyof Schema>(collection: T, id: ID) {
  return directus.request(deleteItem(collection, id));
}

export interface DirectusUserData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  telefono: string | null;
  direccion: string | null;
}

export async function getUserById(userId: string): Promise<DirectusUserData | null> {
  const res = await fetch(
    `${process.env.DIRECTUS_URL}/users/${userId}?fields=id,first_name,last_name,email,telefono,direccion`,
    {
      headers: {
        Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
      },
    }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.data;
}

export function getFileUrl(fileId: string): string {
  return `${process.env.DIRECTUS_URL}/assets/${fileId}`;
}
