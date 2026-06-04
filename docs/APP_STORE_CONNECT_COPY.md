# Copy para App Store Connect — Kengo iOS

Copy listo para pegar en cada campo de App Store Connect. Idioma primario: **Español (España)**. Todos los textos respetan el límite de caracteres de Apple y la persona de marca (cálido, profesional, motivador) descrita en `docs/LANDING_PAGE_CONTENT.md`.

> Convención: en cada bloque indico **(N/MAX)** con el cómputo de caracteres. Apple cuenta espacios y emojis. Las opciones marcadas como **(recomendada)** son las que enviaría yo si no quieres pensarlo más.

---

## 1. Información de la app (App Information)

Estos campos se rellenan una sola vez por idioma y no requieren nuevo build para cambiarlos (salvo el nombre).

### 1.1 Name — el nombre público (max 30)

> Aparece bajo el icono en la home, en resultados de búsqueda y en la ficha de App Store.

- **(recomendada)** `Kengo: Fisio en casa` — **(20/30)**
- Alternativa más corta: `Kengo` — **(5/30)**
- Alternativa más descriptiva: `Kengo - Tu fisio contigo` — **(24/30)**

> Apple permite usar el subtitle (siguiente campo) para añadir descriptor. Mantener el `Name` corto y memorable funciona mejor para retención. Si optas por solo "Kengo", asegúrate de un subtitle potente.

### 1.2 Subtitle — descriptor bajo el nombre (max 30)

> Aparece bajo el nombre en la ficha de App Store. Indexable por búsqueda (igual que el nombre y los keywords). Apple lo recomienda para clarificar de qué va la app.

- **(recomendada)** `Fisioterapia personalizada` — **(26/30)**
- Alternativa orientada a pacientes: `Tu fisio, siempre contigo` — **(25/30)**
- Alternativa orientada a profesionales: `Planes de ejercicios y fisio` — **(28/30)**

### 1.3 Bundle ID

Ya configurado: `com.kengoapp.app`. No tocar.

### 1.4 Primary Language

`Spanish (Spain)`. Si en el futuro publicáis en LATAM podéis añadir locales adicionales sin necesidad de nuevo binario.

### 1.5 Category

- **Primary**: `Health & Fitness` (Salud y forma física). Encaja con el público (pacientes haciendo ejercicio guiado) y evita la fricción de la categoría Medical (review más estricta, requiere declaración HIPAA-like).
- **Secondary**: `Medical` (Medicina) — opcional. Aumenta visibilidad para búsquedas profesionales (fisios buscando software) a coste de una revisión algo más exigente. Si quieres minimizar fricción en la primera revisión, déjalo en blanco y lo añades después.

### 1.6 Content Rights

- Does your app contain, show, or access third-party content? → **No** (los vídeos de ejercicios son producción propia / con licencia de Kengo, no third-party stream).

### 1.7 Age Rating

Rellenar el cuestionario. Para Kengo lo razonable es:

| Categoría | Respuesta |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Sexual Content or Nudity | None |
| Profanity or Crude Humor | None |
| Alcohol, Tobacco, or Drug Use | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes | None |
| Medical/Treatment Information | **Infrequent/Mild** (la app guía ejercicios de rehabilitación supervisados por un fisioterapeuta; no diagnostica). |
| Gambling | No |
| Unrestricted Web Access | **No** (el WebView solo carga el bundle de la app + APIs propias). |
| User-Generated Content shared with all users | **No** (la comunicación es 1:1 fisio↔paciente, no público). |

→ Rating resultante: **4+**.

---

## 2. App Privacy

App Store Connect → **App Privacy → Get Started**. Apple obliga a declarar datos antes del primer envío externo.

### 2.1 Data Types collected by Kengo

Marca **Yes, we collect data**. Luego marca:

