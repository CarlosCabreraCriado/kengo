/**
 * Genera `docs/Guia-Gestores-Kengo.docx`: manual de operaciones de facturación
 * para el equipo de gestión (perfil no técnico).
 *
 *   node scripts/generar-guia-gestores.js
 *   npm run guia:gestores
 *
 * El contenido vive aquí, en git, para que se revise en diffs y se regenere
 * cuando cambie el producto. Cada afirmación sobre "esto se refleja en la app"
 * está verificada contra el código; si tocas el flujo de billing, revisa este
 * documento antes de dar el cambio por cerrado.
 */

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ImageRun,
  Header,
  Footer,
  PageNumber,
  ShadingType,
  convertInchesToTwip,
  PageBreak,
  BorderStyle,
} = require("docx");
const fs = require("fs");
const path = require("path");

// Paleta de marca (misma que los informes de `scripts/generar-informe*.js`).
const KENGO_PRIMARY = "E75C3E";
const KENGO_DARK = "333333";
const GRIS_SUAVE = "F5F5F5";

const VERSION = "1.0";
const FECHA = new Date().toLocaleDateString("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Logo de cabecera. Los tres `generar-informe*.js` anteriores quedaron rotos
 * porque apuntaban a `src/assets/Logo-K.png`, una ruta que desapareció al
 * pasar a monorepo. Aquí degradamos a solo texto en vez de reventar.
 */
function cargarLogo() {
  const rutas = [
    path.join(__dirname, "../apps/app/assets/icon-512x512.png"),
    path.join(__dirname, "../apps/landingpage/public/apple-touch-icon.png"),
  ];
  for (const ruta of rutas) {
    try {
      return fs.readFileSync(ruta);
    } catch {
      /* siguiente candidato */
    }
  }
  console.warn(
    "⚠️  No se encontró ningún logo; la cabecera saldrá solo con texto.",
  );
  return null;
}

const logoBuffer = cargarLogo();

// ─────────────────────────────────────────────────────────────
// Helpers de composición
// ─────────────────────────────────────────────────────────────

function createTableHeader(texts) {
  return new TableRow({
    tableHeader: true,
    children: texts.map(
      (text) =>
        new TableCell({
          shading: { fill: KENGO_PRIMARY, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text, bold: true, color: "FFFFFF", size: 20 }),
              ],
              alignment: AlignmentType.LEFT,
            }),
          ],
        }),
    ),
  });
}

function createTableRow(texts, isAlternate = false) {
  return new TableRow({
    children: texts.map(
      (text) =>
        new TableCell({
          shading: isAlternate
            ? { fill: GRIS_SUAVE, type: ShadingType.CLEAR }
            : undefined,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [new TextRun({ text, size: 19 })],
              alignment: AlignmentType.LEFT,
            }),
          ],
        }),
    ),
  });
}

function createTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      createTableHeader(headers),
      ...rows.map((row, i) => createTableRow(row, i % 2 === 1)),
    ],
  });
}

function createSectionTitle(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    style: "Heading1",
  });
}

function createSubsectionTitle(text) {
  return new Paragraph({
    children: [
      new TextRun({ text, bold: true, color: KENGO_PRIMARY, size: 26 }),
    ],
    spacing: { before: 300, after: 150 },
  });
}

function createParagraph(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: 120 },
  });
}

function createBulletList(items) {
  return items.map(
    (item) =>
      new Paragraph({
        children: [new TextRun({ text: item, size: 22 })],
        bullet: { level: 0 },
        spacing: { after: 80 },
      }),
  );
}

function createNumberedList(items) {
  return items.map(
    (item, index) =>
      new Paragraph({
        children: [new TextRun({ text: `${index + 1}. ${item}`, size: 22 })],
        spacing: { after: 100 },
        indent: { left: 360 },
      }),
  );
}

/**
 * Caja de aviso con tres niveles. El documento distingue "ten esto en cuenta"
 * (azul) de "cuidado con el efecto colateral" (ámbar) y de "no lo hagas nunca"
 * (rojo), porque mezclarlos haría que se ignorasen los tres por igual.
 */
