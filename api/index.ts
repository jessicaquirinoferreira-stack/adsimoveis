import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApiRequest } from '../server/apiHandler';

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  try {
    const handled = await handleApiRequest(req, res);
    if (!handled && !res.headersSent) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Rota API não encontrada.' }));
    }
  } catch (err) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : 'Erro interno no servidor.',
        })
      );
    }
  }
}
