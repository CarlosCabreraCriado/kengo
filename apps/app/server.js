const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4200;

// Directorio de archivos estáticos
const staticDir = path.join(__dirname, '../../dist/apps/app/browser');

// Servir archivos estáticos
app.use(express.static(staticDir, {
  maxAge: '1y',
  etag: true
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
