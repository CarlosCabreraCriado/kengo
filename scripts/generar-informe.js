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
  NumberFormat,
  ShadingType,
  convertInchesToTwip,
  PageBreak,
} = require("docx");
const fs = require("fs");
const path = require("path");

// Color primario de Kengo
const KENGO_PRIMARY = "E75C3E";
const KENGO_TERTIARY = "EFC048";

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
      (text, index) =>
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
              alignment: index === 0 ? AlignmentType.LEFT : AlignmentType.LEFT,
            }),
          ],
        })
    ),
  });
}

// Colores para estados de desarrollo
const STATUS_COLORS = {
  Completado: "D4EDDA",  // Verde claro
  "En curso": "FFF3CD",  // Amarillo claro
  Pendiente: "F8D7DA",   // Rojo claro
};

// Función para crear fila de desarrollo con color según estado
function createDevTableRow(texts) {
  const status = texts[2]; // El estado está en la tercera columna
  const bgColor = STATUS_COLORS[status] || "FFFFFF";

  return new TableRow({
    children: texts.map(
      (text, index) =>
        new TableCell({
          shading: { fill: bgColor, type: ShadingType.CLEAR },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: text,
                  size: 18,
                  bold: index === 0, // Código en negrita
                }),
              ],
              alignment: AlignmentType.LEFT,
            }),
          ],
        })
    ),
  });
}

