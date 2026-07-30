# Ficha y cumplimiento de Google Play — Kengo Android

Documento equivalente a `docs/APP_STORE_CONNECT_COPY.md` pero para Play Console. Los límites de caracteres **no** coinciden con los de Apple, así que el copy no se puede reutilizar tal cual.

> Estado: pendiente de crear la ficha en Play Console. El paquete es `com.kengoapp.app` (`apps/app/android/app/build.gradle`).

---

## 1. Ficha de la tienda (Main store listing)

### 1.1 App name (máx. 30)

`Kengo: Fisio en casa` — **(20/30)**

### 1.2 Short description (máx. 80)

> Aparece bajo el nombre en los resultados de búsqueda. Es el campo con más peso en la conversión.

**(recomendada)** **(76/80)**

```
Tu plan de fisioterapia con vídeo, recordatorios y seguimiento de tu progreso.
```

Alternativa orientada a profesionales **(79/80)**:

```
Crea planes de ejercicios, sigue la adherencia real y habla con tus pacientes.
```

### 1.3 Full description (máx. 4000)

Se puede reutilizar la `Description` de `docs/APP_STORE_CONNECT_COPY.md` §4 (2434 caracteres, cabe de sobra). Play admite saltos de línea y viñetas, pero **no** HTML más allá de unas pocas etiquetas.

Añadir al final, porque Play es más estricto que Apple con las afirmaciones de salud:

```
Kengo es una herramienta de apoyo al tratamiento de fisioterapia. No realiza
diagnósticos médicos ni sustituye el criterio de un profesional sanitario.
Ante dolor agudo o empeoramiento, interrumpe los ejercicios y consulta con tu
fisioterapeuta.
```

### 1.4 Categoría

- **App category**: `Health & Fitness` (Salud y bienestar).
- **Tags**: fisioterapia, ejercicio, salud, rehabilitación.

### 1.5 URLs obligatorias

| Campo | Valor |
|---|---|
| Privacy Policy | `https://www.kengoapp.com/legal/privacidad` |
| Website | `https://www.kengoapp.com` |
| Support email | `info@kengoapp.com` |
| Support phone (opcional) | `+34 634 90 97 56` |

---

## 2. Data safety (obligatorio)

Play Console → **Policy → App content → Data safety**. Este formulario debe coincidir con lo que dice la política de privacidad; una discrepancia es motivo de suspensión.

### 2.1 Preguntas transversales

| Pregunta | Respuesta |
|---|---|
| ¿Los datos se cifran en tránsito? | **Sí** (TLS) |
| ¿El usuario puede solicitar la eliminación de sus datos? | **Sí** |
| URL de solicitud de borrado | `https://www.kengoapp.com/eliminar-cuenta` |
| ¿La app cumple la Families Policy? | No aplica (no dirigida a menores de 13) |
| ¿Se comparten datos con terceros? | Solo con encargados del tratamiento (no cuenta como "sharing" según la definición de Play, salvo Stripe para el pago) |

### 2.2 Tipos de datos recogidos

Derivado de `convex/schema.ts`. Ninguno se usa para publicidad ni para seguimiento entre apps.

| Categoría | Tipo | Recogido | Compartido | Obligatorio | Finalidad |
|---|---|---|---|---|---|
| Personal info | Name | Sí | No | Sí | Funcionalidad, gestión de cuenta |
| Personal info | Email address | Sí | No | Sí | Funcionalidad, gestión de cuenta |
| Personal info | Phone number | Sí | No | No | Funcionalidad (`users.telefono`) |
| Personal info | Address | Sí | No | No | Funcionalidad (`users.direccion`, `postal`) |
| Personal info | Other info | Sí | No | No | `dni`, `fechaNacimiento`, `sexo`, `numeroColegiado` |
| Financial info | Purchase history | Sí | Sí (Stripe) | No | Suscripción de la clínica |
| **Health and fitness** | **Health info** | **Sí** | No | Sí | Funcionalidad: dolor, adherencia, ejecuciones |
| Health and fitness | Fitness info | Sí | No | Sí | Sesiones y ejercicios completados |
| Photos and videos | Photos | Sí | No | No | Avatar (`users.avatar`, alojado en R2) |
| Messages | Other in-app messages | Sí | No | No | Chat 1:1 fisio↔paciente |
| App activity | App interactions | Sí | No | No | Funcionamiento de la app |
| Device or other IDs | Device or other IDs | Sí | No | Sí | `pushTokens.deviceId` y token FCM |

---

## 3. Declaración de Health apps

Obligatoria para la categoría Health & Fitness. Puntos clave:

- **¿La app realiza diagnóstico o tratamiento médico?** → **No.** Kengo es una herramienta de apoyo; el criterio clínico es del fisioterapeuta. Responder que sí arrastraría los requisitos de producto sanitario del Reglamento (UE) 2017/745, que no se cumplen ni se pretenden.
- **¿Recoge datos de salud?** → Sí (ver §2.2).
- **¿Hay contenido generado por usuarios visible para terceros?** → No; la comunicación es 1:1 entre paciente y su fisioterapeuta.
- Aportar la política de privacidad y, si lo piden, evidencia de que los profesionales están colegiados (lo garantizan las clínicas en los términos, §5).

---

## 4. Requisitos técnicos pendientes

- [ ] **Keystore de release** y bloque `signingConfigs` en `apps/app/android/app/build.gradle` (hoy no existe: no se puede firmar un AAB).
- [ ] Activar **Play App Signing** y obtener el SHA-256 de la clave de firma.
- [ ] Rellenar `apps/app/public/.well-known/assetlinks.json` con **las dos** huellas (la de subida y la que genera Google al re-firmar). Hoy contiene marcadores `PENDIENTE_*`.
- [ ] Verificar los App Links tras el despliegue:
      ```bash
      adb shell pm verify-app-links --re-verify com.kengoapp.app
      adb shell pm get-app-links com.kengoapp.app   # debe decir: verified
      ```
- [ ] Subir el AAB al canal de pruebas internas antes de producción.

---

## 5. Cuenta de prueba para la revisión

**Ya creadas y verificadas en producción (2026-07-30)**: `review-fisio@kengoapp.com` y `review-paciente@kengoapp.com`, ambas con login por email + contraseña.

Todo lo necesario para rellenar *Política → Contenido de la app → Acceso a la app* — credenciales, texto listo para pegar, inventario de los datos sembrados y las precauciones de mantenimiento — está en **`docs/CUENTAS_REVISION_TIENDAS.md`**, que es el documento único para Play y para App Store.

> Dato relevante para este formulario: Play avisa de que sus revisores no pueden recibir códigos de un solo uso. No aplica aquí — Better-Auth está configurado sin verificación de email, así que estas cuentas entran solo con usuario y contraseña.

---

## 6. Coherencia con la política de privacidad

Antes de enviar, comprobar que estos tres documentos dicen lo mismo:

1. `libs/shared/legal/src/lib/privacidad/legal-privacidad.component.html` (el texto publicado).
2. El formulario de Data Safety de §2.
3. La tabla de App Privacy de Apple (`APP_STORE_CONNECT_COPY.md` §2.1).

Cualquier proveedor nuevo (analítica, chat, crash reporting) obliga a actualizar los tres a la vez.
