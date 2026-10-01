# Handoff — Rechazo 5.1.1(ix) y migración a cuenta Apple de organización

> **Último dato verificado: 2026-09-09.** Documento escrito el 2026-10-01 para
> retomar el asunto en una sesión nueva. Entre ambas fechas **no hay constancia
> de qué pasos se dieron**: todo lo marcado como pendiente puede estar ya hecho.
> Empieza por la sección [§14 Preguntas abiertas](#14-preguntas-abiertas).

Documentos relacionados: `RESPUESTA_APPLE_2_1B_BUSINESS_MODEL.md` (rechazo
anterior, ya contestado), `APP_STORE_CONNECT_COPY.md` (ficha),
`CUENTAS_REVISION_TIENDAS.md` (credenciales de revisión), `SETUP_TESTFLIGHT.md`
y `SETUP_PUSH_NOTIFICATIONS.md` (ambos citan el team viejo).

---

## 0. Estado confirmado el 2026-10-01

- D-U-N-S lookup de Apple **hecho**: devuelve KENGO S.C. / 374056569.
- Enrolamiento **no empezado**; no existe Apple ID de Kengo. Se creará con
  `info@kengoapp.com`.
- **Carlos no es socio** → el Account Holder es el socio con poder de
  representación (tiene iPhone; el 634909756 de D&B es suyo y atenderá la
  llamada de verificación).
- Hay certificado censal y NIF (`J22454029`). **Falta el contrato de
  constitución** (pedirlo al asesor).
- Se mantiene la vía SC; el corte de 3 semanas cuenta desde la solicitud.
- Resolution Center **sin contestar**: responder con §12-A *después* de enviar
  la solicitud de enrolamiento.
- 1.2.1 (8) subida a TestFlight interno de la cuenta vieja. Android en curso.
- Textos legales corregidos (§10): `KENGO S.C.`, NIF y domicilio según el
  certificado censal (`Calle Quevedo, 10, 2.º A derecha`). Pendiente desplegar.
- Siguiente cambio técnico: añadir el Team ID nuevo **junto al** viejo en la
  AASA en cuanto exista, desplegar, y solo después cambiar `DEVELOPMENT_TEAM`.

---

## 1. Estado en una línea

La app está **bloqueada por un problema de titularidad de cuenta, no de código**.
Hasta que KENGO S.C. no tenga su propia cuenta del Apple Developer Program
enrolada como organización, no hay reenvío posible. El binario 1.2.0 (7) no
tiene nada mal.

### Qué re-verificar nada más empezar

- [ ] ¿Se ejecutó el lookup de D-U-N-S de Apple y devolvió el **374056569**?
- [ ] ¿Se solicitó el enrolamiento como organización? ¿En qué estado está?
- [ ] ¿Se contestó al Resolution Center? (§12 tiene el texto)
- [ ] ¿Existe ya un Apple ID propiedad de Kengo?
- [ ] ¿Sigue en pie la decisión de **no** constituir una SL? (§4)
- [ ] ¿Se ha publicado algo de 1.2.1 build 8 desde la cuenta vieja? (§13)

---

## 2. El rechazo

| | |
|---|---|
| Submission ID | `455f9134-e401-4f40-9351-87a1dfdcf041` |
| Fecha de revisión | 2026-09-08 |
| Versión revisada | 1.2.0 (7) |
| Device de revisión | iPad Air 11-inch (M3) |
| Guideline | **5.1.1(ix)** — Legal · Privacy · Data Collection and Storage |

Texto de Apple:

> The account that submits the app must be enrolled in the Apple Developer
> Program as an organization, and not as an individual.

Y, crucialmente:

> Please note that you cannot resolve this issue with documentation showing
> permission to publish this app on behalf of the content owner or institution.

La 5.1.1(ix) se aplica a apps de campos altamente regulados (banca, **sanidad**,
juego, cannabis legal, aviación) o que manejan datos sensibles. Kengo trata
datos de salud de pacientes: categoría especial del art. 9 RGPD. Aplica de
pleno.

**No es discutible en el Resolution Center.** El segundo párrafo está ahí
precisamente para cerrar la vía del contrato o la autorización del titular, que
es exactamente la situación de este proyecto.

---

## 3. La situación societaria

- **Quien publica hoy**: Carlos Cabrera, autónomo, bajo el nombre *Nodus
  Development* (NIF declarado en `legal-privacidad.component.html:228` como
  encargado que contrata Railway). Team actual `LTZK7CBKWL`, cuenta **Individual**.
- **Quien presta el servicio**: **KENGO S.C.**, responsable del tratamiento
  declarado en `legal-privacidad.component.html:4` y titular de la plataforma
  según `legal-terminos.component.html:5`.
- Kengo contrata a Carlos para desarrollar y publicar.

Apple exige que el *seller* sea la entidad que presta el servicio. Además, el
revisor compara el vendedor de la App Store con el responsable declarado en la
política de privacidad: si no coinciden, rechazo nuevo casi seguro.

### El modelo correcto

KENGO S.C. es titular de la cuenta; Carlos entra como **Admin** en *Users and
Access* y sigue haciendo todo el trabajo técnico (builds, certificados,
TestFlight, ficha). Es el modelo agencia/cliente estándar y Apple lo contempla
sin problema. Solo el Account Holder firma contratos.

### Atajos que NO funcionan

- **Convertir la cuenta personal a organización como Nodus Development.** Nodus
  no presta el servicio sanitario → se vuelve a caer en la 5.1.1(ix).
- **Adjuntar el contrato o una autorización de Kengo.** Descartado por escrito
  en la carta de Apple.
- **App Transfer a una cuenta nueva.** Exige que la app ya esté **publicada** en
  la App Store; la nuestra nunca lo estuvo. No es transferible.

---

## 4. Decisión tomada: intentar con la sociedad civil

Se decidió **intentarlo con KENGO S.C. tal cual, sin constituir una SL**.

Esto es una apuesta consciente, no una certeza:

- Una SC española tiene personalidad jurídica (art. 1669 CC), NIF propio con
  letra J y, con objeto mercantil, tributa por Impuesto de Sociedades. No es un
  nombre comercial ni un DBA.
- Pero **no se inscribe en el Registro Mercantil**, así que Apple no tiene
  registro público contra el que contrastar, y los socios responden de forma
  personal e ilimitada.
- **No hay dato confirmado de que Apple acepte o rechace sistemáticamente
  sociedades civiles españolas.** Con una SL no habría debate.

**Punto de corte acordado**: si pasadas ~3 semanas desde la solicitud de
enrolamiento Apple no ha validado la entidad, cambiar a SL sin darle más
vueltas. Constituir una SLU lleva 2–4 semanas (notaría + Registro Mercantil);
desde la Ley Crea y Crece el capital mínimo puede ser 1 € (con obligación de
dotar el 20 % a reserva legal hasta 3.000 €).

> La elección de forma jurídica es decisión del asesor fiscal de Kengo. Aquí
> solo se documenta cuál desbloquea antes a Apple.

Argumento colateral que se planteó y quedó anotado: con una SC, una sanción de
la AEPD o una reclamación por brecha alcanza el patrimonio personal de los
socios, y Kengo trata datos de salud de pacientes de clínicas terceras actuando
como encargado del tratamiento. La SL puede compensar por razones ajenas a la
App Store.

---

## 5. Lo verificado el 2026-09-09

El D-U-N-S **374056569** se contrastó contra la ficha pública de KENGO S.C. en
eInforma, que es el front público de **Informa D&B**, el emisor del D-U-N-S en
España.

| Campo | Valor en el registro de D&B |
|---|---|
| Denominación | `KENGO S.C.` |
| Duns Number | `3740…` (enmascarado; prefijo compatible con 374056569) |
| NIF | `J224…` (la J confirma sociedad civil) |
| Domicilio social | `CALLE QUEVEDO, 10 - 2 A DERECHA` |
| Localidad | `38005 SANTA CRUZ DE TENERIFE` |
| Forma jurídica | `Sociedad civil` |
| Actividad Informa | Explotación electrónica por cuenta de terceros |
| CNAE 2025 | `6220 - Consultoría informática y gestión de instalaciones informáticas` |
| Balances | El Rto. Mercantil no dispone de balances para esta empresa |
| Fecha último dato | 05 de julio de 2026 |

URL de la ficha:
`https://www.einforma.com/servlet/app/prod/ETIQUETA_EMPRESA/nif/hWx0T9VKD3orGanqjFyrCQ`

**Conclusión**: el número es real y apunta a la entidad correcta, en la
dirección correcta. El D-U-N-S deja de ser un riesgo.

Dato favorable: la ficha está actualizada a **julio de 2026**, no a la semana de
la consulta. Un registro con meses de antigüedad ya ha tenido tiempo de
propagarse a la base global de D&B que consulta Apple, que es donde suelen
aparecer los problemas con altas recién hechas.

### Lo que quedó sin verificar

1. **Los 5 dígitos restantes del D-U-N-S.** eInforma los enmascara y
   desenmascararlos exige registrarse. Se confirmaron 4 de 9.
2. **Si el lookup de Apple devuelve la ficha.** Su herramienta exige iniciar
   sesión con Apple ID. Es el paso de §8.

---

## 6. El riesgo que sigue abierto

Tener D-U-N-S es condición **necesaria, no suficiente**. La 5.1.1(ix) no la
resuelve el número: la resuelve que Apple apruebe el enrolamiento como
organización.

En contra:

- El registro de D&B dice literalmente **"Forma Jurídica: Sociedad civil"**.
- **"El Rto. Mercantil no dispone de balances para esta empresa"**: el
  verificador de Apple no tiene registro público contra el que contrastar.

A favor:

- **CNAE 6220 (consultoría informática)** encaja con lo que Kengo es.
- Si preguntan por la cualificación para operar en salud, la respuesta es que el
  servicio sanitario lo prestan las clínicas colegiadas y Kengo es el proveedor
  de software y **encargado del tratamiento** — que es justo lo que ya dicen los
  términos y lo que se argumentó con éxito en la 2.1(b).

---

## 7. Plan por fases

### Fase 0 — Documentación de la entidad · *estado: desconocido*

- [ ] Contrato de constitución de la sociedad civil.
- [ ] NIF `J224…` (completo).
- [ ] **Certificado de situación censal** (sede electrónica AEAT). Es el papel
      que se enseña a D&B y a Apple: acredita denominación, NIF, domicilio
      fiscal y epígrafe IAE.
- [ ] Confirmar qué socio tiene facultad de representación → será el Account
      Holder y quien atienda la llamada de verificación.

### Fase 1 — D-U-N-S · *estado: número obtenido, pendiente de confirmar en Apple*

Ver §5 y §8. **Hecho** salvo la comprobación en la herramienta de Apple.

### Fase 2 — Enrolamiento como organización · *estado: desconocido*

- [ ] Crear un **Apple ID propiedad de Kengo** (`apple@kengoapp.com` o similar),
      con 2FA en un teléfono al que Kengo tenga acceso permanente. **No el Apple
      ID personal de Carlos**: un Apple ID no puede ser titular de dos programas,
      y si un día Carlos deja el proyecto, Kengo se queda fuera de su propia app.
- [ ] `developer.apple.com/programs/enroll` → **Company / Organization**.
- [ ] Entity name idéntico al del D-U-N-S, dirección, web, y marcar autoridad
      legal para vincular a la entidad.
- [ ] **Preparar la llamada telefónica**: Apple casi siempre llama al número
      público para confirmar que el solicitante existe y tiene poder de firma.
- [ ] Si cuestionan la forma jurídica → §12, bloque B.
- [ ] Al aprobar se cobran 99 €/año. Aceptar el Program License Agreement.

> **No hace falta el acuerdo de Paid Apps** ni datos bancarios ni formularios
> fiscales: la app es gratuita y no usa IAP (defensa 3.1.3(b) de la 2.1(b)). Es
> el enrolamiento mínimo.

### Fase 3 — Alta de Carlos como Admin · *10 minutos*

- [ ] Account Holder → App Store Connect → *Users and Access* → invitar el Apple
      ID de Carlos con rol **Admin**.

### Fase 4 — Guardar evidencia · *antes de destruir nada*

- [ ] Exportar a PDF todos los mensajes del Resolution Center (2.1(b) y
      5.1.1(ix)).
- [ ] Guardar la lista de testers de TestFlight.
- [ ] Verificar que `docs/APP_STORE_CONNECT_COPY.md` está al día.

Al borrar la app se pierde ese histórico de forma irreversible.

### Fase 5 — Liberar el bundle ID · *SOLO con la Fase 2 ya aprobada*

> ⚠️ **Esta fase va después de la 2, nunca antes.** Si se borra la app para
> liberar el bundle ID y luego la SC no pasa la verificación, se acaba sin
> cuenta nueva y sin la vieja.

- [ ] Retirar el envío en revisión si sigue abierto.
- [ ] Desactivar los grupos de TestFlight externo.
- [ ] App Store Connect → la app → App Information → **Delete App** (solo
      posible porque nunca se publicó).
- [ ] Certificates, Identifiers & Profiles → Identifiers → `com.kengoapp.app` →
      **Remove**.
- [ ] Esperar propagación (de horas a 2–3 días) y que Kengo lo registre.
- [ ] Si sale *"identifier not available"*: ticket a Developer Support
      explicando que la app nunca se publicó y que se migra a la cuenta de la
      entidad prestadora.

**Plan B** si Apple no suelta el identificador: bundle ID nuevo, con el coste de
tocar `apps/app/capacitor.config.ts`, `apps/app/ios/App/App/Info.plist`,
`apps/app/ios/App/App/GoogleService-Info.plist` y rehacer la app iOS en Firebase.
Android puede quedarse como está.

### Fase 6 — Reconfigurar el proyecto · ver §9

### Fase 7 — Ficha y reenvío

- [ ] Rellenar el NIF en el aviso legal (§10) **antes** de reenviar: lo exige el
      art. 10 LSSICE y el revisor abre los enlaces legales.
- [ ] Ficha con `docs/APP_STORE_CONNECT_COPY.md`, cuentas de
      `docs/CUENTAS_REVISION_TIENDAS.md`.
- [ ] **Adjuntar la documentación de la entidad** en el campo de attachments de
      App Review. Apple lo pide expresamente en su carta y acorta la revisión.
- [ ] En las notas de revisión, referenciar el Submission ID anterior y explicar
      que la app se envía ahora desde la cuenta de organización de la entidad
      que presta el servicio.

### Plazos estimados

| Fase | Tiempo |
|---|---|
| 0 — Documentación | 1 día |
| 1 — D-U-N-S | 5–14 días (ya hecho) |
| 2 — Enrolamiento | 1–2 semanas (corte a las 3) |
| 5 — Liberar bundle ID | 1–3 días |
| 6 — Reconfigurar + TestFlight | 2–3 días |
| 7 — App Review | 1–3 días |

**3–6 semanas** si la SC pasa. Si la tumban, súmale 2–4 semanas de SL.

---

## 8. Formulario de D-U-N-S lookup de Apple

`developer.apple.com/enroll/duns-lookup` (exige iniciar sesión). Valores exactos,
tomados del registro de D&B de §5, que es contra lo que casa Apple:

| Campo | Valor |
|---|---|
| **Region** | `Spain` |
| **Legal Entity Name** | `KENGO S.C.` |
| **Street Address** | `CALLE QUEVEDO, 10 - 2 A DERECHA` |
| **Town / City** | `SANTA CRUZ DE TENERIFE` |
| **State / Province** | `Sta. Cruz Tenerife` ← la opción se llama así, abreviada |
| **Postal Code** | `38005` |
| **Phone Number** | Intl. Code `Spain (+34)` · número `634909756` (sin prefijo ni espacios) |
| **Given / Family Name** | Los del contacto |
| **Work Email** | `info@kengoapp.com` u otro del dominio propio |

Avisos:

- **Work Email**: el campo exige *"an email address that uses your
  organization's domain name"*. **Nunca un Gmail** — es causa habitual de
  rechazo silencioso.
- **Given/Family Name**: en esta pantalla es solo el contacto de la consulta.
  Solo importa si se acaba *solicitando* un D-U-N-S nuevo, que no es el caso.
- Al final hay un **CAPTCHA**: lo tiene que resolver una persona.

### Qué hacer con el resultado

**Si aparece KENGO S.C.**: confirmar que el D-U-N-S es `374056569` y **apuntar
el nombre y la dirección exactamente como los muestra Apple**. Esa cadena
literal es la que hay que escribir en el formulario de enrolamiento; una
variante hace fallar la verificación por *"cannot verify"*.

**Si no aparece nada**:

1. Aflojar la búsqueda: solo `KENGO` como Legal Entity Name, o la dirección
   simplificada a `CALLE QUEVEDO 10`. El matcher de Apple es quisquilloso con el
   formato.
2. Si sigue sin salir, llamar a **Informa D&B, 900 10 30 20**, y pedir que
   revisen/publiquen el registro del D-U-N-S 374056569 hacia la base global de
   D&B. Es gratis.

---

## 9. Cambios técnicos al cambiar de team

El Team ID `LTZK7CBKWL` es personal de Carlos y desaparece del proyecto.

| Qué | Dónde |
|---|---|
| `DEVELOPMENT_TEAM` | `apps/app/ios/App/App.xcodeproj/project.pbxproj:307,333` |
| Prefijo de `appIDs` en la AASA | `apps/app/public/.well-known/apple-app-site-association:5,42` |
| Clave APNs `.p8` nueva | Generar en el team de Kengo → subir a Firebase Console (Key ID **y** Team ID nuevos), borrar la vieja |
| Certificado de distribución y perfiles | Regenerar en el team nuevo (o *Automatically manage signing*) |
| Referencias al team viejo | `docs/SETUP_TESTFLIGHT.md`, `docs/SETUP_PUSH_NOTIFICATIONS.md` |

Dos cosas que rompen cosas si se olvidan:

- **AASA**: si no se actualiza el prefijo, se rompen los universal links, y con
  ellos el magic link y el retorno de billing. **Desplegar la web ANTES de
  instalar el build**, porque iOS cachea la AASA. Verificar con `curl -i`
  mirando el **body**: `express.static` ignora los directorios que empiezan por
  punto, así que un fallo cae en el fallback SPA y devuelve `index.html` con
  **200**, aparentando funcionar.
- **APNs**: sin la clave nueva, el push muere en iOS.

Además, el registro de app nuevo implica **TestFlight externo desde cero**, con
su revisión previa (1–2 días) y los testers reinvitados.

---

## 10. Discrepancias en los textos legales

Apple compara carácter por carácter contra el registro de D&B, y el revisor abre
los enlaces legales de la ficha.

| | D&B / Apple | Textos legales actuales |
|---|---|---|
| Nombre | `KENGO S.C.` (con puntos) | `KENGO SC` |
| Dirección | `CALLE QUEVEDO, 10 - 2 A DERECHA` | `Calle Quevedo 10 P02 A DCHA` |
| NIF | `J224…` | `pendiente de cumplimentar` |

A corregir en `libs/shared/legal/src`:

- `lib/aviso-legal/legal-aviso-legal.component.html` — `KENGO SC` en las líneas
  9, 28, 56, 80, 86, 99, 110, 134 y 157; el NIF pendiente en la línea 10.
- `lib/terminos/legal-terminos.component.html` — líneas 5 y 232.
- `lib/privacidad/legal-privacidad.component.html` — bloque del responsable.

> En el formulario de Apple hay que usar **la forma de D&B**, no la de los
> textos legales.

**No hay que subir la `version` en `legal-docs.metadata.ts`** (hoy las cuatro en
`2026-07-29`): unificar el nombre y rellenar el NIF es corrección de formato, no
cambio de la identidad del responsable, así que no genera una nueva solicitud de
consentimiento. Si en cambio se acaba constituyendo una SL, el responsable sí
cambia y **entonces sí** hay que subir la versión de los cuatro documentos.

---

## 11. Trampas a evitar

1. **No pedir un D-U-N-S nuevo** si el lookup de Apple no encuentra la ficha. Ya
   hay número; un duplicado en D&B es causa clásica de enrolamientos atascados
   durante semanas. El formulario lo ofrece de forma tentadora al no encontrar
   nada.
2. **No borrar la app de la cuenta vieja** hasta que Apple haya aprobado el
   enrolamiento de Kengo (§7, Fase 5).
3. **No convertir la cuenta personal a organización como Nodus Development.**
4. **No enrolar con el Apple ID personal de Carlos.**
5. **No preparar contratos ni autorizaciones** para el Resolution Center: Apple
   los descarta por escrito.
6. **Guardar en PDF el histórico del Resolution Center** antes de borrar la app.
7. **No cambiar el `DEVELOPMENT_TEAM` sin desplegar antes la AASA nueva.**

---

## 12. Bloques en inglés listos para pegar

### A — Respuesta en el Resolution Center

```
Thank you for the clarification.

We understand that under Guideline 5.1.1(ix) the app must be submitted by the
legal entity that provides the service. The app will be resubmitted from the
Apple Developer Program account of KENGO S.C., the Spanish legal entity that
operates the Kengo platform and is the data controller identified in the app's
privacy policy. That organization enrollment is already in progress.

No further action is expected on this submission.
```

### B — Si la verificación de Apple cuestiona la forma jurídica

```
KENGO S.C. is a "sociedad civil", a legal entity recognised under Articles
1665-1669 of the Spanish Civil Code. It holds its own tax identification number
(NIF J-...) issued by the Spanish Tax Agency, its own registered address, and
its own corporate income tax obligations (Impuesto sobre Sociedades). It is not
a trade name, a DBA, or a branch of another company.

Attached: the entity's tax registration certificate (certificado de situación
censal) issued by the Spanish Tax Agency, and its incorporation deed.
```

Tono: factual, sin discutir. Adjuntar el certificado censal y el contrato de
constitución en PDF.

---

## 13. Interacción con la release 1.2.1

El commit `96a8361d` ("chore(release): preparar la versión 1.2.1 (build 8) para
App Store y Play") dejó preparado:

- iOS: `CURRENT_PROJECT_VERSION = 8`, `MARKETING_VERSION = 1.2.1`
- Android: `versionCode 8`, `versionName "1.2.1"`

**Decisión abierta para la sesión nueva**: si el archive de iOS se hace en el
team viejo (`LTZK7CBKWL`) o se espera a tener la cuenta de Kengo.

- Archivar ahora en la cuenta vieja solo sirve para TestFlight interno; a App
  Review no puede ir, y todo ese trabajo se repite en el team nuevo.
- Hacerlo tras la migración ahorra una vuelta, pero deja iOS parado semanas.
- **Android no está afectado**: Play no tiene requisito equivalente de cuenta de
  organización. El AAB puede seguir su curso con independencia de todo esto.

---

## 14. Preguntas abiertas

Para resolver al empezar la sesión nueva, en este orden:

1. ¿Se ejecutó el lookup de D-U-N-S de Apple? ¿Devolvió el 374056569 y con qué
   nombre y dirección exactos?
2. ¿Se solicitó el enrolamiento como organización? ¿Fecha? ¿Hubo llamada de
   verificación? ¿Pidieron documentación?
3. ¿Se contestó al Resolution Center con el bloque de §12-A?
4. ¿Existe ya un Apple ID de Kengo con 2FA?
5. ¿El asesor confirmó que la SC tiene certificado censal y representante con
   poder de firma?
6. ¿Sigue en pie la decisión de no constituir SL, o ya se arrancó esa vía?
7. ¿Se ha hecho algo con el build 8 (§13)?
8. ¿Se ha tocado la cuenta de Stripe para que facture como KENGO S.C.? (quedó
   anotado como tercer desajuste a cerrar, junto con el IGIC)
