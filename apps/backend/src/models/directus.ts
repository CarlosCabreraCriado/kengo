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
  // Tabla puente usuarios_clinicas (con puesto directo)
  usuarios_clinicas: {
    id: ID;
    id_usuario: ID; // relación a users
    id_clinica: ID; // relación a clinicas
    id_puesto: number | null; // relación a Puestos
  };
  directus_users: {
    first_name: string;
  };
  // Tabla de clínicas
  clinicas: {
    id_clinica: number;
    nombre: string | null;
    telefono: string | null;
    email: string | null;
    direccion: string | null;
    postal: string | null;
    nif: string | null;
    logo: ID | null;
    color_primario: string | null;
    color_secundario: string | null;
    user_created: ID | null;
    date_created: string | null;
  };
  // Tabla de códigos de acceso
  codigos_acceso: {
    id: number;
    id_clinica: number;
    codigo: string;
    tipo: 'fisioterapeuta' | 'paciente';
    activo: boolean;
    usos_maximos: number | null;
    usos_actuales: number;
    fecha_expiracion: string | null;
    email: string | null;
    creado_por: ID;
    date_created: string;
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
    console.error("Error creando item en Directus:", collection, error);
    throw error; // Re-lanzar para que el llamador maneje el error
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

// =========================
//  FUNCIONES DE REGISTRO
// =========================

/**
 * Verifica si un email ya existe en Directus
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  const res = await fetch(
    `${process.env.DIRECTUS_URL}/users?filter[email][_eq]=${encodeURIComponent(email)}&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Error verificando email: ${res.status}`);
  }

  const json = await res.json();
  return json.data && json.data.length > 0;
}

/**
 * Obtiene una clinica por su codigo
 */
export async function getClinicaByCode(codigo: string): Promise<{ id: ID; nombre: string } | null> {
  const res = await fetch(
    `${process.env.DIRECTUS_URL}/items/clinicas?filter[codigo][_eq]=${encodeURIComponent(codigo)}&limit=1&fields=id,nombre`,
    {
      headers: {
        Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Error buscando clinica: ${res.status}`);
  }

  const json = await res.json();
  return json.data && json.data.length > 0 ? json.data[0] : null;
}

export interface CreateUserData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role: string;
}

/**
 * Crea un usuario en Directus
 */
export async function createUserInDirectus(userData: CreateUserData): Promise<{ id: string }> {
  const res = await fetch(`${process.env.DIRECTUS_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
    },
    body: JSON.stringify(userData),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error creando usuario: ${res.status} - ${text}`);
  }

  const json = await res.json();
  return { id: json.data.id };
}

/**
 * Crea la relacion usuario-clinica con puesto directo
 */
export async function createUsuarioClinica(
  userId: ID,
  clinicaId: ID,
  puesto: number
): Promise<{ id: ID }> {
  console.log('[createUsuarioClinica] Creando relación:', { userId, clinicaId, puesto });

  const result = await createOne('usuarios_clinicas', {
    id_usuario: userId,
    id_clinica: clinicaId,
    id_puesto: puesto,
  });

  console.log('[createUsuarioClinica] Resultado:', result);

  return { id: result?.id || 0 };
}

// =========================
//  FUNCIONES DE CLÍNICAS
// =========================

/**
 * Genera un código alfanumérico único de 8 caracteres
 */
function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I, O, 0, 1 para evitar confusión
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Obtiene un código de acceso por su código
 */
export async function getCodigoAcceso(codigo: string): Promise<Schema['codigos_acceso'] | null> {
  const res = await fetch(
    `${process.env.DIRECTUS_URL}/items/codigos_acceso?filter[codigo][_eq]=${encodeURIComponent(codigo)}&filter[activo][_eq]=true&limit=1&fields=*,id_clinica.id_clinica,id_clinica.nombre`,
    {
      headers: {
        Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Error buscando código: ${res.status}`);
  }

  const json = await res.json();
  return json.data && json.data.length > 0 ? json.data[0] : null;
}

/**
 * Valida un código de acceso y retorna información de validación
 * @param userEmail - Email del usuario que intenta usar el código (para validar códigos vinculados)
 */
export async function validarCodigoAcceso(codigo: string, userEmail?: string): Promise<{
  valido: boolean;
  error?: 'CODIGO_NO_ENCONTRADO' | 'CODIGO_INACTIVO' | 'CODIGO_EXPIRADO' | 'CODIGO_AGOTADO' | 'EMAIL_NO_COINCIDE';
  codigoData?: Schema['codigos_acceso'] & { id_clinica: { id_clinica: number; nombre: string } };
}> {
  const res = await fetch(
    `${process.env.DIRECTUS_URL}/items/codigos_acceso?filter[codigo][_eq]=${encodeURIComponent(codigo)}&limit=1&fields=*,id_clinica.id_clinica,id_clinica.nombre`,
    {
      headers: {
        Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Error buscando código: ${res.status}`);
  }

  const json = await res.json();
  const codigoData = json.data && json.data.length > 0 ? json.data[0] : null;

  if (!codigoData) {
    return { valido: false, error: 'CODIGO_NO_ENCONTRADO' };
  }

  if (!codigoData.activo) {
    return { valido: false, error: 'CODIGO_INACTIVO' };
  }

  if (codigoData.fecha_expiracion && new Date(codigoData.fecha_expiracion) < new Date()) {
    return { valido: false, error: 'CODIGO_EXPIRADO' };
  }

  if (codigoData.usos_maximos !== null && codigoData.usos_actuales >= codigoData.usos_maximos) {
    return { valido: false, error: 'CODIGO_AGOTADO' };
  }

  // Verificar email vinculado si el código tiene uno
  if (codigoData.email && userEmail) {
    const codigoEmail = codigoData.email.toLowerCase().trim();
    const usuarioEmail = userEmail.toLowerCase().trim();
    if (codigoEmail !== usuarioEmail) {
      return { valido: false, error: 'EMAIL_NO_COINCIDE' };
    }
  }

  return { valido: true, codigoData };
}

/**
 * Incrementa el contador de usos de un código
 */
export async function incrementarUsoCodigo(codigoId: number): Promise<void> {
  const res = await fetch(
    `${process.env.DIRECTUS_URL}/items/codigos_acceso/${codigoId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
      },
      body: JSON.stringify({
        usos_actuales: { _inc: 1 },
      }),
    }
  );

  if (!res.ok) {
    // Intentar con incremento manual
    const getRes = await fetch(
      `${process.env.DIRECTUS_URL}/items/codigos_acceso/${codigoId}?fields=usos_actuales`,
      {
        headers: {
          Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
        },
      }
    );
    if (getRes.ok) {
      const { data } = await getRes.json();
      await fetch(
        `${process.env.DIRECTUS_URL}/items/codigos_acceso/${codigoId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
          },
          body: JSON.stringify({
            usos_actuales: (data.usos_actuales || 0) + 1,
          }),
        }
      );
    }
  }
}

/**
 * Crea una nueva clínica
 */
export async function createClinica(data: {
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  postal?: string;
  nif?: string;
  color_primario?: string;
}, creadorId: ID): Promise<{ id_clinica: number }> {
  const res = await fetch(`${process.env.DIRECTUS_URL}/items/clinicas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
    },
    body: JSON.stringify({
      ...data,
      user_created: creadorId,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error creando clínica: ${res.status} - ${text}`);
  }

  const json = await res.json();
  return { id_clinica: json.data.id_clinica };
}

/**
 * Genera un nuevo código de acceso para una clínica
 */
export async function createCodigoAcceso(data: {
  id_clinica: number;
  tipo: 'fisioterapeuta' | 'paciente';
  usos_maximos?: number | null;
  dias_expiracion?: number | null;
  email?: string | null;
}, creadoPor: ID): Promise<{ codigo: string; id: number }> {
  const codigo = generateAccessCode();

  let fechaExpiracion: string | null = null;
  if (data.dias_expiracion && data.dias_expiracion > 0) {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + data.dias_expiracion);
    fechaExpiracion = expDate.toISOString();
  }

  // Normalizar email a minúsculas si existe
  const emailNormalizado = data.email ? data.email.toLowerCase().trim() : null;

  const res = await fetch(`${process.env.DIRECTUS_URL}/items/codigos_acceso`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
    },
    body: JSON.stringify({
      id_clinica: data.id_clinica,
      codigo,
      tipo: data.tipo,
      activo: true,
      usos_maximos: data.usos_maximos ?? null,
      usos_actuales: 0,
      fecha_expiracion: fechaExpiracion,
      email: emailNormalizado,
      creado_por: creadoPor,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error creando código: ${res.status} - ${text}`);
  }

  const json = await res.json();
  return { codigo, id: json.data.id };
}

/**
 * Obtiene los códigos de acceso de una clínica
 */
export async function getCodigosClinica(clinicaId: number): Promise<Schema['codigos_acceso'][]> {
  const res = await fetch(
    `${process.env.DIRECTUS_URL}/items/codigos_acceso?filter[id_clinica][_eq]=${clinicaId}&sort=-date_created`,
    {
      headers: {
        Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Error obteniendo códigos: ${res.status}`);
  }

  const json = await res.json();
  return json.data || [];
}

/**
 * Desactiva un código de acceso
 */
export async function desactivarCodigo(codigoId: number): Promise<void> {
  const res = await fetch(
    `${process.env.DIRECTUS_URL}/items/codigos_acceso/${codigoId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
      },
      body: JSON.stringify({ activo: false }),
    }
  );

  if (!res.ok) {
    throw new Error(`Error desactivando código: ${res.status}`);
  }
}

/**
 * Reactiva un código de acceso
 */
export async function reactivarCodigo(codigoId: number): Promise<void> {
  const res = await fetch(
    `${process.env.DIRECTUS_URL}/items/codigos_acceso/${codigoId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
      },
      body: JSON.stringify({ activo: true }),
    }
  );

  if (!res.ok) {
    throw new Error(`Error reactivando código: ${res.status}`);
  }
}

/**
 * Obtiene el puesto de un usuario en una clínica
 */
export async function getPuestoUsuarioEnClinica(userId: ID, clinicaId: number): Promise<number | null> {
  const url = `${process.env.DIRECTUS_URL}/items/usuarios_clinicas?filter[id_usuario][_eq]=${userId}&filter[id_clinica][_eq]=${clinicaId}&fields=id,id_puesto&limit=1`;
  console.log('[getPuestoUsuarioEnClinica] URL:', url);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
    },
  });

  if (!res.ok) {
    console.log('[getPuestoUsuarioEnClinica] Fetch error:', res.status, res.statusText);
    return null;
  }

  const json = await res.json();
  console.log('[getPuestoUsuarioEnClinica] Response:', JSON.stringify(json, null, 2));

  if (!json.data || json.data.length === 0) {
    console.log('[getPuestoUsuarioEnClinica] No data found');
    return null;
  }

  const puesto = json.data[0].id_puesto;
  console.log('[getPuestoUsuarioEnClinica] Puesto:', puesto);
  return puesto;
}

/**
 * Verifica si un usuario ya está vinculado a una clínica
 */
export async function usuarioYaVinculado(userId: ID, clinicaId: number): Promise<boolean> {
  const res = await fetch(
    `${process.env.DIRECTUS_URL}/items/usuarios_clinicas?filter[id_usuario][_eq]=${userId}&filter[id_clinica][_eq]=${clinicaId}&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
      },
    }
  );

  if (!res.ok) {
    return false;
  }

  const json = await res.json();
  return json.data && json.data.length > 0;
}
