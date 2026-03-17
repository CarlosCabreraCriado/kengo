const API_PORT = process.env.KENGO_PORT_API || '4201';

module.exports = {
  '/directus': {
    target: 'https://admin.kengoapp.com',
    secure: true,
    changeOrigin: true,
    pathRewrite: { '^/directus': '' },
    cookieDomainRewrite: '',
  },
  '/api': {
    target: `http://localhost:${API_PORT}`,
    secure: false,
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
  },
};
