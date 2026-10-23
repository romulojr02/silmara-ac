import app, { prepareApp } from '../server/index.mjs';

export default async function handler(req, res) {
  try {
    await prepareApp();
    if (typeof req.url === 'string' && !req.url.startsWith('/api')) {
      req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
    }
    return app(req, res);
  } catch (error) {
    console.error('Falha ao iniciar a API:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Ocorreu um erro interno. Tente novamente.' });
    }
    return undefined;
  }
}
