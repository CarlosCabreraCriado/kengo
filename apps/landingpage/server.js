const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 4202;

// Directorio de archivos estáticos
const staticDir = path.join(__dirname, '../../dist/apps/landingpage/browser');

// Compresión gzip/brotli negociada vía Accept-Encoding
app.use(compression());

// Servir archivos estáticos.
// Los JS/CSS llevan hash (outputHashing: all) → cache inmutable de 1 año.
// Ojo: los archivos de public/assets NO llevan hash; si se reemplaza uno hay que renombrarlo.
app.use(express.static(staticDir, {
  maxAge: '1y',
  immutable: true,
  index: false,
  etag: true,
  // Sin esto, una ruta que coincide con un directorio del build
  // (`/legal/privacidad` ↔ `browser/legal/privacidad/`) devuelve un 301 hacia
  // la misma URL con barra final. Funciona, pero mete un salto extra en URLs
  // que se publican en App Store Connect y Play Console; mejor servirlas
  // directas desde el handler de abajo.
  redirect: false,
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

// Rutas prerenderizadas + SPA fallback (Express 5 syntax).
//
// Con `outputMode: "static"` cada ruta se emite como `<ruta>/index.html`
// (p. ej. `browser/legal/privacidad/index.html`). Como `express.static` va
// con `index: false`, esos ficheros NO se sirven solos y la petición caía
// aquí, devolviendo el index.html de la portada: el visitante —y el revisor
// de App Store— veía la home en lugar de la política de privacidad.
//
// Por eso se busca primero el index prerenderizado de la ruta concreta y solo
// se recurre al fallback cuando no existe.
app.get('/{*splat}', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');

  // `path.join` normaliza los `..`; comprobamos que el resultado siga dentro
  // de staticDir para que una ruta manipulada no pueda leer fuera del build.
  const prerendered = path.join(staticDir, req.path, 'index.html');
  if (
    (prerendered === staticDir || prerendered.startsWith(staticDir + path.sep)) &&
    fs.existsSync(prerendered)
  ) {
    return res.sendFile(prerendered);
  }

  res.sendFile(path.join(staticDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Web landing server running on port ${PORT}`);
});
