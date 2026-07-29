const express = require('express');
const path = require('path');
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
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Web landing server running on port ${PORT}`);
});