| Categoría | Tipo | Linked to user? | Used for tracking? | Purpose |
|---|---|---|---|---|
| Contact Info | Email Address | Sí | No | App Functionality, Account Management |
| Contact Info | Name | Sí | No | App Functionality |
| Health & Fitness | Health (datos de ejercicio, dolor reportado, adherencia) | Sí | No | App Functionality, Product Personalization |
| Identifiers | User ID | Sí | No | App Functionality |
| Usage Data | Product Interaction | Sí | No | Analytics |
| Diagnostics | Crash Data | No | No | App Functionality |
| Diagnostics | Performance Data | No | No | Analytics |

### 2.2 Tracking

**Does your app collect data used to track the user?** → **No**.

> Kengo no usa Firebase Analytics ni ads; FCM se usa solo para push, no para tracking. `IS_ADS_ENABLED` y `IS_ANALYTICS_ENABLED` están en `false` en `GoogleService-Info.plist`.

### 2.3 Privacy Policy URL

**Required**. Necesitas tener publicada una política de privacidad accesible públicamente en HTTPS.

- URL sugerida: `https://kengoapp.com/legal/privacidad` (o la ruta donde la sirváis).
- Si todavía no existe la URL real, créala antes de mandar a TestFlight externo. Para TestFlight interno no la exige Apple pero sí App Store Connect en la pantalla de configuración → publicad un placeholder real cuanto antes.

---

## 3. Promotional Text — actualizable sin nuevo build (max 170)

> Aparece en la parte superior de la descripción en la ficha de App Store. Se puede editar en cualquier momento sin necesidad de nuevo binario, ideal para anuncios temporales (campañas, novedades estacionales, descuentos).

**(recomendada)** **(154/170)**

```
Kengo conecta a fisioterapeutas y pacientes para hacer del tratamiento algo medible: planes guiados con vídeo, seguimiento del dolor y de la adherencia real.
```

Alternativa más orientada a captación (paciente final) **(168/170)**:

```
Recupérate con tu fisio guiándote desde la app: vídeos de cada ejercicio, recordatorios diarios y un canal directo con tu fisioterapeuta entre consultas.
```

Alternativa modo lanzamiento **(146/170)**:

```
Ya disponible: crea planes de rehabilitación en minutos, monitoriza la adherencia de tus pacientes y comunica progresos sin perder visitas presenciales.
```

---

## 4. Description — copy principal de la ficha (max 4000)

> Apple permite hasta 4000 caracteres. Lo óptimo está en ~1500-2500: las primeras 3-4 líneas se ven sin expandir, así que el gancho debe estar arriba.

**(recomendada)** **(2434/4000)**

```
Kengo es la plataforma de fisioterapia que mantiene a fisioterapeutas y pacientes conectados entre consultas. Crea planes de ejercicios personalizados, guía cada sesión con vídeo profesional y mide el progreso real con datos objetivos de adherencia y dolor.

Diseñada en colaboración con fisioterapeutas en activo, Kengo une lo que antes vivía en papel, WhatsApp y memoria: un plan claro para el paciente y métricas accionables para el profesional.

— PARA PACIENTES —

• Tu actividad diaria a un toque: qué ejercicios tocan hoy, cuántas series y cuánto descanso.
• Vídeo profesional de cada ejercicio para no quedarte con dudas sobre la técnica.
• Sesiones guiadas paso a paso, con contador de series y temporizador de descanso integrado.
• Registra cómo te sientes después de cada sesión: nivel de dolor, dificultad y notas para tu fisio.
• Visualiza tu progreso con rachas, sesiones completadas y evolución del dolor en el tiempo.
• Recordatorios push para no perder tu rutina sin convertirla en una obligación.

— PARA FISIOTERAPEUTAS —

• Catálogo amplio de ejercicios con vídeo, organizados por zona corporal y patología.
• Constructor visual de planes: arrastra ejercicios, asigna días de la semana, define series y repeticiones.
• Plantillas reutilizables: convierte tus planes más efectivos en rutinas listas para futuros pacientes.
• Gestión de pacientes con historial completo, código QR de invitación y modo paciente para vivir la app desde su perspectiva.
• Métricas de adherencia y evolución del dolor que sustituyen a la pregunta "¿has hecho los ejercicios?".
• Comunicación 1:1 con cada paciente desde la app — sin WhatsApp y sin perder contexto.

— PARA CLÍNICAS —

• Soporte multi-clínica: un mismo profesional puede pertenecer a varias clínicas y cambiar de contexto al instante.
• Gestión del equipo: añade fisioterapeutas y administradores con códigos de acceso seguros.
• Personalización con el logo y los colores corporativos de tu clínica.
• Suscripción por clínica, alineada con cómo factura un centro real.

— DISEÑO MOBILE-FIRST —

Kengo está diseñada para usarse desde el móvil, donde el paciente realmente hace los ejercicios. Interfaz cálida, animaciones suaves, sin jerga clínica innecesaria. Cuidamos también el modo descanso porque la recuperación lo necesita.

— PRIVACIDAD Y SEGURIDAD —

Tus datos viven cifrados en tránsito y en reposo. Cada acceso a información clínica se valida contra la membresía del usuario en la clínica activa. Nunca compartimos tus datos con terceros para publicidad ni tracking.

¿Eres fisioterapeuta y quieres probar Kengo? Regístrate y crea tu primera clínica en menos de un minuto.
¿Eres paciente? Pide a tu fisio un código de invitación para empezar.

Soporte: hola@kengoapp.com
Web: https://kengoapp.com
```

