import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleCoreApiRequest } from './coreHandler';
import { handleAiApiRequest } from './aiHandler';
import { resolveRequestRoute, sendJson } from './shared';

export async function handleApiRequest(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<boolean> {
  const { pathname } = resolveRequestRoute(req);
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/uploads/')) {
    return false;
  }

  if (await handleCoreApiRequest(req, res)) {
    return true;
  }

  if (await handleAiApiRequest(req, res)) {
    return true;
  }

  sendJson(res, 404, { error: 'Endpoint não encontrado.' });
  return true;
}
