import { defineComponent } from "convex/server";

// Local install del componente Better-Auth.
//
// IMPORTANTE: el nombre del componente DEBE ser exactamente "betterAuth" — el
// mismo que usaba el componente empaquetado (`@convex-dev/better-auth/convex.config`,
// que hace `defineComponent("betterAuth")`). Convex monta los componentes por
// nombre, así que conservarlo garantiza que el local install apunta a las MISMAS
// tablas físicas (user, session, account, jwks, ...) y no desincroniza ni pierde
// usuarios/sesiones existentes en producción.
//
// Pasamos a local install para poder extender el schema del componente con los
// campos que añade el plugin `admin` de Better-Auth (impersonación):
//   user: role, banned, banReason, banExpires
//   session: impersonatedBy
// El componente empaquetado tiene el schema fijo y con validación estricta, por lo
// que rechazaría esos inserts. Ver convex/betterAuth/schema.ts.
const component = defineComponent("betterAuth");

export default component;
