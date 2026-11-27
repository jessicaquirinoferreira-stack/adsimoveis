import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApiRequest } from './apiHandler';
import { sendJson } from './shared';

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  try {
    const handled = await handleApiRequest(req, res);
    if (!handled && !res.headersSent) {
      sendJson(res, 404, { error: 'Rota API não encontrada.' });
    }
  } catch (err) {
    if (!res.headersSent) {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Erro interno no servidor.',
      });
    }
  }
}
