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
  BorderStyle,
  ImageRun,
  Header,
  Footer,
  PageNumber,
  ShadingType,
  convertInchesToTwip,
  PageBreak,
} = require("docx");
const fs = require("fs");
const path = require("path");

// Color primario de Kengo
const KENGO_PRIMARY = "E75C3E";
const KENGO_TERTIARY = "EFC048";
const KENGO_DARK = "333333";

// Cargar el logo
const logoPath = path.join(__dirname, "../src/assets/Logo-K.png");
const logoBuffer = fs.readFileSync(logoPath);

// Función para crear encabezado de tabla
function createTableHeader(texts) {
  return new TableRow({
    tableHeader: true,
    children: texts.map(
      (text) =>
        new TableCell({
          shading: { fill: KENGO_PRIMARY, type: ShadingType.CLEAR },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: text,
                  bold: true,
                  color: "FFFFFF",
                  size: 22,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        })
    ),
  });
}

// Función para crear fila de tabla
function createTableRow(texts, isAlternate = false) {
  return new TableRow({
    children: texts.map(
      (text) =>
        new TableCell({
          shading: isAlternate
            ? { fill: "F5F5F5", type: ShadingType.CLEAR }
            : undefined,
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: text,
                  size: 20,
                }),
              ],
              alignment: AlignmentType.LEFT,
            }),
          ],
        })
    ),
  });
}

// Función para crear una tabla
function createTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      createTableHeader(headers),
      ...rows.map((row, i) => createTableRow(row, i % 2 === 1)),
    ],
  });
}

// Función para crear título de sección
function createSectionTitle(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    style: "Heading1",
  });
}

// Función para crear subtítulo
function createSubsectionTitle(text) {
  return new Paragraph({
    children: [
      new TextRun({
        text: text,
        bold: true,
        color: KENGO_PRIMARY,
        size: 26,
      }),
    ],
    spacing: { before: 300, after: 150 },
  });
}

// Función para crear párrafo normal
function createParagraph(text) {
  return new Paragraph({
    children: [new TextRun({ text: text, size: 22 })],
    spacing: { after: 120 },
  });
}

// Función para crear párrafo con énfasis
function createEmphasisParagraph(text) {
  return new Paragraph({
    children: [
      new TextRun({
        text: text,
        size: 22,
        bold: true,
        color: KENGO_PRIMARY,
      }),
    ],
    spacing: { after: 120 },
  });
}

// Función para crear lista con bullets
function createBulletList(items) {
  return items.map(
    (item) =>
      new Paragraph({
        children: [new TextRun({ text: item, size: 22 })],
        bullet: { level: 0 },
        spacing: { after: 80 },
      })
  );
}

// Función para crear lista numerada
function createNumberedList(items) {
  return items.map(
    (item, index) =>
      new Paragraph({
        children: [
          new TextRun({
            text: `${index + 1}. ${item}`,
            size: 22,
          }),
        ],
        spacing: { after: 80 },
        indent: { left: 360 },
      })
  );
}

// Función para crear caja de alerta/aviso
function createAlertBox(title, text) {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: `⚠️ ${title}`,
          bold: true,
          size: 24,
          color: "856404",
        }),
      ],
      shading: { fill: "FFF3CD", type: ShadingType.CLEAR },
      spacing: { before: 200, after: 100 },
      indent: { left: 200, right: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: text,
          size: 22,
          color: "856404",
        }),
      ],
      shading: { fill: "FFF3CD", type: ShadingType.CLEAR },
      spacing: { after: 200 },
      indent: { left: 200, right: 200 },
    }),
  ];
}

// Función para crear fila de cronograma con color
function createTimelineRow(texts, phase) {
  const colors = {
    requisitos: "FFF3CD",    // Amarillo
    desarrollo: "D4EDDA",    // Verde
    pruebas: "CCE5FF",       // Azul
    despliegue: "E2D5F1",    // Morado
  };
  const bgColor = colors[phase] || "FFFFFF";

  return new TableRow({
    children: texts.map(
      (text) =>
        new TableCell({
          shading: { fill: bgColor, type: ShadingType.CLEAR },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: text,
                  size: 20,
                }),
              ],
              alignment: AlignmentType.LEFT,
            }),
          ],
        })
    ),
  });
}

