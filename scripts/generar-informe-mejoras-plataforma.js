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

// Función para crear caja informativa
function createInfoBox(title, text, type = "info") {
  const colors = {
    info: { bg: "CCE5FF", text: "004085" },
    success: { bg: "D4EDDA", text: "155724" },
    warning: { bg: "FFF3CD", text: "856404" },
  };
  const style = colors[type] || colors.info;
  const icons = { info: "ℹ️", success: "✅", warning: "⚠️" };

  return [
    new Paragraph({
      children: [
        new TextRun({
          text: `${icons[type]} ${title}`,
          bold: true,
          size: 24,
          color: style.text,
        }),
      ],
      shading: { fill: style.bg, type: ShadingType.CLEAR },
      spacing: { before: 200, after: 100 },
      indent: { left: 200, right: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: text,
          size: 22,
          color: style.text,
        }),
      ],
      shading: { fill: style.bg, type: ShadingType.CLEAR },
      spacing: { after: 200 },
      indent: { left: 200, right: 200 },
    }),
  ];
}

// Función para crear fila de módulo con color
function createModuleRow(texts, module) {
  const colors = {
    emails: "E8F4FD",      // Azul claro
    registro: "FDF2E8",    // Naranja claro
    clinicas: "E8FDF2",    // Verde claro
    personalizacion: "F2E8FD", // Morado claro
  };
  const bgColor = colors[module] || "FFFFFF";

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
                  text: "Kengo - Plan de Mejoras de Plataforma | Página ",
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
              text: "Mejoras de Plataforma:",
              size: 28,
              color: KENGO_PRIMARY,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Comunicaciones, Registro, Clínicas y Personalización",
              size: 28,
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
          "2. Módulo 1: Correos Transaccionales Automatizados",
          "3. Módulo 2: Mejora del Flujo de Registro",
          "4. Módulo 3: Gestión de Clínicas",
          "5. Módulo 4: Personalización por Clínica (White-Label)",
          "6. Arquitectura Técnica",
          "7. Cronograma General",
          "8. Dependencias y Requisitos",
          "9. Entregables",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 1. RESUMEN EJECUTIVO ===
        createSectionTitle("1. Resumen Ejecutivo"),
        createParagraph(
          "Este documento describe el plan de desarrollo para la implementación de mejoras significativas en la plataforma Kengo, abarcando cuatro áreas principales: sistema de correos transaccionales, flujo de registro de usuarios, gestión de clínicas y personalización visual por clínica."
        ),
        new Paragraph({ spacing: { after: 200 } }),

        createSubsectionTitle("Módulos del Proyecto"),
        createTable(
          ["Módulo", "Descripción", "Prioridad"],
          [
            ["Correos Transaccionales", "Sistema de emails automáticos para comunicaciones clave", "Alta"],
            ["Flujo de Registro", "Mejora de la experiencia de onboarding de usuarios", "Alta"],
            ["Gestión de Clínicas", "Optimización de creación y administración de clínicas", "Media"],
            ["Personalización (White-Label)", "Customización visual según marca de cada clínica", "Media"],
          ]
        ),
        new Paragraph({ spacing: { after: 300 } }),

        ...createInfoBox(
          "VISIÓN GENERAL",
          "Estas mejoras están orientadas a profesionalizar la plataforma, mejorar la experiencia de usuario y preparar Kengo para su escalabilidad comercial, especialmente de cara a la implementación futura del sistema de suscripciones.",
          "info"
        ),
        new Paragraph({ children: [new PageBreak()] }),

        // === 2. MÓDULO 1: CORREOS TRANSACCIONALES ===
        createSectionTitle("2. Módulo 1: Correos Transaccionales Automatizados"),

        createSubsectionTitle("2.1 Descripción"),
        createParagraph(
          "Implementación de un sistema robusto de correos electrónicos transaccionales que automatice las comunicaciones clave entre la plataforma y los usuarios. Estos correos son fundamentales para la experiencia de usuario y la retención."
        ),

        createSubsectionTitle("2.2 Tipos de Correos a Implementar"),
        new Paragraph({ spacing: { after: 150 } }),

        createParagraph("Correos de Autenticación:"),
        ...createBulletList([
          "Bienvenida al registrarse en la plataforma",
          "Verificación de email",
          "Recuperación de contraseña",
          "Confirmación de cambio de contraseña",
          "Magic link de acceso",
          "Alerta de nuevo inicio de sesión (seguridad)",
        ]),

        createParagraph("Correos de Actividad:"),
        ...createBulletList([
          "Notificación de asignación de nuevo plan de ejercicios",
          "Recordatorio de ejercicios pendientes del día",
          "Resumen semanal de actividad",
          "Felicitación por completar plan de tratamiento",
          "Aviso de plan próximo a vencer",
        ]),

        createParagraph("Correos Administrativos:"),
        ...createBulletList([
          "Invitación a unirse a una clínica",
          "Confirmación de alta como fisioterapeuta",
          "Notificación de nuevo paciente asignado",
          "Alertas de administración de clínica",
        ]),
        new Paragraph({ spacing: { after: 200 } }),

        createSubsectionTitle("2.3 Características del Sistema"),
        createTable(
          ["Característica", "Descripción"],
          [
            ["Plantillas HTML responsive", "Diseño adaptable a móvil y escritorio"],
            ["Personalización por clínica", "Logo y colores de la clínica en los emails"],
            ["Sistema de colas", "Envío asíncrono para no bloquear la aplicación"],
            ["Tracking de apertura", "Métricas de emails abiertos y clicados"],
            ["Preferencias de usuario", "Configuración de qué emails recibir"],
            ["Multi-idioma", "Soporte para español (extensible a otros idiomas)"],
          ]
        ),
        new Paragraph({ children: [new PageBreak()] }),

        createSubsectionTitle("2.4 Flujo de Envío"),
        ...createNumberedList([
          "Evento disparador ocurre en la plataforma (registro, asignación, etc.)",
          "Sistema añade email a la cola de envío",
          "Worker procesa la cola y genera el email desde plantilla",
          "Se aplica personalización de clínica (logo, colores)",
          "Email se envía a través del proveedor (SendGrid/AWS SES)",
          "Se registra el estado de envío y métricas",
        ]),
        new Paragraph({ spacing: { after: 200 } }),

        createSubsectionTitle("2.5 Plantillas de Email"),
        createParagraph("Cada plantilla incluirá:"),
        ...createBulletList([
          "Cabecera con logo de Kengo (o logo de clínica si aplica)",
          "Contenido principal con información relevante",
          "Botón de acción principal (CTA)",
          "Pie con información legal y enlaces de preferencias",
          "Versión de texto plano para clientes que no soportan HTML",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 3. MÓDULO 2: FLUJO DE REGISTRO ===
        createSectionTitle("3. Módulo 2: Mejora del Flujo de Registro"),

        createSubsectionTitle("3.1 Descripción"),
        createParagraph(
          "Optimización completa del proceso de registro de usuarios para mejorar la tasa de conversión, reducir fricciones y garantizar una experiencia de onboarding fluida tanto para fisioterapeutas como para pacientes."
        ),

        createSubsectionTitle("3.2 Análisis del Flujo Actual"),
        createParagraph("Puntos de mejora identificados:"),
        ...createBulletList([
          "Proceso de registro fragmentado",
          "Falta de validación en tiempo real",
          "Ausencia de indicadores de progreso",
          "Confirmación de email poco clara",
          "Onboarding post-registro inexistente",
        ]),

        createSubsectionTitle("3.3 Nuevo Flujo Propuesto"),
        new Paragraph({ spacing: { after: 150 } }),

        createParagraph("Flujo para Fisioterapeutas:"),
        ...createNumberedList([
          "Pantalla de bienvenida con selección de rol",
          "Formulario de datos personales con validación en tiempo real",
          "Verificación de número de colegiado",
          "Selección: crear nueva clínica o unirse a existente",
          "Configuración inicial de la clínica (si es nueva)",
          "Verificación de email",
          "Tutorial interactivo de primeros pasos",
          "Dashboard con checklist de configuración",
        ]),
        new Paragraph({ spacing: { after: 150 } }),

        createParagraph("Flujo para Pacientes:"),
        ...createNumberedList([
          "Acceso mediante invitación del fisioterapeuta",
          "Formulario simplificado de datos básicos",
          "Creación de contraseña con indicador de fortaleza",
          "Verificación de email (opcional según configuración)",
          "Presentación del plan asignado",
          "Tutorial de uso de la aplicación",
        ]),
        new Paragraph({ spacing: { after: 200 } }),

        createSubsectionTitle("3.4 Mejoras de UX/UI"),
        createTable(
          ["Mejora", "Beneficio"],
          [
            ["Indicador de progreso por pasos", "Usuario sabe en qué punto del proceso está"],
            ["Validación en tiempo real", "Errores detectados antes de enviar formulario"],
            ["Autocompletado inteligente", "Reduce tiempo de escritura"],
            ["Guardado automático de progreso", "No se pierde información si se cierra"],
            ["Diseño mobile-first", "Experiencia óptima en dispositivos móviles"],
            ["Mensajes de error claros", "Usuario entiende qué debe corregir"],
          ]
        ),
        new Paragraph({ children: [new PageBreak()] }),

        // === 4. MÓDULO 3: GESTIÓN DE CLÍNICAS ===
        createSectionTitle("4. Módulo 3: Gestión de Clínicas"),

        createSubsectionTitle("4.1 Descripción"),
        createParagraph(
          "Mejora integral del sistema de creación y administración de clínicas, permitiendo una gestión más eficiente y completa de los centros de fisioterapia dentro de la plataforma."
        ),

        createSubsectionTitle("4.2 Funcionalidades de Creación"),
        createTable(
          ["Funcionalidad", "Descripción"],
          [
            ["Asistente de creación", "Wizard paso a paso para configurar la clínica"],
            ["Datos fiscales completos", "NIF, razón social, dirección fiscal"],
            ["Configuración de horarios", "Horarios de atención y días laborables"],
            ["Subida de documentación", "Logo, imágenes de la clínica"],
            ["Código de invitación", "Generación de códigos para unirse a la clínica"],
            ["Configuración inicial de roles", "Definición de permisos por defecto"],
          ]
        ),
        new Paragraph({ spacing: { after: 200 } }),

        createSubsectionTitle("4.3 Funcionalidades de Administración"),
        createTable(
          ["Funcionalidad", "Descripción"],
          [
            ["Panel de control de clínica", "Dashboard con métricas y estado general"],
            ["Gestión de equipo", "Alta, baja y modificación de fisioterapeutas"],
            ["Gestión de roles y permisos", "Configuración granular de accesos"],
            ["Gestión de pacientes", "Vista consolidada de todos los pacientes"],
            ["Configuración de notificaciones", "Qué alertas recibe cada rol"],
            ["Exportación de datos", "Descarga de información para reporting"],
          ]
        ),
        new Paragraph({ spacing: { after: 200 } }),

        createSubsectionTitle("4.4 Sistema de Roles de Clínica"),
        createParagraph("Roles predefinidos con permisos configurables:"),
        createTable(
          ["Rol", "Descripción", "Permisos principales"],
          [
            ["Administrador", "Gestión completa de la clínica", "Todos los permisos"],
            ["Gestor", "Administración operativa", "Gestión de equipo, pacientes, reportes"],
            ["Fisioterapeuta Senior", "Profesional con permisos ampliados", "Crear planes, ver todos los pacientes"],
            ["Fisioterapeuta", "Profesional estándar", "Crear planes, ver sus pacientes"],
            ["Recepción", "Personal administrativo", "Ver agenda, gestión básica de pacientes"],
          ]
        ),
        new Paragraph({ children: [new PageBreak()] }),

        createSubsectionTitle("4.5 Multi-Clínica"),
        createParagraph(
          "Soporte para usuarios que trabajan en múltiples clínicas:"
        ),
        ...createBulletList([
          "Selector de clínica activa en la interfaz",
          "Roles independientes por clínica",
          "Vista consolidada opcional para administradores",
          "Cambio rápido entre contextos de clínica",
          "Notificaciones diferenciadas por clínica",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 5. MÓDULO 4: PERSONALIZACIÓN (WHITE-LABEL) ===
        createSectionTitle("5. Módulo 4: Personalización por Clínica (White-Label)"),

        createSubsectionTitle("5.1 Descripción"),
        createParagraph(
          "Implementación de un sistema de personalización visual que permita a cada clínica adaptar la apariencia de la plataforma según su identidad de marca, ofreciendo una experiencia más profesional y personalizada a sus pacientes."
        ),

        createSubsectionTitle("5.2 Elementos Personalizables"),
        new Paragraph({ spacing: { after: 150 } }),

        createParagraph("Identidad Visual:"),
        createTable(
          ["Elemento", "Descripción", "Aplicación"],
          [
            ["Logo principal", "Logo de la clínica", "Cabecera, emails, documentos"],
            ["Logo secundario", "Versión reducida/icono", "Favicon, móvil"],
            ["Color primario", "Color principal de marca", "Botones, enlaces, acentos"],
            ["Color secundario", "Color complementario", "Fondos, bordes, hovers"],
            ["Color de texto", "Color de tipografía", "Textos principales"],
          ]
        ),
        new Paragraph({ spacing: { after: 200 } }),

        createParagraph("Contenido Personalizable:"),
        ...createBulletList([
          "Nombre de la clínica en toda la interfaz",
          "Mensaje de bienvenida personalizado",
          "Información de contacto en pie de página",
          "Textos de emails transaccionales",
          "Términos y condiciones propios (opcional)",
        ]),

        createSubsectionTitle("5.3 Niveles de Personalización"),
        createTable(
          ["Nivel", "Elementos", "Disponibilidad"],
          [
            ["Básico", "Logo y color primario", "Todos los planes"],
            ["Estándar", "Todos los colores + logo secundario", "Plan Profesional+"],
            ["Avanzado", "Personalización completa + textos custom", "Plan Enterprise"],
          ]
        ),
        new Paragraph({ spacing: { after: 200 } }),

        createSubsectionTitle("5.4 Implementación Técnica"),
        createParagraph("Sistema de temas dinámicos:"),
        ...createBulletList([
          "Variables CSS personalizadas por clínica",
          "Carga dinámica de estilos según contexto",
          "Caché de configuración para rendimiento",
          "Preview en tiempo real durante configuración",
          "Validación de contraste para accesibilidad",
          "Fallback a tema por defecto de Kengo",
        ]),
        new Paragraph({ spacing: { after: 200 } }),

        createSubsectionTitle("5.5 Experiencia del Paciente"),
        createParagraph(
          "Cuando un paciente accede a través de una clínica personalizada:"
        ),
        ...createNumberedList([
          "Ve el logo de su clínica en la cabecera",
          "Los colores de la interfaz coinciden con la marca de la clínica",
          "Los emails que recibe llevan la identidad de la clínica",
          "La URL puede incluir el identificador de la clínica",
          "El pie de página muestra información de contacto de la clínica",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 6. ARQUITECTURA TÉCNICA ===
        createSectionTitle("6. Arquitectura Técnica"),

        createSubsectionTitle("6.1 Stack Tecnológico"),
        createTable(
          ["Componente", "Tecnología", "Módulos que lo usan"],
          [
            ["Frontend", "Angular 20 + Tailwind CSS", "Todos"],
            ["Backend", "Node.js + Directus CMS", "Todos"],
            ["Email Service", "SendGrid / AWS SES", "Correos Transaccionales"],
            ["Cola de mensajes", "Bull + Redis", "Correos Transaccionales"],
            ["Almacenamiento", "Directus Files / S3", "Clínicas, Personalización"],
            ["Caché", "Redis", "Personalización"],
          ]
        ),
        new Paragraph({ spacing: { after: 300 } }),

        createSubsectionTitle("6.2 Nuevos Servicios a Desarrollar"),
        createTable(
          ["Servicio", "Responsabilidad"],
          [
            ["EmailService", "Gestión de plantillas y envío de correos"],
            ["EmailQueueWorker", "Procesamiento asíncrono de cola de emails"],
            ["ClinicConfigService", "Gestión de configuración de clínicas"],
            ["ThemeService", "Aplicación dinámica de temas personalizados"],
            ["OnboardingService", "Gestión del flujo de registro y onboarding"],
            ["NotificationPreferencesService", "Preferencias de notificación por usuario"],
          ]
        ),
        new Paragraph({ spacing: { after: 300 } }),

        createSubsectionTitle("6.3 Modelo de Datos (Nuevas Entidades)"),
        ...createBulletList([
          "EmailTemplates: Plantillas de correo con variables",
          "EmailQueue: Cola de emails pendientes de envío",
          "EmailLogs: Registro de emails enviados y métricas",
          "ClinicSettings: Configuración extendida de clínica",
          "ClinicTheme: Personalización visual por clínica",
          "UserNotificationPreferences: Preferencias de email por usuario",
          "OnboardingProgress: Estado del proceso de registro",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 7. CRONOGRAMA GENERAL ===
        createSectionTitle("7. Cronograma General"),

        createSubsectionTitle("7.1 Fases de Desarrollo"),
        new Paragraph({ spacing: { after: 150 } }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            createTableHeader(["Fase", "Módulos", "Duración Estimada"]),
            createModuleRow(["Fase 1", "Correos Transaccionales (base)", "2 semanas"], "emails"),
            createModuleRow(["Fase 2", "Flujo de Registro", "2 semanas"], "registro"),
            createModuleRow(["Fase 3", "Gestión de Clínicas", "2 semanas"], "clinicas"),
            createModuleRow(["Fase 4", "Personalización (White-Label)", "2 semanas"], "personalizacion"),
            createModuleRow(["Fase 5", "Integración y pruebas", "1 semana"], "emails"),
          ],
        }),
        new Paragraph({ spacing: { after: 300 } }),

        createSubsectionTitle("7.2 Desglose por Módulo"),
        new Paragraph({ spacing: { after: 150 } }),

        createParagraph("Módulo 1 - Correos Transaccionales:"),
        createTable(
          ["Tarea", "Duración"],
          [
            ["Configuración de proveedor de email", "2 días"],
            ["Desarrollo del sistema de colas", "3 días"],
            ["Creación de plantillas base", "3 días"],
            ["Implementación de triggers", "2 días"],
            ["Testing y ajustes", "2 días"],
          ]
        ),
        new Paragraph({ spacing: { after: 200 } }),

        createParagraph("Módulo 2 - Flujo de Registro:"),
        createTable(
          ["Tarea", "Duración"],
          [
            ["Rediseño de pantallas de registro", "3 días"],
            ["Implementación de validaciones", "2 días"],
            ["Desarrollo de onboarding wizard", "3 días"],
            ["Integración con emails de verificación", "1 día"],
            ["Testing y ajustes", "1 día"],
          ]
        ),
        new Paragraph({ spacing: { after: 200 } }),

        createParagraph("Módulo 3 - Gestión de Clínicas:"),
        createTable(
          ["Tarea", "Duración"],
          [
            ["Wizard de creación de clínica", "3 días"],
            ["Panel de administración", "4 días"],
            ["Sistema de roles y permisos", "2 días"],
            ["Testing y ajustes", "1 día"],
          ]
        ),
        new Paragraph({ spacing: { after: 200 } }),

        createParagraph("Módulo 4 - Personalización:"),
        createTable(
          ["Tarea", "Duración"],
          [
            ["Sistema de temas dinámicos", "3 días"],
            ["Interfaz de configuración", "3 días"],
            ["Aplicación en emails", "2 días"],
            ["Testing y ajustes", "2 días"],
          ]
        ),
        new Paragraph({ children: [new PageBreak()] }),

        // === 8. DEPENDENCIAS Y REQUISITOS ===
        createSectionTitle("8. Dependencias y Requisitos"),

        createSubsectionTitle("8.1 Dependencias Técnicas"),
        createTable(
          ["Dependencia", "Módulo", "Descripción"],
          [
            ["Proveedor de email", "Correos", "Cuenta en SendGrid o AWS SES"],
            ["Servidor Redis", "Correos", "Para sistema de colas"],
            ["Dominio verificado", "Correos", "Para envío de emails (SPF, DKIM)"],
            ["CDN/Storage", "Personalización", "Para servir assets de clínicas"],
          ]
        ),
        new Paragraph({ spacing: { after: 300 } }),

        createSubsectionTitle("8.2 Requisitos del Cliente"),
        createParagraph(
          "Información necesaria antes de iniciar el desarrollo:"
        ),
        ...createBulletList([
          "Listado definitivo de tipos de correos a implementar",
          "Contenido/textos para cada tipo de email",
          "Estructura de roles y permisos deseada para clínicas",
          "Requisitos específicos de personalización por nivel de plan",
          "Requisitos legales para emails (pie de página, baja de lista)",
        ]),

        createSubsectionTitle("8.3 Interdependencias entre Módulos"),
        ...createBulletList([
          "Correos Transaccionales es base para los demás módulos",
          "Personalización depende de Gestión de Clínicas",
          "Flujo de Registro se beneficia de Correos (verificación)",
          "Se recomienda desarrollo secuencial según fases propuestas",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 9. ENTREGABLES ===
        createSectionTitle("9. Entregables"),

        createSubsectionTitle("9.1 Por Módulo"),
        new Paragraph({ spacing: { after: 150 } }),

        createParagraph("Módulo 1 - Correos Transaccionales:"),
        ...createBulletList([
          "Sistema de envío de emails con colas",
          "Plantillas HTML responsive para todos los tipos de correo",
          "Panel de administración de plantillas",
          "Dashboard de métricas de emails",
          "Documentación de configuración",
        ]),
        new Paragraph({ spacing: { after: 150 } }),

        createParagraph("Módulo 2 - Flujo de Registro:"),
        ...createBulletList([
          "Nuevo flujo de registro para fisioterapeutas",
          "Nuevo flujo de registro para pacientes",
          "Sistema de onboarding interactivo",
          "Validaciones en tiempo real",
          "Integración con verificación de email",
        ]),
        new Paragraph({ spacing: { after: 150 } }),

        createParagraph("Módulo 3 - Gestión de Clínicas:"),
        ...createBulletList([
          "Wizard de creación de clínicas",
          "Panel de administración de clínica",
          "Sistema de roles y permisos configurable",
          "Gestión de equipo y pacientes",
          "Sistema de códigos de invitación",
        ]),
        new Paragraph({ spacing: { after: 150 } }),

        createParagraph("Módulo 4 - Personalización:"),
        ...createBulletList([
          "Sistema de temas dinámicos",
          "Interfaz de configuración de marca",
          "Aplicación de personalización en emails",
          "Preview en tiempo real",
          "Documentación de uso",
        ]),
        new Paragraph({ spacing: { after: 300 } }),

        createSubsectionTitle("9.2 Documentación General"),
        ...createBulletList([
          "Manual de administración del sistema de emails",
          "Guía de configuración de clínicas",
          "Guía de personalización de marca",
          "Documentación técnica de APIs",
          "Guía de usuario para nuevas funcionalidades",
        ]),

        // === RESUMEN FINAL ===
        new Paragraph({ spacing: { before: 400 } }),
        ...createInfoBox(
          "RESUMEN DEL PROYECTO",
          "Este plan de desarrollo abarca mejoras fundamentales para la profesionalización de Kengo. Los cuatro módulos están interrelacionados y preparan la plataforma para su escalabilidad comercial. Se recomienda su implementación previa o en paralelo al sistema de suscripciones y pasarelas de pago.",
          "success"
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
const outputPath = path.join(__dirname, "../PLAN_DESARROLLO_MEJORAS_PLATAFORMA.docx");

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Documento generado: ${outputPath}`);
});
