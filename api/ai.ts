import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleAiApiRequest } from '../server/aiHandler';
import { resolveRequestRoute, sendJson } from '../server/shared';

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  try {
    const handled = await handleAiApiRequest(req, res);
    if (!handled && !res.headersSent) {
      sendJson(res, 404, { error: 'Rota de IA não encontrada.' });
    }
  } catch (err) {
    if (!res.headersSent) {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Erro interno no serviço de IA.',
      });
    }
  }
}