// Crear el documento
const doc = new Document({
  styles: {
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        run: {
          size: 36,
          bold: true,
          color: KENGO_PRIMARY,
        },
        paragraph: {
          spacing: { before: 480, after: 240 },
        },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1),
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new ImageRun({
                  data: logoBuffer,
                  transformation: { width: 40, height: 50 },
                  type: "png",
                }),
                new TextRun({
                  text: "   KENGO - Plan de Desarrollo",
                  bold: true,
                  color: KENGO_PRIMARY,
                  size: 20,
                }),
              ],
              alignment: AlignmentType.LEFT,
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Kengo - Plan de Desarrollo Pasarelas de Pago | Página ",
                  size: 18,
                  color: "666666",
                }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  size: 18,
                  color: "666666",
                }),
                new TextRun({
                  text: " de ",
                  size: 18,
                  color: "666666",
                }),
                new TextRun({
                  children: [PageNumber.TOTAL_PAGES],
                  size: 18,
                  color: "666666",
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
      children: [
        // === PORTADA ===
        new Paragraph({ spacing: { before: 800 } }),
        new Paragraph({
          children: [
            new ImageRun({
              data: logoBuffer,
              transformation: { width: 150, height: 185 },
              type: "png",
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ spacing: { before: 300 } }),
        new Paragraph({
          children: [
            new TextRun({
              text: "KENGO",
              bold: true,
              size: 72,
              color: KENGO_PRIMARY,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Plataforma de Gestión para Fisioterapia",
              size: 32,
              color: "666666",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "PLAN DE DESARROLLO",
              bold: true,
              size: 40,
              color: KENGO_DARK,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 600, after: 150 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Sistema de Suscripciones y",
              size: 32,
              color: KENGO_PRIMARY,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Pasarelas de Pago",
              size: 32,
              color: KENGO_PRIMARY,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Fecha del documento: ${new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}`,
              size: 24,
              color: "999999",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Versión 1.0",
              size: 22,
              color: "999999",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 100 },
        }),
        new Paragraph({ children: [new PageBreak()] }),

        // === ÍNDICE ===
        createSectionTitle("Índice"),
        ...createBulletList([
          "1. Resumen Ejecutivo",
          "2. Objetivos del Proyecto",
          "3. Alcance Funcional",
          "4. Cronograma de Desarrollo",
          "5. Requisitos Previos",
          "6. Arquitectura Técnica",
          "7. Consideraciones de Seguridad",
          "8. Riesgos y Mitigaciones",
          "9. Entregables",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 1. RESUMEN EJECUTIVO ===
        createSectionTitle("1. Resumen Ejecutivo"),
        createParagraph(
          "Este documento describe el plan de desarrollo para la implementación del sistema de suscripciones y pasarelas de pago en la plataforma Kengo. El objetivo principal es permitir que los usuarios (clínicas y fisioterapeutas) puedan suscribirse al uso de la plataforma mediante diferentes planes de pago."
        ),
        new Paragraph({ spacing: { after: 200 } }),

        createSubsectionTitle("Datos Clave del Proyecto"),
        createTable(
          ["Concepto", "Detalle"],
          [
            ["Nombre del proyecto", "Sistema de Suscripciones y Pasarelas de Pago"],
            ["Inicio previsto", "Principios de febrero de 2026"],
            ["Finalización prevista", "Principios de marzo de 2026"],
            ["Duración estimada", "4-5 semanas"],
            ["Estado actual", "Pendiente de documentación del cliente"],
          ]
        ),
        new Paragraph({ spacing: { after: 300 } }),

        ...createAlertBox(
          "CONDICIÓN IMPORTANTE",
          "El inicio del desarrollo está condicionado a que el cliente aporte la documentación necesaria sobre los detalles de facturación que se pretende implementar ANTES del inicio del desarrollo. Sin esta información, los plazos indicados podrían verse afectados."
        ),
        new Paragraph({ children: [new PageBreak()] }),

        // === 2. OBJETIVOS DEL PROYECTO ===
        createSectionTitle("2. Objetivos del Proyecto"),

        createSubsectionTitle("2.1 Objetivo Principal"),
        createParagraph(
          "Implementar un sistema completo de suscripciones que permita monetizar la plataforma Kengo mediante planes de pago recurrentes, integrando pasarelas de pago seguras y cumpliendo con la normativa vigente."
        ),

        createSubsectionTitle("2.2 Objetivos Específicos"),
        ...createBulletList([
          "Integrar una o varias pasarelas de pago (Stripe, PayPal, etc.)",
          "Desarrollar un sistema de planes de suscripción configurables",
          "Implementar gestión automática de facturación recurrente",
          "Crear panel de administración para gestión de suscripciones",
          "Desarrollar flujo de onboarding con selección de plan",
          "Implementar sistema de notificaciones de pago",
          "Garantizar cumplimiento normativo (PCI-DSS, RGPD)",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 3. ALCANCE FUNCIONAL ===
        createSectionTitle("3. Alcance Funcional"),

        createSubsectionTitle("3.1 Funcionalidades para Usuarios"),
        createTable(
          ["Funcionalidad", "Descripción"],
          [
            ["Selección de plan", "Visualización y comparativa de planes disponibles"],
            ["Proceso de pago", "Checkout seguro con múltiples métodos de pago"],
            ["Gestión de suscripción", "Cambio de plan, cancelación, renovación"],
            ["Historial de pagos", "Consulta de facturas y recibos"],
            ["Actualización de método de pago", "Modificar tarjeta o cuenta asociada"],
            ["Notificaciones", "Alertas de vencimiento, renovación y fallos de pago"],
          ]
        ),
        new Paragraph({ spacing: { after: 300 } }),

        createSubsectionTitle("3.2 Funcionalidades para Administración"),
        createTable(
          ["Funcionalidad", "Descripción"],
          [
            ["Gestión de planes", "Crear, editar y desactivar planes de suscripción"],
            ["Dashboard de ingresos", "Métricas de facturación y suscripciones activas"],
            ["Gestión de clientes", "Ver estado de suscripción por usuario/clínica"],
            ["Cupones y descuentos", "Crear y gestionar códigos promocionales"],
            ["Reportes financieros", "Exportación de datos para contabilidad"],
            ["Gestión de impagos", "Seguimiento y acciones sobre pagos fallidos"],
          ]
        ),
        new Paragraph({ spacing: { after: 300 } }),

        createSubsectionTitle("3.3 Tipos de Planes (Propuesta Inicial)"),
        createParagraph(
          "La siguiente es una propuesta inicial de estructura de planes. La configuración final dependerá de la documentación aportada por el cliente:"
        ),
        createTable(
          ["Plan", "Dirigido a", "Características"],
          [
            ["Plan Básico", "Fisioterapeutas individuales", "Funcionalidades esenciales, límite de pacientes"],
            ["Plan Profesional", "Clínicas pequeñas", "Sin límite de pacientes, múltiples fisios"],
            ["Plan Enterprise", "Clínicas grandes / Cadenas", "Multi-clínica, API, soporte prioritario"],
          ]
        ),
        new Paragraph({ children: [new PageBreak()] }),

        // === 4. CRONOGRAMA DE DESARROLLO ===
        createSectionTitle("4. Cronograma de Desarrollo"),

        createSubsectionTitle("4.1 Fases del Proyecto"),
        new Paragraph({ spacing: { after: 150 } }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            createTableHeader(["Fase", "Período", "Duración", "Descripción"]),
            createTimelineRow(["Fase 0: Requisitos", "Previo al inicio", "Variable", "Recepción de documentación del cliente"], "requisitos"),
            createTimelineRow(["Fase 1: Diseño", "Semana 1 (Feb)", "1 semana", "Diseño técnico y de UX/UI"], "desarrollo"),
            createTimelineRow(["Fase 2: Backend", "Semanas 2-3 (Feb)", "2 semanas", "Integración pasarela, API de suscripciones"], "desarrollo"),
            createTimelineRow(["Fase 3: Frontend", "Semana 3-4 (Feb-Mar)", "1.5 semanas", "Interfaces de usuario y flujos"], "desarrollo"),
            createTimelineRow(["Fase 4: Pruebas", "Semana 4 (Mar)", "1 semana", "Testing integral y correcciones"], "pruebas"),
            createTimelineRow(["Fase 5: Despliegue", "Semana 5 (Mar)", "0.5 semanas", "Puesta en producción"], "despliegue"),
          ],
        }),
        new Paragraph({ spacing: { after: 300 } }),

        createSubsectionTitle("4.2 Hitos Principales"),
        createTable(
          ["Hito", "Fecha Estimada", "Entregable"],
          [
            ["Kick-off del proyecto", "1ª semana de febrero 2026", "Documentación de requisitos completa"],
            ["Diseño aprobado", "1ª semana de febrero 2026", "Mockups y arquitectura técnica"],
            ["Backend funcional", "3ª semana de febrero 2026", "API de suscripciones operativa"],
            ["Integración completa", "4ª semana de febrero 2026", "Sistema end-to-end funcionando"],
            ["Release a producción", "1ª semana de marzo 2026", "Sistema en producción"],
          ]
        ),
        new Paragraph({ spacing: { after: 300 } }),

        ...createAlertBox(
          "NOTA SOBRE LOS PLAZOS",
          "Las fechas indicadas son estimaciones basadas en el inicio del desarrollo a principios de febrero de 2026. Cualquier retraso en la entrega de la documentación de facturación por parte del cliente provocará un desplazamiento equivalente en todas las fechas."
        ),
        new Paragraph({ children: [new PageBreak()] }),

        // === 5. REQUISITOS PREVIOS ===
        createSectionTitle("5. Requisitos Previos"),

        createSubsectionTitle("5.1 Documentación Requerida del Cliente"),
        createParagraph(
          "Para poder iniciar el desarrollo según los plazos establecidos, es IMPRESCINDIBLE que el cliente proporcione la siguiente documentación:"
        ),
        new Paragraph({ spacing: { after: 150 } }),
        createTable(
          ["Documento", "Descripción", "Prioridad"],
          [
            ["Estructura de planes", "Definición de planes, precios y características de cada nivel", "CRÍTICA"],
            ["Política de facturación", "Ciclos de facturación, períodos de prueba, política de reembolsos", "CRÍTICA"],
            ["Datos fiscales", "Información fiscal de la empresa para emisión de facturas", "CRÍTICA"],
            ["Términos y condiciones", "Condiciones de servicio y política de cancelación", "ALTA"],
            ["Política de privacidad", "Actualización para incluir procesamiento de pagos", "ALTA"],
            ["Preferencia de pasarela", "Pasarela(s) de pago preferida(s) si existe preferencia", "MEDIA"],
          ]
        ),
        new Paragraph({ spacing: { after: 300 } }),

        createSubsectionTitle("5.2 Decisiones Pendientes"),
        createParagraph(
          "Las siguientes decisiones deben ser tomadas por el cliente antes del inicio:"
        ),
        ...createBulletList([
          "¿Se ofrecerá período de prueba gratuito? ¿De cuántos días?",
          "¿Cuál será el ciclo de facturación? (mensual, anual, ambos)",
          "¿Se permitirán descuentos por pago anual?",
          "¿Qué métodos de pago se aceptarán? (tarjeta, domiciliación, etc.)",
          "¿Se emitirán facturas automáticas o solo recibos?",
          "¿Cuál será la política ante impagos? (días de gracia, suspensión, etc.)",
          "¿Se implementarán cupones o códigos promocionales?",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 6. ARQUITECTURA TÉCNICA ===
        createSectionTitle("6. Arquitectura Técnica"),

        createSubsectionTitle("6.1 Stack Tecnológico Propuesto"),
        createTable(
          ["Componente", "Tecnología", "Justificación"],
          [
            ["Pasarela de pago", "Stripe (recomendado)", "Amplia documentación, soporte SCA, webhooks robustos"],
            ["Backend pagos", "Node.js API existente", "Extensión del backend actual"],
            ["Base de datos", "Directus CMS", "Integración con sistema existente"],
            ["Frontend", "Angular 20", "Consistencia con aplicación actual"],
            ["Notificaciones", "Email + Push", "Sistema de alertas existente"],
          ]
        ),
        new Paragraph({ spacing: { after: 300 } }),

        createSubsectionTitle("6.2 Flujo de Pago"),
        ...createNumberedList([
          "Usuario selecciona plan de suscripción",
          "Sistema muestra resumen y formulario de pago",
          "Usuario introduce datos de pago (procesados por Stripe)",
          "Stripe valida y procesa el pago (SCA si es necesario)",
          "Webhook notifica resultado a backend de Kengo",
          "Backend actualiza estado de suscripción del usuario",
          "Usuario recibe confirmación y acceso al plan contratado",
          "Sistema programa renovación automática según ciclo",
        ]),
        new Paragraph({ spacing: { after: 300 } }),

        createSubsectionTitle("6.3 Modelo de Datos (Simplificado)"),
        createParagraph("Nuevas entidades a crear en el sistema:"),
        ...createBulletList([
          "Planes: Configuración de cada plan disponible",
          "Suscripciones: Relación usuario-plan con fechas y estado",
          "Pagos: Registro de cada transacción realizada",
          "Facturas: Documentos fiscales generados",
          "Métodos de pago: Tarjetas/cuentas asociadas a usuarios",
          "Cupones: Códigos promocionales y descuentos",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 7. CONSIDERACIONES DE SEGURIDAD ===
        createSectionTitle("7. Consideraciones de Seguridad"),

        createSubsectionTitle("7.1 Cumplimiento Normativo"),
        createTable(
          ["Normativa", "Aplicación", "Medidas"],
          [
            ["PCI-DSS", "Procesamiento de tarjetas", "Uso de Stripe Elements, no almacenamiento de datos de tarjeta"],
            ["RGPD", "Datos personales", "Consentimiento explícito, derecho al olvido"],
            ["SCA (PSD2)", "Pagos en Europa", "Autenticación reforzada via 3D Secure"],
            ["Ley de facturación", "Emisión de facturas", "Formato y contenido según normativa española"],
          ]
        ),
        new Paragraph({ spacing: { after: 300 } }),

        createSubsectionTitle("7.2 Medidas de Seguridad Técnicas"),
        ...createBulletList([
          "Tokenización de datos de pago (nunca se almacenan datos de tarjeta en Kengo)",
          "Comunicaciones cifradas (HTTPS/TLS 1.3)",
          "Validación de webhooks mediante firma criptográfica",
          "Logs de auditoría para todas las operaciones de pago",
          "Separación de entornos (sandbox para pruebas, producción para pagos reales)",
          "Rate limiting para prevenir ataques de fuerza bruta",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 8. RIESGOS Y MITIGACIONES ===
        createSectionTitle("8. Riesgos y Mitigaciones"),

        createTable(
          ["Riesgo", "Probabilidad", "Impacto", "Mitigación"],
          [
            ["Retraso en documentación del cliente", "Alta", "Alto", "Comunicación proactiva, plantillas predefinidas"],
            ["Cambios de requisitos durante desarrollo", "Media", "Medio", "Definición clara de alcance, gestión de cambios"],
            ["Problemas de integración con pasarela", "Baja", "Alto", "Uso de SDK oficial, entorno sandbox"],
            ["Requisitos regulatorios adicionales", "Media", "Medio", "Consulta legal previa, diseño flexible"],
            ["Fallos en pagos recurrentes", "Media", "Alto", "Reintentos automáticos, notificaciones"],
          ]
        ),
        new Paragraph({ children: [new PageBreak()] }),

        // === 9. ENTREGABLES ===
        createSectionTitle("9. Entregables"),

        createSubsectionTitle("9.1 Documentación"),
        ...createBulletList([
          "Documento de diseño técnico",
          "Manual de administración del sistema de suscripciones",
          "Guía de usuario para gestión de pagos",
          "Documentación de API para integraciones futuras",
        ]),

        createSubsectionTitle("9.2 Software"),
        ...createBulletList([
          "Módulo de suscripciones integrado en Kengo",
          "Panel de administración de planes y pagos",
          "Integración con pasarela de pagos configurada",
          "Sistema de notificaciones de pago",
          "Generación automática de facturas/recibos",
        ]),

        createSubsectionTitle("9.3 Configuración"),
        ...createBulletList([
          "Cuenta de Stripe (o pasarela elegida) configurada",
          "Planes de suscripción creados según especificaciones",
          "Plantillas de email para notificaciones",
          "Webhooks configurados y probados",
        ]),

        // === PRÓXIMOS PASOS ===
        new Paragraph({ spacing: { before: 400 } }),
        createSectionTitle("Próximos Pasos"),
        createParagraph(
          "Para proceder con el desarrollo según el calendario establecido, se solicita al cliente:"
        ),
        ...createNumberedList([
          "Revisar este documento y confirmar el alcance propuesto",
          "Proporcionar la documentación de facturación detallada en la sección 5.1",
          "Tomar las decisiones pendientes listadas en la sección 5.2",
          "Confirmar la fecha de entrega de la documentación",
          "Agendar reunión de kick-off una vez completados los puntos anteriores",
        ]),
        new Paragraph({ spacing: { after: 200 } }),

        ...createAlertBox(
          "RECORDATORIO FINAL",
          "El cumplimiento de los plazos establecidos (inicio en febrero 2026, finalización en marzo 2026) está directamente condicionado a la recepción de toda la documentación necesaria ANTES del inicio del desarrollo. Se recomienda proporcionar esta información a la mayor brevedad posible."
        ),

        // === FIN DEL DOCUMENTO ===
        new Paragraph({ spacing: { before: 600 } }),
        new Paragraph({
          children: [
            new TextRun({
              text: "─".repeat(50),
              color: KENGO_PRIMARY,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Documento generado automáticamente",
              size: 20,
              color: "999999",
              italics: true,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `${new Date().toLocaleDateString("es-ES")} - Kengo`,
              size: 20,
              color: "999999",
              italics: true,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      ],
    },
  ],
});

// Guardar el documento
const outputPath = path.join(__dirname, "../PLAN_DESARROLLO_PASARELAS_PAGO.docx");

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Documento generado: ${outputPath}`);
});