> Si quieres una versión más corta (~1200 chars) para la primera build, dímelo y la recorto.

---

## 5. Keywords — palabras clave de búsqueda (max 100)

> **Reglas críticas de Apple**:
> 1. Separadas por coma **sin espacios** (`fisio,fisioterapia`, no `fisio, fisioterapia`).
> 2. **No repetir** palabras que ya aparezcan en `Name` o `Subtitle` — Apple ya las indexa, perderías slots.
> 3. **No incluir** marcas competidoras, "free", "best", "app", o términos genéricos.
> 4. Singular vs plural: Apple hace stemming parcial — incluir solo singular cuando sea ambiguo.
> 5. Acentos: Apple normaliza acentos en español, **omítelos** para ahorrar caracteres.
> 6. Usa los 100 chars completos — son slots gratis.

**(recomendada)** asumiendo `Name = "Kengo: Fisio en casa"` y `Subtitle = "Fisioterapia personalizada"` (palabras "fisio", "fisioterapia", "casa", "personalizada" ya están indexadas y no se repiten aquí) **(99/100)**:

```
rehabilitacion,ejercicios,lesion,dolor,recuperacion,rutinas,clinica,pacientes,terapia,kinesiologia
```

Variantes según subtitle elegido:

Si el subtitle es `Tu fisio, siempre contigo` (no incluye "fisioterapia") **(98/100)**:

```
fisioterapia,rehabilitacion,ejercicios,lesion,dolor,recuperacion,rutinas,clinica,pacientes,terapia
```

Si el subtitle es `Planes de ejercicios y fisio` (no incluye "rehabilitacion") **(98/100)**:

```
rehabilitacion,fisioterapia,lesion,dolor,recuperacion,rutinas,clinica,pacientes,terapia,salud
```

> Después del primer build podrás ver en App Store Connect qué keywords están convirtiendo (impresiones → descargas) e iterar sin nuevo binario.

---

## 6. URLs de contacto

| Campo | Valor sugerido | Obligatorio |
|---|---|---|
| **Support URL** | `https://kengoapp.com/soporte` (o `mailto:soporte@kengoapp.com` si no tenéis página dedicada) | Sí |
| **Marketing URL** | `https://kengoapp.com` | No (recomendado) |
| **Privacy Policy URL** | `https://kengoapp.com/legal/privacidad` | Sí |

> Si todavía no existen estas rutas reales, créalas mínimo como página estática antes de mandar la build a Beta App Review. Apple rechaza si la URL devuelve 404 o redirecciona a la landing genérica sin contenido específico.

---

## 7. Copyright

Aparece en la ficha. Formato Apple-friendly:

- **(recomendada)** `© 2026 Kengo`
- Variante con razón social: `© 2026 Kengo S.L.` (solo si la entidad legal se llama así oficialmente; si no, no inventes).

---

## 8. "What's New in This Version" — release notes (max 4000, por versión)