function crearCaja({ icono, titulo, parrafos, fondo, colorTexto, borde }) {
  const bordes = {
    top: { style: BorderStyle.SINGLE, size: 6, color: borde },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: borde },
    left: { style: BorderStyle.SINGLE, size: 18, color: borde },
    right: { style: BorderStyle.SINGLE, size: 6, color: borde },
  };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        // Una caja partida por un salto de página pierde el efecto de aviso
        // y deja media frase colgando. Que se mueva entera.
        cantSplit: true,
        children: [
          new TableCell({
            shading: { fill: fondo, type: ShadingType.CLEAR },
            borders: bordes,
            margins: { top: 140, bottom: 140, left: 200, right: 200 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${icono}  ${titulo}`,
                    bold: true,
                    size: 22,
                    color: colorTexto,
                  }),
                ],
                spacing: { after: 80 },
              }),
              ...parrafos.map(
                (t) =>
                  new Paragraph({
                    children: [
                      new TextRun({ text: t, size: 21, color: colorTexto }),
                    ],
                    spacing: { after: 60 },
                  }),
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

const espacio = (after = 200) =>
  new Paragraph({ children: [], spacing: { after } });

function infoBox(titulo, ...parrafos) {
  return [
    crearCaja({
      icono: "ℹ️",
      titulo,
      parrafos,
      fondo: "E7F1FB",
      colorTexto: "0B4F79",
      borde: "2B6CB0",
    }),
    espacio(),
  ];
}

function alertBox(titulo, ...parrafos) {
  return [
    crearCaja({
      icono: "⚠️",
      titulo,
      parrafos,
      fondo: "FFF3CD",
      colorTexto: "7A5300",
      borde: "D9A400",
    }),
    espacio(),
  ];
}

function dangerBox(titulo, ...parrafos) {
  return [
    crearCaja({
      icono: "⛔",
      titulo,
      parrafos,
      fondo: "F8D7DA",
      colorTexto: "842029",
      borde: "C0392B",
    }),
    espacio(),
  ];
}

function saltoDePagina() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ─────────────────────────────────────────────────────────────
// Portada
// ─────────────────────────────────────────────────────────────

const portada = [
  espacio(1200),
  ...(logoBuffer
    ? [
        new Paragraph({
          children: [
            new ImageRun({
              data: logoBuffer,
              transformation: { width: 90, height: 90 },
              type: "png",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
      ]
    : []),
  new Paragraph({
    children: [
      new TextRun({
        text: "Guía de gestión de suscripciones",
        bold: true,
        size: 56,
        color: KENGO_PRIMARY,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  }),
  new Paragraph({
    children: [
      new TextRun({
        text: "Operaciones de facturación en Stripe para el equipo de gestión de Kengo",
        size: 26,
        color: KENGO_DARK,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 800 },
  }),
  new Paragraph({
    children: [
      new TextRun({
        text: "No requiere conocimientos técnicos.",
        size: 24,
        italics: true,
        color: "666666",
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
  }),
  new Paragraph({
    children: [
      new TextRun({
        text: "Todo lo que aparece aquí se hace desde el panel de Stripe,",
        size: 24,
        italics: true,
        color: "666666",
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
  }),
  new Paragraph({
    children: [
      new TextRun({
        text: "salvo lo recogido en el Anexo A.",
        size: 24,
        italics: true,
        color: "666666",
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 1200 },
  }),
  new Paragraph({
    children: [
      new TextRun({
        text: `Versión ${VERSION}  ·  ${FECHA}`,
        size: 22,
        color: "999999",
      }),
    ],
    alignment: AlignmentType.CENTER,
  }),
  saltoDePagina(),
];

// ─────────────────────────────────────────────────────────────
// Índice
// ─────────────────────────────────────────────────────────────

const indice = [
  createSectionTitle("Índice"),
  ...createBulletList([
    "0. Antes de empezar",
    "1. Planes y plazas",
    "2. Descuentos y promociones",
    "3. Periodos de prueba (trials)",
    "4. Cobros e incidencias",
    "5. Tabla de referencia rápida",
    "6. Los estados de una suscripción",
    "Anexo A — Operaciones que requieren ayuda de desarrollo",
    "Anexo B — Glosario",
  ]),
  espacio(300),
  ...infoBox(
    "Cómo usar esta guía",
    "Las secciones 1 a 4 son procedimientos paso a paso: busca la operación que necesitas y sigue los pasos.",
    "La sección 5 es una tabla de una página para tener a mano: dice, de un vistazo, si una operación se refleja en la aplicación, si envía un email automático al cliente y si es segura.",
    "Cuando algo no encaje con lo que ves en pantalla, para y consulta. Es más barato preguntar que deshacer.",
  ),
  saltoDePagina(),
];

// ─────────────────────────────────────────────────────────────
// 0. Antes de empezar
// ─────────────────────────────────────────────────────────────

const seccion0 = [
  createSectionTitle("0. Antes de empezar"),

  createParagraph(
    "Kengo cobra a través de Stripe. Cuando cambias algo en Stripe, la aplicación se entera sola y ajusta lo que la clínica puede hacer: cuántos fisioterapeutas puede dar de alta, si puede trabajar o si está bloqueada por impago.",
  ),
  createParagraph(
    "Ese enlace automático es la clave de todo. Funciona muy bien para las operaciones habituales, pero hay cosas que Stripe permite y que Kengo no entiende. Esta guía te dice exactamente cuáles son.",
  ),

  createSubsectionTitle("Las cinco cosas que no se hacen nunca"),
  createParagraph(
    "Empezamos por aquí para que no se pase por alto. Cada una está explicada en su sección.",
  ),
  ...dangerBox(
    "Prohibido, sin excepciones",
    "1. Pausar el cobro de una suscripción (Pause collection) — ver 4.7.",
    "2. Reactivar una clínica cancelada creando una suscripción nueva — ver 4.6.",
    "3. Ponerle un precio que no sea uno de los dos oficiales, salvo que quieras convertirla en contrato a medida a propósito — ver 1.5.",
    "4. Cambiar la cantidad de una clínica que está en un plan normal — ver 1.4.",
    "5. Operar sobre una suscripción que no tenga orgId.",
  ),

  createSubsectionTitle("Modo de pruebas y modo real"),
  createParagraph(
    "Arriba a la derecha del panel de Stripe hay un interruptor entre modo de pruebas (Test) y modo real (Live). Son dos mundos separados: los clientes, los precios y los cobros de uno no existen en el otro.",
  ),
  ...alertBox(
    "Comprueba el modo antes de tocar nada",
    "Si trabajas en modo de pruebas creyendo que es el real, el cliente no verá ningún cambio y perderás el rato. Al revés es peor: pruebas hechas sobre clientes reales generan cobros reales.",
  ),

  createSubsectionTitle("El identificador de clínica (orgId)"),
  createParagraph(
    "Cada suscripción de Stripe lleva una etiqueta interna llamada orgId con el identificador de la clínica en Kengo. Es el hilo que une las dos plataformas.",
  ),
  createParagraph(
    "Para verlo: abre el cliente en Stripe, entra en su suscripción y busca el apartado Metadata. Debe haber una fila orgId con un código largo de letras y números.",
  ),
  ...dangerBox(
    "Sin orgId, nada de lo que hagas llega a Kengo",
    "Si una suscripción no tiene orgId, Stripe cobrará con normalidad pero la aplicación no se enterará de absolutamente nada: ni de altas, ni de bajas, ni de impagos.",
    "Es el error más fácil de cometer y el más difícil de detectar, porque en Stripe todo parece correcto. Cada vez que crees una suscripción a mano, lo primero que tienes que hacer es ponerle el orgId.",
  ),

  createSubsectionTitle("Cómo localizar la clínica"),
  createParagraph(
    "Cuando una clínica solicita algo desde la aplicación, recibes un correo con el asunto «[Kengo] +9 fisios — nombre de la clínica». Ese correo trae ya el identificador de la clínica (Clinic ID), su nombre, cuántos fisioterapeutas tiene ahora mismo y quién lo pide.",
  ),
  createParagraph(
    "En Stripe, ve a Customers y busca por el nombre de la clínica o por el correo de la persona solicitante. Antes de tocar nada, comprueba que el orgId de su suscripción coincide con el Clinic ID del correo.",
  ),

  saltoDePagina(),
];

// ─────────────────────────────────────────────────────────────
// 1. Planes y plazas
// ─────────────────────────────────────────────────────────────

const seccion1 = [
  createSectionTitle("1. Planes y plazas"),

  createParagraph(
    "Kengo tiene tres planes de contratación automática, según cuántos fisioterapeutas trabajen en la clínica. El precio lo decide ese número; la propia aplicación mueve a la clínica de un plan a otro sin que nadie intervenga.",
  ),
  espacio(100),
  createTable(
    ["Plan", "Fisioterapeutas", "Precio base", "Con pacientes ilimitados", "Tope de pacientes en el plan base"],
    [
      ["Lonely", "1", "89 €/mes", "109 €/mes", "150"],
      ["Smart", "2 a 4", "249 €/mes", "279 €/mes", "300"],
      ["Medium", "5 a 9", "449 €/mes", "489 €/mes", "500"],
      ["A medida", "10 o más", "Lo que pactes", "Sin tope", "Sin tope"],
    ],
  ),
  espacio(300),
  createParagraph(
    "A partir del décimo fisioterapeuta la aplicación bloquea las altas y ofrece al cliente un botón para contactar con ventas. Ahí es donde entras tú.",
  ),

  createSubsectionTitle("1.1 Habilitar una clínica de más de 9 fisioterapeutas"),
  ...infoBox(
    "La idea, en una frase",
    "En Stripe, la cantidad (quantity) de la suscripción son las plazas de fisioterapeuta contratadas. Kengo lee ese número y lo usa como tope de la clínica.",
  ),

  createParagraph("Paso 1. Localiza el cliente."),
  ...createBulletList([
    "Customers → busca por el nombre de la clínica o el correo de quien lo solicita.",
    "Abre su suscripción y comprueba que el orgId coincide con el Clinic ID del correo.",
  ]),
  espacio(100),

  createParagraph("Paso 2. Crea el precio negociado."),
  ...createBulletList([
    "Products → «Kengo Suscripción Clínica» → apartado Pricing → «+ Add another price».",
    "Recurrente, mensual (Monthly), en euros (EUR).",
  ]),
  createParagraph("Elige la modalidad según lo que hayáis pactado:"),
  espacio(100),
  createTable(
    ["Si habéis pactado…", "Elige en Stripe", "Importe que pones"],
    [
      [
        "Un precio por plaza (por ejemplo 55 € por fisioterapeuta)",
        "Standard pricing",
        "El precio de UNA plaza: 55 €. Stripe multiplica por las plazas, así que 15 × 55 € = 825 €/mes.",
      ],
      [
        "Un importe fijo al mes (por ejemplo 780 €, cambien o no las plazas)",
        "Tiered pricing, modo Volume, con una sola fila de 1 a ∞",
        "Per unit a 0,00 y Flat fee a 780,00.",
      ],
    ],
  ),
  espacio(200),
  ...alertBox(
    "No pongas el importe total en Standard pricing",
    "Si el acuerdo es de 780 € al mes y eliges Standard pricing con 780 €, Stripe lo multiplicará por las plazas: 15 × 780 € = 11.700 € al mes. Para un importe fijo, usa siempre Tiered pricing con una sola fila.",
  ),
  createParagraph(
    "Si ya tienes un precio creado para ese mismo acuerdo, reutilízalo y sáltate este paso.",
  ),
  espacio(100),

  createParagraph("Paso 3. Aplica el precio a la suscripción."),
  createParagraph("Caso A — la clínica ya tiene suscripción (lo habitual):"),
  ...createNumberedList([
    "Abre el cliente y su suscripción, y pulsa «Update subscription».",
    "Cambia el precio al que acabas de crear.",
    "Pon la cantidad igual a las plazas pactadas: si el acuerdo es de 15 fisioterapeutas, pon 15.",
    "Elige la opción de prorrateo que corresponda a lo acordado y guarda.",
  ]),
  espacio(100),
  createParagraph(
    "Caso B — la clínica no tiene suscripción. Ocurre con clínicas antiguas que ya superaban el plan cuando se implantó el cobro:",
  ),
  ...createNumberedList([
    "En el cliente, pulsa «Create subscription» y configura el precio y la cantidad igual que en el caso A.",
    "Antes de guardar, abre Metadata y añade una fila: clave orgId, valor el Clinic ID del correo.",
    "Guarda.",
  ]),
  ...dangerBox(
    "El orgId es obligatorio en el caso B",
    "Si creas la suscripción sin orgId, se le cobrará al cliente y la clínica seguirá bloqueada. En Stripe todo parecerá correcto.",
  ),

  createParagraph("Paso 4. Comprueba el resultado."),
  createParagraph(
    "En la aplicación, dentro de «Mi clínica → Suscripción», el cliente debe ver su plan como «A medida» y una barra que dice «Fisios usados 9 / 15». Tarda segundos.",
  ),
  espacio(100),
  createParagraph("Al guardar, y sin que tengas que hacer nada más:"),
  ...createBulletList([
    "La clínica puede invitar fisioterapeutas hasta el número de plazas.",
    "Deja de tener tope de pacientes: los límites de 150, 300 y 500 son solo de los planes automáticos.",
    "Desaparecen de su pantalla el botón de contratar, la opción de pacientes ilimitados y la comparativa de planes. Su plan lo gestionas tú.",
    "En sus facturas aparece la etiqueta «Plan a medida».",
    "Kengo deja de tocar la cantidad de esa suscripción: mientras el contrato esté vigente, el número que pongas manda.",
  ]),

  createSubsectionTitle("1.2 Ampliar o reducir las plazas de un contrato"),
  createParagraph(
    "Abre la suscripción, «Update subscription» y cambia la cantidad. Nada más. La aplicación lo recoge en segundos.",
  ),
  ...infoBox(
    "La cantidad es el techo, no el uso",
    "Si el acuerdo es de 15 plazas y la clínica tiene 12 fisioterapeutas, pon 15: son las plazas que compró. No lo ajustes al número de fisioterapeutas que veas.",
    "Bajar la cantidad no expulsa a nadie. Si reduces de 15 a 10 con 12 fisioterapeutas dados de alta, los 12 siguen trabajando; simplemente no podrán dar de alta a nadie más hasta bajar de 10.",
    "Puedes pactar menos de 9 plazas. Un contrato a medida de 5 manda sobre el tope general y la clínica quedará limitada a 5.",
  ),

  createSubsectionTitle("1.3 Cambiar entre plan base y pacientes ilimitados"),
  createParagraph(
    "Normalmente lo hace el cliente desde la aplicación. Si tienes que hacerlo tú, cambia el precio de la suscripción al otro precio oficial: el base o el ilimitado. La aplicación lo detecta y ajusta el tope de pacientes.",
  ),
  ...alertBox(
    "Bajar de ilimitado a base se salta una comprobación",
    "Cuando el cambio lo hace el cliente, la aplicación le impide volver al plan base si tiene más pacientes de los que ese plan admite. Haciéndolo tú desde Stripe esa comprobación no se ejecuta.",
    "No se borra ningún paciente, pero la clínica quedará por encima de su tope y no podrá vincular pacientes nuevos hasta bajar. Comprueba antes cuántos pacientes tiene.",
  ),

  createSubsectionTitle("1.4 Devolver una clínica al autoservicio"),
  createParagraph(
    "Cambia la suscripción de vuelta a uno de los dos precios oficiales (base o ilimitado). El tope vuelve solo a 9 fisioterapeutas y la clínica recupera la gestión de su plan desde la aplicación.",
  ),
  ...alertBox(
    "No cambies la cantidad de una clínica en plan normal",
    "En los planes automáticos, la cantidad la lleva la propia aplicación a partir de los fisioterapeutas reales. Si la cambias a mano, no pasa nada visible y, en cuanto alguien entre o salga de la clínica, se deshará sola.",
    "Si tu intención era cambiarle el precio, usa un cupón (sección 2) o un contrato a medida (sección 1.1).",
  ),

  createSubsectionTitle("1.5 Sobre usar precios que no son los oficiales"),
  ...dangerBox(
    "Un precio no oficial convierte la clínica en contrato a medida",
    "Kengo reconoce exactamente dos precios: el base y el ilimitado. Cualquier otro lo interpreta como un acuerdo negociado.",
    "Si creas un precio nuevo para una promoción y se lo pones a una clínica normal, esa clínica pasará a ser tratada como enterprise: su cantidad se convertirá en el tope de fisioterapeutas, perderá el tope de pacientes y no podrá gestionar su plan desde la aplicación.",
    "Para hacer descuentos sin este efecto, usa cupones (sección 2).",
  ),
  saltoDePagina(),
];

// ─────────────────────────────────────────────────────────────
// 2. Descuentos
// ─────────────────────────────────────────────────────────────

const seccion2 = [
  createSubsectionTitle("1.6 La tarjeta de un antiguo propietario"),
  createParagraph(
    "La suscripción es de la clínica, pero la tarjeta la pone una persona: el propietario del momento. Kengo recuerda quién puso cada tarjeta. Cuando cambia el propietario, la tarjeta no cambia sola.",
  ),
  ...createBulletList([
    "Al transferir la propiedad desde la aplicación, el propietario saliente elige: mantener su tarjeta (tarjeta de la clínica) o retirarla. Si la retira, el nuevo propietario recibe un correo para poner la suya antes del siguiente cobro.",
    "Quien puso una tarjeta puede retirarla cuando quiera desde «Mi cuenta → Tarjetas aportadas a clínicas», aunque ya no sea propietario ni miembro. Al retirar la tarjeta que cobra, la clínica sigue funcionando hasta la siguiente renovación y el propietario actual recibe un aviso.",
    "En Stripe, cada tarjeta lleva en su apartado Metadata quién la puso (aportadaPorEmail). Si un cliente pregunta «¿de quién es la tarjeta que se está cobrando?», ahí está la respuesta.",
    "Si una clínica se queda sin tarjeta y nadie pone otra, en el siguiente cobro pasa a impago con los 7 días de gracia habituales (sección 3).",
  ]),
  ...infoBox(
    "No retires tarjetas desde Stripe",
    "Si hay que quitar una tarjeta, que lo haga su titular desde su cuenta o el propietario desde el Portal. Hacerlo desde el Dashboard funciona, pero el titular no se entera y la aplicación tarda hasta un día en reflejarlo.",
  ),
  espacio(200),

  createSectionTitle("2. Descuentos y promociones"),

  ...alertBox(
    "Léelo antes de aplicar tu primer descuento",
    "La aplicación calcula el precio que enseña al cliente a partir de la tarifa y del número de fisioterapeutas. No consulta a Stripe.",
    "Es decir: si aplicas un 50 % de descuento a una clínica del plan Medium, en su pantalla de suscripción seguirá poniendo 449 €/mes, aunque solo se le cobren 224,50 €.",
    "El descuento sí se ve, correctamente aplicado, en el listado de facturas de esa misma pantalla, porque las facturas se leen en vivo de Stripe.",
  ),
  createParagraph(
    "Por eso, siempre que apliques un descuento, avísale al cliente. Una frase que funciona:",
  ),
  new Paragraph({
    children: [
      new TextRun({
        text: "«Te hemos aplicado el descuento acordado. En la pantalla de suscripción verás el precio de tarifa; el importe con descuento es el que aparece en tus facturas y es el que se te cobra.»",
        size: 22,
        italics: true,
        color: "555555",
      }),
    ],
    indent: { left: 400 },
    spacing: { after: 200 },
  }),

  createSubsectionTitle("2.1 Aplicar un cupón a una clínica"),
  ...createNumberedList([
    "Products → Coupons → «+ New», si no tienes ya el cupón creado.",
    "Elige el tipo: porcentaje (por ejemplo 20 %) o importe fijo (por ejemplo 50 € menos al mes).",
    "Elige la duración: una sola vez (Once), durante varios meses (Repeating) o para siempre (Forever).",
    "Guarda el cupón. Después abre el cliente, entra en su suscripción, pulsa «Update subscription» y añade el cupón en el apartado de descuentos.",
  ]),
  espacio(100),
  createParagraph("Cuál elegir según el caso:"),
  espacio(100),
  createTable(
    ["Situación", "Qué usar", "Por qué"],
    [
      [
        "Promoción de lanzamiento o captación (los tres primeros meses más baratos)",
        "Cupón Repeating",
        "Se retira solo al terminar. No tienes que acordarte de nada.",
      ],
      [
        "Compensar una incidencia (un mes que el servicio falló)",
        "Cupón Once",
        "Afecta solo a la siguiente factura.",
      ],
      [
        "Condición permanente pactada con un cliente concreto",
        "Cupón Forever",
        "Se mantiene mientras dure la suscripción, aunque cambie de plan.",
      ],
      [
        "Acuerdo enterprise con precio propio y más de 9 fisioterapeutas",
        "Precio negociado (sección 1.1)",
        "Ahí el descuento no es el mecanismo: lo que cambia es el contrato entero.",
      ],
    ],
  ),

  createSubsectionTitle("2.2 Retirar un descuento"),
  createParagraph(
    "Abre la suscripción, «Update subscription» y elimina el descuento. Surte efecto en la siguiente factura; no se devuelve nada de lo ya cobrado.",
  ),

  createSubsectionTitle("2.3 Códigos promocionales"),
  createParagraph(
    "Un código promocional es un cupón con un texto que el cliente teclea (por ejemplo VERANO25). Se crea en Products → Coupons, sobre un cupón existente, en el apartado de Promotion codes.",
  ),
  ...infoBox(
    "Dónde se pueden canjear",
    "La pantalla de pago de Kengo no ofrece campo para introducir códigos promocionales. Hoy los descuentos los aplicas tú directamente sobre la suscripción del cliente.",
    "Si os interesa que los clientes puedan canjearlos ellos mismos, es un desarrollo pequeño: coméntalo con el equipo técnico.",
  ),
  saltoDePagina(),
];

// ─────────────────────────────────────────────────────────────
// 3. Trials
// ─────────────────────────────────────────────────────────────

const seccion3 = [
  createSectionTitle("3. Periodos de prueba (trials)"),

  createParagraph(
    "Toda clínica nueva arranca con un periodo de prueba de 14 días sin necesidad de tarjeta. Durante ese tiempo trabaja con normalidad.",
  ),
  createParagraph("Qué pasa cuando termina:"),
  ...createBulletList([
    "Si la clínica ha añadido tarjeta, se le cobra la primera cuota y pasa a estado activo.",
    "Si no la ha añadido, Stripe emite una factura que no puede cobrar y la clínica entra en impago, con los 7 días de gracia que se explican en la sección 4.",
  ]),
  createParagraph(
    "Tres días antes del final, la aplicación envía sola un correo de aviso al propietario.",
  ),

  createSubsectionTitle("3.1 Alargar un periodo de prueba"),
  createParagraph(
    "Es la operación más habitual: una clínica que está decidiendo y necesita unos días más.",
  ),
  createParagraph("Forma recomendada: pídeselo al equipo técnico."),
  createParagraph(
    "Es una operación de un minuto para ellos, deja el estado perfectamente coherente y evita los efectos colaterales de tocarlo a mano. Indícales el Clinic ID y cuántos días quieres que tenga desde hoy.",
  ),
  espacio(100),
  createParagraph("Forma alternativa, desde Stripe:"),
  ...createNumberedList([
    "Abre la suscripción del cliente y pulsa «Update subscription».",
    "Cambia la fecha de fin del periodo de prueba (Trial end) a la nueva fecha.",
    "En las opciones de prorrateo elige que no se genere ningún cargo.",
    "Guarda. La aplicación recoge la nueva fecha en segundos.",
  ]),
  ...alertBox(
    "Si pides la ampliación al equipo técnico, di los días TOTALES",
    "La herramienta que usan cuenta los días desde el momento en que se ejecuta, no los suma a lo que quedaba. Pedir «30 días» dos veces deja 30 días, no 60.",
    "Y si a la clínica le quedaban 20 días y pides «10», se le acorta la prueba a 10. Pide siempre el total que quieres que tenga a partir de hoy.",
  ),

  createSubsectionTitle("3.2 Acortar o terminar un periodo de prueba"),
  createParagraph(
    "Se hace igual que alargarlo, poniendo una fecha anterior.",
  ),
  ...alertBox(
    "Terminar el trial de un cliente sin tarjeta le envía un aviso de impago",
    "Al acabar la prueba, Stripe intenta cobrar. Si no hay tarjeta, el cobro falla, la clínica entra en impago y la aplicación le manda automáticamente un correo de «no hemos podido procesar tu pago».",
    "Tú creías estar cerrando una prueba y el cliente recibe un aviso de problema de pago. Si la intención es que deje de usar el servicio, es mejor cancelar (sección 4.5).",
  ),

  createSubsectionTitle("3.3 Conceder una prueba a una clínica que no la tiene"),
  createParagraph(
    "Por ejemplo, una clínica que canceló y quiere volver a probar. Pídeselo al equipo técnico: la herramienta que tienen crea la suscripción de prueba desde cero si hace falta, y deja el estado correcto. Hacerlo a mano en Stripe entra en el terreno de la reactivación manual, que no debe hacerse (sección 4.6).",
  ),
  ...alertBox(
    "Quitar la fecha de prueba no la borra en Kengo",
    "Si vacías el campo de fin de prueba en Stripe, la aplicación conserva la fecha antigua. No afecta a lo que la clínica puede hacer, pero verás una fecha que ya no significa nada. Mejor mover la fecha que borrarla.",
  ),
  saltoDePagina(),
];

// ─────────────────────────────────────────────────────────────
// 4. Cobros e incidencias
// ─────────────────────────────────────────────────────────────

const seccion4 = [
  createSectionTitle("4. Cobros e incidencias"),

  createSubsectionTitle("4.1 Qué ocurre cuando un cobro falla"),
  createParagraph(
    "El proceso es automático de principio a fin. No tienes que intervenir salvo que quieras dar un trato especial.",
  ),
  espacio(100),
  createTable(
    ["Momento", "Qué pasa", "¿Puede trabajar la clínica?"],
    [
      ["El cobro falla", "La clínica entra en impago y se le abre un plazo de gracia de 7 días. Se le envía un correo automático avisando.", "Sí, con normalidad"],
      ["Durante esos 7 días", "Stripe reintenta el cobro por su cuenta varias veces.", "Sí"],
      ["Si paga dentro del plazo", "Todo vuelve a la normalidad automáticamente.", "Sí"],
      ["Si se agotan los 7 días", "Cada madrugada, un proceso automático marca la clínica como impagada y la bloquea.", "No, queda bloqueada"],
      ["Si paga después", "Al cobrarse la factura, se desbloquea sola.", "Sí, de nuevo"],
    ],
  ),
  espacio(200),
  ...infoBox(
    "El plazo de gracia no se reinicia",
    "Los 7 días se conceden una sola vez, al entrar en impago. Los reintentos de cobro posteriores no lo amplían.",
    "Si necesitas darle más margen a un cliente concreto, pídeselo al equipo técnico.",
  ),

  createSubsectionTitle("4.2 Cobrar una factura pendiente a mano"),
  createParagraph(
    "Si el cliente te dice que ya ha arreglado su tarjeta, puedes forzar el cobro sin esperar al reintento automático: abre la factura pendiente en Stripe y pulsa «Collect payment».",
  ),
  createParagraph(
    "Si el cobro sale bien, la clínica se desbloquea sola en segundos.",
  ),

  createSubsectionTitle("4.3 Reembolsos"),
  createParagraph(
    "Abre la factura o el pago en Stripe y pulsa «Refund». Puedes devolver el importe completo o una parte.",
  ),
  ...infoBox(
    "Un reembolso no cambia el estado de la clínica",
    "Es lo correcto: devolver dinero no debe cortarle el servicio a nadie. La clínica sigue trabajando igual.",
    "Si además quieres que deje de usar el servicio, tienes que cancelar la suscripción aparte (sección 4.5).",
  ),

  createSubsectionTitle("4.4 Anular una factura o marcarla como incobrable"),
  createParagraph(
    "Se hace desde la propia factura, con las opciones «Void invoice» o «Mark as uncollectible». La clínica no se ve afectada de inmediato.",
  ),
  ...alertBox(
    "Marcar como incobrable puede acabar bloqueando la clínica",
    "Según cómo esté configurado el proceso de reclamación de impagos, marcar una factura como incobrable puede llevar la suscripción a estado impagado. Cuando eso ocurre, la clínica se bloquea al instante, sin plazo de gracia y sin ningún correo de aviso.",
    "Si el cliente sigue siendo cliente, es mejor anular la factura que marcarla incobrable.",
  ),

  createSubsectionTitle("4.5 Cancelar una suscripción"),
  createParagraph("Hay dos formas y no dan el mismo resultado."),
  espacio(100),
  createTable(
    ["Forma", "Cómo se hace", "Qué ocurre"],
    [
      [
        "Al final del periodo (recomendada)",
        "En la suscripción, «Cancel subscription» → al final del periodo de facturación",
        "La clínica sigue trabajando hasta la fecha de renovación y luego deja de pagar. En su pantalla verá «Se cancelará el …». Puedes deshacerlo en cualquier momento antes de esa fecha.",
      ],
      [
        "Inmediata",
        "En la suscripción, «Cancel subscription» → inmediatamente",
        "La clínica se bloquea en ese mismo momento y se envía un correo automático de cancelación al propietario.",
      ],
    ],
  ),
  espacio(200),
  ...alertBox(
    "La cancelación inmediata avisa al cliente sin que tú hagas nada",
    "El correo sale solo, en cuanto guardas. Si estabas probando algo o te has equivocado de cliente, ya no puedes retirarlo.",
    "Salvo que el cliente pida el corte inmediato, usa siempre la cancelación al final del periodo.",
  ),

  createSubsectionTitle("4.6 Reactivar una clínica cancelada"),
  ...dangerBox(
    "No crees una suscripción nueva para reactivar",
    "Stripe no permite revivir una suscripción cancelada, así que la tentación es crear otra. No funciona: la aplicación la rechaza porque sigue vinculada a la anterior, y la clínica se queda bloqueada aunque se le esté cobrando.",
  ),
  createParagraph("La forma correcta:"),
  ...createBulletList([
    "Que sea el propio cliente quien reactive desde la aplicación, en «Mi clínica → Suscripción». El proceso deja todo correctamente enlazado.",
    "Si el cliente no puede hacerlo o hay que montarlo a mano por un acuerdo especial, pídeselo al equipo técnico: hay que crear la suscripción y volver a enlazarla, y son dos pasos que no están en el panel de Stripe.",
  ]),

  createSubsectionTitle("4.7 Pausar el cobro"),
  ...dangerBox(
    "No uses «Pause collection» nunca",
    "Kengo no entiende esta operación, y falla en las dos direcciones posibles.",
    "En el caso más habitual, Stripe mantiene la suscripción como activa: la clínica seguiría trabajando con todo desbloqueado y sin que se le facture nada, indefinidamente y sin que nadie lo note.",
    "En el otro caso, la clínica se queda bloqueada de golpe, sin plazo de gracia y sin ningún correo de aviso: el cliente ve «Sin suscripción» y no entiende qué ha pasado.",
    "Si necesitas dejar a un cliente en pausa, usa un cupón del 100 % durante los meses que acordéis, o cancela al final del periodo.",
  ),

  createSubsectionTitle("4.8 Método de pago y datos fiscales"),
  createParagraph(
    "Puedes cambiarlos libremente desde el cliente en Stripe: Kengo no guarda ni tarjetas ni datos fiscales, así que no hay nada que se pueda descuadrar.",
  ),
  createParagraph(
    "Aun así, lo natural es que lo haga el propio cliente desde la aplicación, que le abre su portal de pago de Stripe.",
  ),
  ...alertBox(
    "No edites a mano los campos personalizados de la factura",
    "En las facturas aparece una etiqueta con el plan («Plan Medium», «Plan a medida»). La escribe la aplicación automáticamente.",
    "Si la cambias a mano, se perderá en la siguiente actualización de la suscripción.",
  ),
  saltoDePagina(),
];

// ─────────────────────────────────────────────────────────────
// 5. Tabla de referencia rápida
// ─────────────────────────────────────────────────────────────

const seccion5 = [
  createSectionTitle("5. Tabla de referencia rápida"),
  createParagraph(
    "Resumen de todo lo anterior. «Se refleja» significa que la aplicación se entera del cambio y actúa en consecuencia.",
  ),
  espacio(100),
  createTable(
    ["Operación en Stripe", "¿Se refleja?", "¿Avisa al cliente?", "¿Es seguro?"],
    [
      ["Cambiar la cantidad de un contrato a medida", "Sí", "No", "Sí — es la vía oficial"],
      ["Cambiar entre precio base y precio ilimitado", "Sí", "No", "Sí, comprobando los pacientes"],
      ["Aplicar o retirar un cupón", "Solo en las facturas", "No", "Sí, avisando al cliente"],
      ["Alargar el periodo de prueba", "Sí", "No", "Sí"],
      ["Acortar o terminar el periodo de prueba", "Sí", "Sí, aviso de impago", "Con cuidado"],
      ["Cobrar una factura pendiente", "Sí, desbloquea", "No", "Sí"],
      ["Reembolsar total o parcialmente", "No, y está bien", "No", "Sí"],
      ["Anular una factura", "No", "No", "Sí"],
      ["Marcar una factura como incobrable", "Puede bloquear", "No", "Con cuidado"],
      ["Cancelar al final del periodo", "Sí", "No", "Sí — es la vía recomendada"],
      ["Cancelar de inmediato", "Sí, bloquea", "Sí, aviso de cancelación", "Con cuidado"],
      ["Cambiar método de pago o datos fiscales", "No hace falta", "No", "Sí"],
      ["Cambiar la cantidad en un plan normal", "Se deshace sola", "No", "No — no sirve de nada"],
      ["Poner un precio no oficial", "Sí, como contrato a medida", "No", "No, salvo que sea a propósito"],
      ["Pausar el cobro", "No lo entiende", "No", "NO — nunca"],
      ["Reactivar creando una suscripción nueva", "No", "No", "NO — nunca"],
      ["Cualquier cosa sin orgId", "No", "No", "NO — nunca"],
    ],
  ),
  saltoDePagina(),
];

// ─────────────────────────────────────────────────────────────
// 6. Estados
// ─────────────────────────────────────────────────────────────

const seccion6 = [
  createSectionTitle("6. Los estados de una suscripción"),
  createParagraph(
    "Si alguna vez tienes que mirar el estado interno de una clínica, o el equipo técnico te lo menciona, esto es lo que significa cada uno.",
  ),
  espacio(100),
  createTable(
    ["Estado", "Qué significa", "¿Puede trabajar?"],
    [
      ["En prueba (trialing)", "Periodo de prueba en curso.", "Sí"],
      ["Activa (active)", "Todo correcto y al corriente de pago.", "Sí"],
      ["Impago con gracia (past due)", "Un cobro ha fallado y corre el plazo de 7 días.", "Sí"],
      ["Impagada (unpaid)", "Se agotó el plazo de gracia sin cobrar.", "No"],
      ["Cancelada (canceled)", "La suscripción terminó.", "No"],
      ["Incompleta (incomplete)", "Un alta que no llegó a completar el primer pago.", "No"],
      ["Sin suscripción (none)", "No hay suscripción asociada.", "No"],
      ["Enterprise pendiente", "Clínica grande a la espera de que ventas cierre el acuerdo. Se le deja trabajar mientras tanto.", "Sí"],
    ],
  ),
  espacio(200),
  ...infoBox(
    "Una clínica sin ficha de facturación también puede trabajar",
    "Si por lo que sea una clínica no tiene ninguna información de suscripción, el sistema la deja operar en vez de bloquearla. Es deliberado: preferimos no cortarle el servicio a nadie por un fallo nuestro.",
    "Un proceso automático nocturno detecta esas clínicas y les crea la suscripción de prueba que les faltaba.",
  ),
  saltoDePagina(),
];

// ─────────────────────────────────────────────────────────────
// Anexo A
// ─────────────────────────────────────────────────────────────

const anexoA = [
  createSectionTitle("Anexo A — Operaciones que requieren ayuda de desarrollo"),
  createParagraph(
    "Estas cosas no se pueden hacer desde Stripe. Las ejecuta el equipo técnico desde el panel interno, normalmente en cuestión de minutos. Están aquí para que sepas que la opción existe, no para que las intentes tú.",
  ),
  espacio(100),
  createTable(
    ["Necesito…", "Qué pide el equipo técnico", "Ten en cuenta"],
    [
      [
        "Alargar el periodo de prueba de una clínica",
        "Clinic ID y días totales desde hoy",
        "No se suma a lo que quedaba: sustituye. Pide el total.",
      ],
      [
        "Dar una prueba a una clínica que no tiene",
        "Clinic ID y días",
        "También sirve para clínicas que cancelaron y quieren volver.",
      ],
      [
        "Reenlazar una clínica con su suscripción de Stripe",
        "Clinic ID",
        "Para cuando el vínculo se ha perdido y los cambios de Stripe no llegan.",
      ],
      [
        "Forzar la relectura de las plazas contratadas",
        "Nada, es global",
        "Ya se ejecuta sola cada madrugada; solo si hay prisa.",
      ],
      [
        "Cambiar el propietario de una clínica",
        "Clinic ID, correo del nuevo propietario y motivo",
        "El nuevo propietario debe ser ya miembro. Queda registrado quién lo pidió y por qué. El correo del cliente en Stripe se actualiza solo (y el nombre, salvo que ya fuera una razón social). La tarjeta del propietario anterior se mantiene: él puede retirarla desde su cuenta y el nuevo propietario pone la suya desde «Mi clínica → Suscripción». Ver 1.6.",
      ],
      [
        "Fusionar dos cuentas de la misma persona",
        "Los dos correos",
        "Se hace primero una simulación para ver qué se movería.",
      ],
      [
        "Borrar una cuenta a petición del usuario",
        "Correo del usuario",
        "Es irreversible.",
      ],
      [
        "Ver la aplicación como la ve un cliente para ayudarle",
        "Correo del usuario",
        "Solo técnicos autorizados; queda registrado en una bitácora.",
      ],
    ],
  ),
  espacio(300),
  createSubsectionTitle("Qué incluir cuando pidas algo"),
  createParagraph(
    "Cuanta más información des, menos vueltas. Lo mínimo útil:",
  ),
  ...createBulletList([
    "El Clinic ID, o en su defecto el nombre exacto de la clínica y el correo del propietario.",
    "Qué necesitas que pase, en una frase.",
    "Qué has intentado ya y qué has visto.",
    "Si es urgente y por qué (por ejemplo, la clínica está bloqueada y no puede trabajar).",
  ]),
  saltoDePagina(),
];

// ─────────────────────────────────────────────────────────────
// Anexo B — glosario
// ─────────────────────────────────────────────────────────────

const anexoB = [
  createSectionTitle("Anexo B — Glosario"),
  createParagraph(
    "Términos que aparecen en el panel de Stripe y en esta guía.",
  ),
  espacio(100),
  createTable(
    ["Término", "Qué es"],
    [
      ["Customer (cliente)", "La ficha de la clínica en Stripe: sus datos, su método de pago y sus facturas."],
      ["Subscription (suscripción)", "El cobro recurrente asociado a un cliente. Una clínica tiene una."],
      ["Product (producto)", "«Kengo Suscripción Clínica». Es único y agrupa todos los precios."],
      ["Price (precio)", "Una tarifa concreta del producto. Kengo tiene dos oficiales, base e ilimitado, y los que crees para acuerdos a medida."],
      ["Quantity (cantidad)", "En un contrato a medida, las plazas de fisioterapeuta contratadas. En un plan normal lo gestiona la aplicación sola."],
      ["Metadata / orgId", "Etiqueta interna de la suscripción que la vincula con la clínica en Kengo. Sin ella no se comunican."],
      ["Coupon (cupón)", "Descuento en porcentaje o importe, temporal o permanente."],
      ["Proration (prorrateo)", "El ajuste que hace Stripe cuando cambias de plan a mitad de mes, para cobrar solo la parte proporcional."],
      ["Trial (periodo de prueba)", "Los 14 días iniciales sin necesidad de tarjeta."],
      ["Dunning (reclamación de impagos)", "El proceso automático de Stripe que reintenta los cobros fallidos."],
      ["Invoice (factura)", "El documento de cada cobro. La clínica las ve y descarga desde la aplicación."],
    ],
  ),
  espacio(400),
  ...infoBox(
    "Este documento se genera automáticamente",
    "Si detectas algo que no cuadra con lo que ves en pantalla, díselo al equipo técnico en vez de corregir el Word: el texto vive en el repositorio y se regenera con un comando.",
    `Versión ${VERSION}, generada el ${FECHA}.`,
  ),
];

// ─────────────────────────────────────────────────────────────
// Documento
// ─────────────────────────────────────────────────────────────

const doc = new Document({
  styles: {
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        run: { size: 36, bold: true, color: KENGO_PRIMARY },
        paragraph: { spacing: { before: 480, after: 240 } },
      },
    ],
  },
  sections: [
    {
      properties: {
        // Portada sin cabecera ni pie (usa los headers/footers `first`).
        titlePage: true,
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(0.9),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(0.9),
          },
        },
      },
      headers: {
        first: new Header({ children: [new Paragraph({ children: [] })] }),
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "KENGO · Guía de gestión de suscripciones",
                  bold: true,
                  color: KENGO_PRIMARY,
                  size: 18,
                }),
              ],
              alignment: AlignmentType.LEFT,
            }),
          ],
        }),
      },
      footers: {
        first: new Footer({ children: [new Paragraph({ children: [] })] }),
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "Página ", size: 18, color: "999999" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "999999" }),
                new TextRun({ text: " de ", size: 18, color: "999999" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: "999999" }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
      children: [
        ...portada,
        ...indice,
        ...seccion0,
        ...seccion1,
        ...seccion2,
        ...seccion3,
        ...seccion4,
        ...seccion5,
        ...seccion6,
        ...anexoA,
        ...anexoB,
      ],
    },
  ],
});

const outputPath = path.join(__dirname, "../docs/Guia-Gestores-Kengo.docx");

Packer.toBuffer(doc)
  .then((buffer) => {
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ Documento generado: ${outputPath}`);
  })
  .catch((err) => {
    console.error("❌ Error generando el documento:", err);
    process.exitCode = 1;
  });