// Función para crear tabla de desarrollos
function createDevTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      createTableHeader(headers),
      ...rows.map((row) => createDevTableRow(row)),
    ],
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
function createSectionTitle(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    text: text,
    heading: level,
    spacing: { before: 400, after: 200 },
    style: "Heading" + (level === HeadingLevel.HEADING_1 ? "1" : "2"),
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
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        run: {
          size: 28,
          bold: true,
          color: "333333",
        },
        paragraph: {
          spacing: { before: 360, after: 180 },
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
                  text: "   KENGO - Informe de Desarrollo",
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
                  text: "Kengo - Plataforma de Fisioterapia | Página ",
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
        new Paragraph({ spacing: { before: 1000 } }),
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
        new Paragraph({ spacing: { before: 400 } }),
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
          spacing: { after: 400 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "INFORME DE DESARROLLO",
              bold: true,
              size: 40,
              color: "333333",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 800, after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Documentación de Funcionalidades",
              size: 28,
              color: "666666",
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Fecha: ${new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}`,
              size: 24,
              color: "999999",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 600 },
        }),
        new Paragraph({
          children: [new PageBreak()],
        }),

        // === ÍNDICE ===
        createSectionTitle("Índice"),
        ...createBulletList([
          "1. Introducción",
          "2. Autenticación y Seguridad",
          "3. Gestión de Usuarios y Roles",
          "4. Catálogo de Ejercicios",
          "5. Planes de Tratamiento",
          "6. Rutinas (Plantillas)",
          "7. Ejecución de Sesiones",
          "8. Actividad Diaria y Seguimiento",
          "9. Gestión de Pacientes",
          "10. Gestión de Clínicas",
          "11. Flujos Principales",
          "12. Stack Tecnológico",
          "13. Desarrollos Pendientes de Despliegue",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 1. INTRODUCCIÓN ===
        createSectionTitle("1. Introducción"),
        createParagraph(
          "Kengo es una plataforma integral de gestión para fisioterapia diseñada para optimizar el flujo de trabajo entre fisioterapeutas y pacientes. La aplicación permite gestionar catálogos de ejercicios, crear y administrar planes de tratamiento personalizados, realizar seguimiento del progreso de los pacientes y administrar múltiples clínicas desde una única interfaz."
        ),
        createParagraph(
          "La plataforma está desarrollada con tecnologías modernas priorizando la experiencia móvil, utilizando Angular 20 como framework principal, Directus CMS como backend y un diseño responsive con Tailwind CSS."
        ),
        new Paragraph({ children: [new PageBreak()] }),

        // === 2. AUTENTICACIÓN Y SEGURIDAD ===
        createSectionTitle("2. Autenticación y Seguridad"),

        createSubsectionTitle("2.1 Métodos de Autenticación"),
        createTable(
          ["Método", "Descripción"],
          [
            ["Email/Contraseña", "Login tradicional con credenciales de usuario"],
            [
              "Magic Link",
              "Autenticación sin contraseña mediante enlace mágico o código QR",
            ],
            [
              "Invitaciones",
              "Aceptación de invitaciones con configuración de contraseña",
            ],
          ]
        ),
        new Paragraph({ spacing: { after: 200 } }),

        createSubsectionTitle("2.2 Gestión de Sesión"),
        ...createBulletList([
          "Sesiones gestionadas mediante cookies httpOnly (seguridad mejorada)",
          "Verificación automática de sesión al navegar entre páginas",
          "Interceptor HTTP que añade credenciales automáticamente a peticiones",
          "Protección de rutas mediante AuthGuard",
        ]),

        createSubsectionTitle("2.3 Protección de Rutas"),
        createParagraph(
          "Todas las rutas sensibles están protegidas por un AuthGuard que verifica la autenticación del usuario, carga los datos necesarios y redirige a la página de login si no existe una sesión válida."
        ),
        new Paragraph({ children: [new PageBreak()] }),

        // === 3. GESTIÓN DE USUARIOS Y ROLES ===
        createSectionTitle("3. Gestión de Usuarios y Roles"),

        createSubsectionTitle("3.1 Roles del Sistema"),
        createTable(
          ["Rol", "Descripción", "Capacidades"],
          [
            [
              "Fisioterapeuta",
              "Profesional sanitario",
              "Crear planes, gestionar pacientes, configurar ejercicios",
            ],
            [
              "Paciente",
              "Usuario que recibe tratamiento",
              "Ejecutar planes asignados, registrar feedback",
            ],
          ]
        ),
        new Paragraph({ spacing: { after: 200 } }),

        createSubsectionTitle("3.2 Sistema Multi-Rol"),
        createParagraph(
          "Los usuarios pueden tener ambos roles simultáneamente, permitiendo cambiar entre modos fisioterapeuta y paciente mediante un toggle. La interfaz y los servicios se adaptan automáticamente al rol activo."
        ),

        createSubsectionTitle("3.3 Perfil de Usuario"),
        createParagraph("Datos gestionables en el perfil:"),
        ...createBulletList([
          "Nombre y apellidos",
          "Email y teléfono de contacto",
          "Avatar/foto de perfil",
          "Dirección y código postal",
          "Cambio de contraseña",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 4. CATÁLOGO DE EJERCICIOS ===
        createSectionTitle("4. Catálogo de Ejercicios"),

        createSubsectionTitle("4.1 Funcionalidades del Catálogo"),
        createTable(
          ["Función", "Descripción"],
          [
            ["Búsqueda", "Filtrado por texto con debounce de 500ms"],
            ["Categorías", "Filtrado múltiple por categorías de ejercicios"],
            ["Ordenación", "Por nombre alfabético (A-Z, Z-A)"],
            ["Paginación", "Configurable, 24 items por defecto"],
            ["Vistas", "Modo grid (viñetas) o lista"],
          ]
        ),
        new Paragraph({ spacing: { after: 200 } }),

        createSubsectionTitle("4.2 Detalle de Ejercicio"),
        createParagraph("Cada ejercicio contiene la siguiente información:"),
        ...createBulletList([
          "Nombre y descripción detallada",
          "Video demostrativo de la ejecución correcta",
          "Imagen de portada",
          "Categorías asociadas",
          "Series y repeticiones por defecto",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 5. PLANES DE TRATAMIENTO ===
        createSectionTitle("5. Planes de Tratamiento"),

        createSubsectionTitle("5.1 Estados del Plan"),
        createTable(
          ["Estado", "Descripción"],
          [
            ["Borrador", "Plan en preparación, no visible para el paciente"],
            ["Activo", "El paciente puede realizar los ejercicios"],
            ["Completado", "Plan finalizado exitosamente"],
            ["Cancelado", "Plan descartado o suspendido"],
          ]
        ),
        new Paragraph({ spacing: { after: 200 } }),

        createSubsectionTitle("5.2 Configuración del Plan"),
        createParagraph("Metadatos configurables:"),
        ...createBulletList([
          "Título descriptivo y descripción detallada",
          "Paciente asignado",
          "Fecha de inicio y fin (opcional)",
          "Fisioterapeuta creador",
        ]),

        createSubsectionTitle("5.3 Configuración por Ejercicio"),
        createTable(
          ["Parámetro", "Descripción", "Valor por defecto"],
          [
            ["Series", "Número de series a realizar", "3"],
            ["Repeticiones", "Repeticiones por serie", "12"],
            ["Duración", "Tiempo si es ejercicio temporizado", "-"],
            ["Descanso", "Tiempo de descanso entre series", "45 segundos"],
            ["Veces/día", "Frecuencia diaria", "1"],
            ["Días/semana", "Días programados", "L, X, V"],
            ["Instrucciones", "Notas para el paciente", "-"],
            ["Notas fisio", "Notas internas del profesional", "-"],
          ]
        ),
        new Paragraph({ spacing: { after: 200 } }),

        createSubsectionTitle("5.4 Plan Builder"),
        createParagraph(
          "Constructor visual de planes con las siguientes características:"
        ),
        ...createBulletList([
          "Carrito de ejercicios: metáfora de compra para añadir ejercicios",
          "Drag & Drop: reordenación intuitiva de ejercicios",
          "Auto-guardado: persistencia automática en localStorage (TTL 7 días)",
          "Restauración: recuperación automática de borradores incompletos",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 6. RUTINAS (PLANTILLAS) ===
        createSectionTitle("6. Rutinas (Plantillas)"),

        createSubsectionTitle("6.1 Concepto"),
        createParagraph(
          "Las rutinas son plantillas reutilizables de ejercicios que pueden aplicarse a múltiples planes, acelerando el proceso de creación de tratamientos similares."
        ),

        createSubsectionTitle("6.2 Visibilidad"),
        createTable(
          ["Tipo", "Descripción"],
          [
            ["Privado", "Solo el autor puede utilizarla"],
            [
              "Público",
              "Disponible para todos los fisioterapeutas de la organización",
            ],
          ]
        ),
        new Paragraph({ spacing: { after: 200 } }),

        createSubsectionTitle("6.3 Operaciones Disponibles"),
        ...createBulletList([
          "Crear rutina desde el plan actual",
          "Cargar rutina como base para nuevo plan",
          "Duplicar rutinas existentes",
          "Editar nombre, descripción y visibilidad",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 7. EJECUCIÓN DE SESIONES ===
        createSectionTitle("7. Ejecución de Sesiones"),

        createSubsectionTitle("7.1 Pantallas de Sesión"),
        createParagraph(
          "El flujo de ejecución de ejercicios sigue la secuencia:"
        ),
        createParagraph(
          "RESUMEN → EJERCICIO ACTIVO → DESCANSO → FEEDBACK FINAL"
        ),
        new Paragraph({ spacing: { after: 100 } }),
        createTable(
          ["Pantalla", "Descripción"],
          [
            ["Resumen", "Vista previa de ejercicios antes de comenzar"],
            [
              "Ejercicio Activo",
              "Video, temporizador/contador e instrucciones",
            ],
            ["Descanso", "Timer de descanso con opción de saltar"],
            ["Feedback Final", "Escala de dolor (0-10) y notas post-ejercicio"],
          ]
        ),
        new Paragraph({ spacing: { after: 200 } }),

        createSubsectionTitle("7.2 Flujo de Ejercicio"),
        ...createBulletList([
          "1. Mostrar ejercicio con video e instrucciones",
          "2. Usuario completa la serie",
          "3. Si hay más series → Descanso → Siguiente serie",
          "4. Si es última serie → Siguiente ejercicio",
          "5. Último ejercicio → Pantalla de feedback final",
          "6. Guardar todos los registros en el servidor",
        ]),

        createSubsectionTitle("7.3 Persistencia de Sesión"),
        ...createBulletList([
          "Auto-guardado en localStorage durante la sesión",
          "TTL de 24 horas para recuperar sesiones interrumpidas",
          "Restauración automática al reabrir la aplicación",
        ]),

        createSubsectionTitle("7.4 Sesiones Multi-Plan"),
        createParagraph(
          "La aplicación permite ejecutar ejercicios de múltiples planes activos en una sola sesión, consolidando el entrenamiento diario del paciente."
        ),
        new Paragraph({ children: [new PageBreak()] }),

        // === 8. ACTIVIDAD DIARIA Y SEGUIMIENTO ===
        createSectionTitle("8. Actividad Diaria y Seguimiento"),

        createSubsectionTitle("8.1 Dashboard de Actividad"),
        createParagraph("Vista del paciente que muestra:"),
        ...createBulletList([
          "Planes activos para el día actual",
          "Ejercicios programados según el día de la semana",
          "Estado de completitud por ejercicio",
          "Progreso general del día (porcentaje)",
        ]),

        createSubsectionTitle("8.2 Indicadores de Estado"),
        createTable(
          ["Badge", "Significado"],
          [
            ["Pending", "Ejercicios pendientes (muestra cantidad)"],
            ["Completed", "Todos los ejercicios completados"],
            ["Rest", "Día de descanso programado"],
            ["Loading", "Cargando datos"],
          ]
        ),
        new Paragraph({ spacing: { after: 200 } }),

        createSubsectionTitle("8.3 Registro de Ejercicios"),
        createParagraph("Cada ejecución de ejercicio registra:"),
        ...createBulletList([
          "Fecha y hora exacta de realización",
          "Repeticiones o duración realizadas",
          "Escala de dolor (0-10)",
          "Notas del paciente",
          "Estado de completitud",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 9. GESTIÓN DE PACIENTES ===
        createSectionTitle("9. Gestión de Pacientes"),

        createSubsectionTitle("9.1 Lista de Pacientes"),
        ...createBulletList([
          "Vista de pacientes asociados al fisioterapeuta",
          "Búsqueda y filtrado por nombre",
          "Acceso rápido a los planes del paciente",
        ]),

        createSubsectionTitle("9.2 Detalle de Paciente"),
        ...createBulletList([
          "Información de contacto completa",
          "Planes asignados (activos, completados, etc.)",
          "Historial de actividad y progreso",
          "Asignación de nuevos planes de tratamiento",
        ]),

        createSubsectionTitle("9.3 Operaciones Disponibles"),
        createTable(
          ["Acción", "Descripción"],
          [
            ["Ver planes", "Listar todos los planes del paciente"],
            ["Crear plan", "Iniciar nuevo plan para el paciente"],
            ["Editar plan", "Modificar un plan existente"],
            ["Cancelar plan", "Marcar plan como cancelado"],
          ]
        ),
        new Paragraph({ children: [new PageBreak()] }),

        // === 10. GESTIÓN DE CLÍNICAS ===
        createSectionTitle("10. Gestión de Clínicas"),

        createSubsectionTitle("10.1 Información de Clínica"),
        createParagraph("Datos gestionables:"),
        ...createBulletList([
          "Nombre y datos de contacto",
          "Dirección y NIF",
          "Logo y color primario (branding corporativo)",
          "Galería de imágenes de la clínica",
        ]),

        createSubsectionTitle("10.2 Sistema Multi-Clínica"),
        ...createBulletList([
          "Un usuario puede pertenecer a múltiples clínicas",
          "Selector de clínica activa",
          "Puestos/roles diferentes según la clínica",
        ]),

        createSubsectionTitle("10.3 Equipo"),
        ...createBulletList([
          "Lista de fisioterapeutas por clínica",
          "Directorio de profesionales",
          "Tarjetas de perfil con información de contacto",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 11. FLUJOS PRINCIPALES ===
        createSectionTitle("11. Flujos Principales"),

        createSubsectionTitle("11.1 Creación de Plan por Fisioterapeuta"),
        ...createBulletList([
          "1. Seleccionar paciente desde /mis-pacientes",
          "2. Navegar al catálogo de ejercicios",
          "3. Añadir ejercicios al carrito",
          "4. Configurar cada ejercicio (series, días, instrucciones)",
          "5. Configurar metadatos del plan (título, fechas)",
          "6. Revisar y enviar",
          "7. Plan creado - el paciente puede comenzar",
        ]),
        createParagraph(
          "Nota: Los borradores se auto-guardan localmente con TTL de 7 días y se recuperan automáticamente."
        ),

        createSubsectionTitle("11.2 Ejecución de Ejercicios por Paciente"),
        ...createBulletList([
          "1. Acceder a /mi-plan",
          "2. Cargar el plan activo del día",
          "3. Ver resumen de ejercicios programados",
          "4. Pulsar 'Comenzar' para iniciar la sesión",
          "5. Ejecutar cada ejercicio con video e instrucciones",
          "6. Completar series con descansos intermedios",
          "7. Proporcionar feedback final (dolor + notas)",
          "8. Guardar registros en el servidor",
        ]),
        createParagraph(
          "Nota: Las sesiones se auto-guardan con TTL de 24 horas para recuperación."
        ),

        createSubsectionTitle("11.3 Seguimiento Diario"),
        ...createBulletList([
          "1. Paciente accede a /actividad-diaria",
          "2. Sistema carga los planes activos",
          "3. Filtra ejercicios según el día de la semana",
          "4. Consulta los registros del día actual",
          "5. Calcula el progreso (completados vs programados)",
          "6. Muestra dashboard con badge de estado y porcentaje",
        ]),

        createSubsectionTitle("11.4 Autenticación Magic Link"),
        ...createBulletList([
          "1. Usuario solicita magic link",
          "2. Sistema genera token único + código QR",
          "3. Usuario escanea QR o abre el enlace",
          "4. Sistema consume el token",
          "5. Sesión establecida sin contraseña",
          "6. Redirección automática a /inicio",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 12. STACK TECNOLÓGICO ===
        createSectionTitle("12. Stack Tecnológico"),

        createTable(
          ["Tecnología", "Uso"],
          [
            ["Angular 20", "Framework principal con standalone components"],
            ["Angular Material 20", "Componentes UI"],
            ["Tailwind CSS 4", "Estilos utility-first, mobile-first"],
            ["Signals", "Gestión de estado reactivo"],
            ["httpResource", "Caché y carga de datos HTTP"],
            ["Directus CMS", "Backend y gestión de contenido"],
            ["Node.js API", "Endpoints personalizados"],
            ["localStorage", "Persistencia de borradores y sesiones"],
          ]
        ),
        new Paragraph({ spacing: { after: 300 } }),

        createSubsectionTitle("Optimizaciones de Rendimiento"),
        ...createBulletList([
          "Lazy Loading: módulos de actividad diaria y ejecución de planes",
          "Debounce: 500ms en búsqueda, 350ms en auto-guardado",
          "Caché HTTP: mediante httpResource de Angular",
          "Paginación: catálogo de ejercicios (24 items/página)",
          "Responsive: detección desktop/móvil con BreakpointObserver",
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // === 13. DESARROLLOS PENDIENTES DE DESPLIEGUE ===
        createSectionTitle("13. Desarrollos Pendientes de Despliegue"),
        createParagraph(
          "A continuación se detallan los desarrollos completados, en curso y pendientes que están preparados para el próximo despliegue a producción."
        ),
        new Paragraph({ spacing: { after: 200 } }),

        createSubsectionTitle("13.1 Resumen de Estado"),
        createTable(
          ["Estado", "Cantidad"],
          [
            ["Completado", "12"],
            ["En curso", "2"],
            ["Pendiente", "3"],
          ]
        ),
        new Paragraph({ spacing: { after: 300 } }),

        createSubsectionTitle("13.2 Detalle de Desarrollos"),
        createParagraph(
          "Leyenda de colores: Verde = Completado | Amarillo = En curso | Rojo = Pendiente"
        ),
        new Paragraph({ spacing: { after: 150 } }),
        createDevTable(
          ["Código", "Título", "Estado", "Comentario"],
          [
            ["KENGO-20", "Tamaño elementos ejercicios rutinas/planes", "Completado", "Se ha reequilibrado los tamaños y distribución de parte de los elementos."],
            ["KENGO-19", "Textos títulos tipografía", "Completado", "Completado, sin embargo hay dudas con lo que se considera título."],
            ["KENGO-18", "Cambiar tipografía textos", "Completado", "Completado."],
            ["KENGO-17", "Escala de dolor", "Completado", "Se muestra solo al final del ejercicio, se pregunta por cada ejercicio separado."],
            ["KENGO-16", "Escala ejercicios", "Completado", "Se ha mejorado el formato responsive para pantallas más grandes."],
            ["KENGO-15", "Vista de pacientes", "Completado", "Completado."],
            ["KENGO-14", "Pestaña actividad escritorio", "Completado", "Se ha mejorado el formato responsive para pantallas más grandes."],
            ["KENGO-13", "Cambiar símbolo pacientes", "Completado", "Se ha puesto un símbolo con corazón."],
            ["KENGO-12", "Pestaña pacientes", "Completado", "Se ha adaptado en multi-columna el contenido para adaptarse a escritorio."],
            ["KENGO-11", "Vista predeterminada ejercicios", "Completado", "Completado."],
            ["KENGO-10", "Textos legales", "Pendiente", "En espera de textos legales."],
            ["KENGO-9", "Número colegiados fisioterapeutas", "Completado", "Se ha implementado con un número de caracteres flexible."],
            ["KENGO-8", "Ejercicios favoritos", "En curso", "Implementación front completada, pendiente modificar base de datos."],
            ["KENGO-7", "Zoom del video", "Pendiente", "En espera de ver resultado con reducción del sombreado inferior."],
            ["KENGO-6", "Apartado descripción de videos", "En curso", "Migrando el campo a formato de texto enriquecido."],
            ["KENGO-5", "Tamaño títulos ejercicios", "Completado", "Se ha reducido ligeramente el tamaño de los títulos."],
            ["KENGO-4", "Fotos secciones inicio", "Pendiente", "En espera de obtener las fotos de inicio."],
            ["KENGO-3", "Difuminado de los videos", "Completado", "Se ha reducido el tamaño del difuminado en la parte inferior."],
          ]
        ),
        new Paragraph({ spacing: { after: 300 } }),

        createSubsectionTitle("13.3 Desarrollos en Curso"),
        createParagraph("Los siguientes desarrollos están actualmente en progreso:"),
        ...createBulletList([
          "KENGO-8: Ejercicios favoritos - Frontend completado, pendiente modificaciones en base de datos.",
          "KENGO-6: Descripción de videos - Migración a formato de texto enriquecido en curso.",
        ]),

        createSubsectionTitle("13.4 Desarrollos Pendientes"),
        createParagraph("Los siguientes desarrollos están bloqueados esperando recursos externos:"),
        ...createBulletList([
          "KENGO-10: Textos legales - Esperando recepción de los textos legales definitivos.",
          "KENGO-7: Zoom del video - Pendiente de validación visual tras cambios en sombreado.",
          "KENGO-4: Fotos secciones inicio - Esperando material gráfico de inicio.",
        ]),

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
              text: `${new Date().toLocaleDateString("es-ES")} - Kengo v0.0.2`,
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
const outputPath = path.join(__dirname, "../INFORME_DESARROLLO_KENGO.docx");

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Documento generado: ${outputPath}`);
});