> Aparece en la pestaña "Novedades" de la ficha y en la pantalla de actualización dentro de la app. Aplica a cada versión `MARKETING_VERSION`, no a cada build TestFlight.

**Versión 1.0.0 (primer lanzamiento)** **(326/4000)**:

```
Kengo llega a iOS.

• Vista de actividad diaria con tus ejercicios del día.
• Sesiones guiadas con vídeo, contador de series y temporizador de descanso.
• Registro de dolor y notas tras cada sesión.
• Para fisioterapeutas: catálogo de ejercicios, constructor de planes y gestión de pacientes.
• Notificaciones para no perder tu rutina.

Gracias por probar Kengo.
```

Plantilla reutilizable para futuras versiones:

```
Versión X.Y.Z

Novedades:
• [nueva funcionalidad 1]
• [nueva funcionalidad 2]

Mejoras:
• [mejora UX o rendimiento]

Correcciones:
• [bug corregido]

Gracias por usar Kengo. Tu feedback en hola@kengoapp.com nos hace mejorar.
```

---

## 9. Campos específicos de TestFlight

Estos campos viven en la pestaña **TestFlight** dentro de la app, no en la ficha pública.

### 9.1 Test Information → Beta App Description (max 4000)

> Visible para testers cuando aceptan la invitación. Distinto de la `Description` pública.

**(recomendada)** **(618/4000)**:

```
Kengo es una plataforma de fisioterapia que conecta fisioterapeutas y pacientes entre consultas: planes de ejercicios personalizados con vídeo guiado, seguimiento de adherencia y registro del dolor.

Esta beta está dirigida a fisioterapeutas y pacientes que quieran probar la app antes del lanzamiento público. Tu feedback nos ayuda a pulir la experiencia antes de App Store.

Para empezar:
• Si eres fisioterapeuta: regístrate y crea tu clínica.
• Si eres paciente: usa el código de invitación que te dará tu fisio.

Cualquier problema o sugerencia: hola@kengoapp.com.
```

### 9.2 Test Information → Feedback Email

`hola@kengoapp.com` (o el alias real que vayáis a monitorizar). Apple muestra este email al tester para mandar feedback.

### 9.3 Test Information → Marketing URL & Privacy Policy URL

Mismas que en §6. Apple las exige también en TestFlight externo.

### 9.4 Test Information → Demo Account (imprescindible para Beta App Review externa)

> Si pides revisión externa de Apple y tu app requiere login, **debes** dar credenciales operativas. Sin esto, rechazo automático.

Crear dos cuentas reales en producción:

```
Modo fisioterapeuta:
  Usuario: apple-review-fisio@kengoapp.com
  Contraseña: [generar password fuerte y guardar en 1Password]

Modo paciente:
  Usuario: apple-review-paciente@kengoapp.com
  Contraseña: [generar password fuerte y guardar en 1Password]
```

Rellenar el campo **Sign-in required** = Yes y poner las credenciales del modo fisio (es el caso completo). Añadir nota en **Notes**:

```
Para revisar el modo paciente, la cuenta fisio tiene un paciente vinculado con email apple-review-paciente@kengoapp.com (mismo password). El switcher de clínica está en el menú lateral. Para acceso completo, usar el código de invitación KENGO-DEMO en pantalla de registro.
```

### 9.5 Per-build → "What to Test" (max 4000, por build)

> Cambia cada build. Apunta los flujos a probar en esta build concreta.

**Plantilla primera build**:

```
Primer build de prueba en TestFlight.

Flujos críticos a validar:
1. Registro como fisioterapeuta y creación de clínica.
2. Generación de código de invitación de paciente.
3. Registro como paciente con código.
4. Creación de un plan de ejercicios desde la cuenta fisio.
5. Visualización del plan en la cuenta paciente, modo "Mi día".
6. Realización de una sesión guiada completa (vídeo + series + descanso).
7. Registro de feedback de dolor tras la sesión.
8. Recepción de push notification (asegúrate de aceptar permisos al iniciar).
9. Compra de suscripción de clínica (Stripe en navegador externo, vuelta a la app).

Si algo no funciona como esperas, mándanos un email a hola@kengoapp.com con el flujo que probabas y, si puedes, una captura.
```

