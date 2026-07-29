const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4200;

// Directorio de archivos estáticos
const staticDir = path.join(__dirname, '../../dist/apps/app/browser');

// `.well-known` va ANTES del static general y con `dotfiles: 'allow'`.
//
// Con la configuración por defecto (`dotfiles: 'ignore'` en send), cualquier
// segmento de ruta que empiece por punto provoca un 404 interno que, por
// fallthrough, acaba en el fallback SPA de abajo: la petición devuelve
// `index.html` con **200 y Content-Type text/html**. El efecto es que
// `curl -I` responde 200 y aun así la verificación de Android App Links y el
// CDN de Apple fallan, sin ningún error visible. Verificar siempre el body.
const wellKnownDir = path.join(staticDir, '.well-known');

app.use(
  '/.well-known',
  express.static(wellKnownDir, {
    dotfiles: 'allow',
    index: false,
    etag: true,
    // Corto a propósito: si el SHA-256 del keystore o el Team ID salen mal,
    // hay que poder corregirlos sin esperar a que caduque una caché larga.
    maxAge: '5m',
    setHeaders: (res, filePath) => {
      // El AASA se sirve sin extensión, así que `send` lo tiparía como
      // application/octet-stream. Apple exige application/json.
      if (path.basename(filePath) === 'apple-app-site-association') {
        res.setHeader('Content-Type', 'application/json');
      }
    },
  })
);

// Corta el fallthrough: un `.well-known/*` inexistente devuelve un 404 real
// en lugar del index.html, para que un fichero mal nombrado se detecte al
// instante en vez de aparentar que funciona.
app.use('/.well-known', (req, res) => {
  res.status(404).type('text/plain').send('Not found');
});

// Servir archivos estáticos.
// Los JS/CSS llevan hash en el nombre, así que pueden cachearse un año. El
// HTML no: con `max-age=1y` un navegador que hubiera visitado `/index.html`
// se quedaría clavado en la versión antigua y no vería ningún despliegue
// posterior. Mismo criterio que en `apps/landingpage/server.js`.
app.use(express.static(staticDir, {
  maxAge: '1y',
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Health check para Railway
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// SPA fallback - redirigir todas las rutas a index.html (Express 5 syntax)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
});