---

## 10. Screenshots y App Preview (mediados visuales)

> No es texto, pero es obligatorio adjuntar screenshots para enviar la app. Apple exige al menos un set por dispositivo de los siguientes tamaños:

| Dispositivo | Resolución requerida | Mínimo |
|---|---|---|
| iPhone 6.9" (15/16 Pro Max) | 1320×2868 o 2868×1320 | **1 screenshot** mínimo, hasta 10 |
| iPhone 6.5" (14 Plus, XS Max) | 1284×2778 o 2778×1284 | Opcional si das el 6.9" |
| iPhone 6.7" (sustituido por 6.9" desde 2024) | — | — |
| iPhone 5.5" (8 Plus) | 1242×2208 o 2208×1242 | **Solo si soportas iOS 12 en esos devices** — si bajáis `IPHONEOS_DEPLOYMENT_TARGET` |

Apple acepta presentar **solo** el set 6.9" + escalarlo automáticamente para los demás formatos (desde 2024). Recomendación: 5-7 screenshots del 6.9" mostrando los flujos clave (ver §5 del `LANDING_PAGE_CONTENT.md`):

1. Dashboard del paciente — actividad diaria con progreso.
2. Sesión guiada — vídeo + contador de series.
3. Constructor de planes (vista fisio).
4. Lista de pacientes (vista fisio).
5. Estadísticas y rachas.
6. (Opcional) Switcher de clínicas / multi-rol.
7. (Opcional) Pantalla de bienvenida con propuesta de valor.

> Genera los screenshots desde simulador con `iPhone 16 Pro Max` (es 6.9"). Captura con `Cmd+S` en el Simulator y exporta. Opcional: añadir overlays con copy ("Tu fisio, contigo cada día") usando Sketch/Figma — Apple lo permite mientras no haya contenido falso (mockup-only).

App Preview (vídeos): opcional. Si lo añades, formato 1080×1920 vertical, 15-30 segundos, sin audio externo.

---

## 11. Checklist de envío (resumen)

- [ ] Name + Subtitle elegidos y dentro de límite.
- [ ] Promotional text pegado.
- [ ] Description pegada.
- [ ] Keywords pegadas (sin espacios entre comas, sin acentos).
- [ ] Categoría primary = Health & Fitness.
- [ ] Content Rights = No (no third-party content).
- [ ] Age Rating completado → 4+.
- [ ] App Privacy completado (data types + tracking = No).
- [ ] Support URL, Marketing URL, Privacy Policy URL publicadas y respondiendo 200.
- [ ] Copyright = `© 2026 Kengo`.
- [ ] Release Notes v1.0.0 pegadas.
- [ ] Beta App Description pegada (TestFlight).
- [ ] Feedback Email = `hola@kengoapp.com`.
- [ ] Demo accounts creadas en producción.
- [ ] Mínimo 1 screenshot 6.9" subido (recomendado 5-7).
- [ ] Build subida y procesada (ver `docs/SETUP_TESTFLIGHT.md`).

---

## 12. Notas operativas

- **Cambiar el `Name` requiere nuevo build** (no es editable sin envío). Subtitle y Keywords sí son editables sin build, pero solo cuando hay una versión "Prepare for Submission" abierta.
- **Promotional Text es editable en cualquier momento** sin envío — úsalo para campañas.
- **No cambies el bundle ID nunca** una vez publicado: te obligará a registrar una app nueva en Apple, perderás la URL de App Store y el ranking.
- **Localizaciones futuras** (`es-MX`, `en-US`, `pt-BR`...): se añaden en App Store Connect → Localizations sin necesidad de nuevo build. Los keywords y el copy se pueden adaptar a cada locale.
- **Iconos**: Apple requiere icono 1024×1024 sin transparencias ni bordes redondeados ya aplicados. El asset actual `apps/app/assets/icon-1024x1024.png` debe ser opaco. Verifica antes de Archive.
