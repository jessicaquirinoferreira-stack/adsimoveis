import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { DEFAULT_TENANT_CONFIG, DEFAULT_TENANT_ID } from '../src/data/defaults';
import { getStore } from './store';
import {
  getUploadDir,
  isValidId,
  readJsonBody,
  requireAdminSession,
  resolveRequestRoute,
  sendJson,
} from './shared';
import type { Property } from '../src/types/realEstate';

async function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no ambiente do servidor.');
  }
  const { GoogleGenAI, Type } = await import('@google/genai');
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return { ai, Type };
}

function extractGeminiErrorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : fallback;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; code?: number } };
    if (parsed?.error?.message) {
      if (parsed.error.code === 503) {
        return 'O serviço de inteligência artificial está temporariamente sobrecarregado. Tente novamente em instantes.';
      }
      return parsed.error.message;
    }
  } catch {
    // not JSON
  }
  return raw || fallback;
}

function isTransientGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED')
  );
}

async function generateContentResilient(
  ai: Awaited<ReturnType<typeof getGenAIClient>>['ai'],
  params: Omit<Parameters<typeof ai.models.generateContent>[0], 'model'>
) {
  const models = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
  let lastError: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({
          ...params,
          model,
        });
      } catch (err) {
        lastError = err;
        if (!isTransientGeminiError(err)) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, 450 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

async function resolveImageAsInlinePart(imageUrl: string): Promise<{
  inlineData: { data: string; mimeType: string };
} | null> {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('data:image/')) {
    const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (match) {
      return {
        inlineData: {
          mimeType: match[1],
          data: match[2],
        },
      };
    }
  }
  if (imageUrl.startsWith('/src/assets/')) {
    const resolved = path.resolve(process.cwd(), imageUrl.slice(1));
    const baseDir = path.resolve(process.cwd(), 'src', 'assets');
    if (resolved.startsWith(baseDir + path.sep) && fs.existsSync(resolved)) {
      const buf = fs.readFileSync(resolved);
      const ext = path.extname(resolved).toLowerCase();
      const mimeType =
        ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return {
        inlineData: {
          mimeType,
          data: buf.toString('base64'),
        },
      };
    }
  }
  if (imageUrl.startsWith('/uploads/')) {
    const filename = path.basename(imageUrl);
    const uploadDir = getUploadDir();
    if (uploadDir) {
      const resolved = path.resolve(uploadDir, filename);
      if (resolved.startsWith(uploadDir + path.sep) && fs.existsSync(resolved)) {
        const buf = fs.readFileSync(resolved);
        const ext = path.extname(resolved).toLowerCase();
        const mimeType =
          ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        return {
          inlineData: {
            mimeType,
            data: buf.toString('base64'),
          },
        };
      }
    }
  }
  if (imageUrl.startsWith('https://')) {
    const parsed = new URL(imageUrl);
    if (
      parsed.hostname.endsWith('.public.blob.vercel-storage.com') ||
      parsed.hostname.endsWith('.vercel-storage.com')
    ) {
      const resp = await fetch(imageUrl);
      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        const mimeType = resp.headers.get('content-type') || 'image/jpeg';
        return {
          inlineData: {
            mimeType,
            data: Buffer.from(arrayBuf).toString('base64'),
          },
        };
      }
    }
  }
  return null;
}

export async function handleAiApiRequest(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<boolean> {
  const { pathname, method } = resolveRequestRoute(req);

  if (!pathname.startsWith('/api/')) {
    return false;
  }

  // =========================================================================
  // Vercel Blob & Media Upload
  // =========================================================================
  if (method === 'POST' && pathname === '/api/blob/upload') {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    try {
      const body = await readJsonBody(req);
      const filenameRaw =
        typeof body.filename === 'string' ? body.filename : 'media.jpg';
      const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
      const match = dataUrl.match(
        /^data:((?:image|video)\/[a-zA-Z0-9+.-]+);base64,(.+)$/
      );
      if (!match) {
        sendJson(res, 400, {
          error: 'Formato de mídia inválido. Envie imagem ou vídeo em base64.',
        });
        return true;
      }
      const mimeType = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length > 10 * 1024 * 1024) {
        sendJson(res, 400, { error: 'Arquivo excede o limite de 10 MB.' });
        return true;
      }

      const safeBase =
        filenameRaw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60) || 'asset';
      const uniqueName = `${Date.now()}_${safeBase}`;

      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const { put } = await import('@vercel/blob');
        const blob = await put(`ads-imoveis/${uniqueName}`, buffer, {
          access: 'public',
          contentType: mimeType,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        sendJson(res, 200, { url: blob.url, provider: 'vercel-blob' });
        return true;
      }

      const uploadDir = getUploadDir();
      if (uploadDir) {
        const target = path.resolve(uploadDir, uniqueName);
        if (target.startsWith(uploadDir + path.sep)) {
          fs.writeFileSync(target, buffer);
          sendJson(res, 200, {
            url: `/uploads/${uniqueName}`,
            provider: 'local-storage',
          });
          return true;
        }
      }

      sendJson(res, 200, { url: dataUrl, provider: 'inline-fallback' });
      return true;
    } catch (err) {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Erro ao enviar mídia.',
      });
      return true;
    }
  }

  // =========================================================================
  // Gemini AI Studio Routes
  // =========================================================================
  if (method === 'POST' && pathname === '/api/ai/analyze-photo') {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    try {
      const body = await readJsonBody(req);
      const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl : '';
      const propertyContext =
        typeof body.context === 'string' ? body.context : 'Imóvel em São Paulo';
      const imagePart = await resolveImageAsInlinePart(imageUrl);
      if (!imagePart) {
        sendJson(res, 400, {
          error: 'Imagem não encontrada ou formato não suportado para análise.',
        });
        return true;
      }
      const { ai, Type } = await getGenAIClient();
      const response = await generateContentResilient(ai, {
        contents: {
          parts: [
            imagePart,
            {
              text: `Você é um diretor de fotografia arquitetônica e consultor da corretora A D S Imóveis (CRECI 226079-F, São Paulo). Analise esta foto do imóvel (${propertyContext}) e retorne diagnóstico técnico, recomendações de staging/enquadramento e parâmetros ideais de melhoria visual (brightness entre 0.95 e 1.18, contrast entre 1.0 e 1.22, saturate entre 0.95 e 1.2, warmth entre -10 e 15, sharpness entre 0 e 1).`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              qualityScore: { type: Type.INTEGER },
              roomType: { type: Type.STRING },
              lightingNotes: { type: Type.STRING },
              stagingRecommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              recommendedPreset: { type: Type.STRING },
              enhancementParams: {
                type: Type.OBJECT,
                properties: {
                  brightness: { type: Type.NUMBER },
                  contrast: { type: Type.NUMBER },
                  saturate: { type: Type.NUMBER },
                  warmth: { type: Type.NUMBER },
                  sharpness: { type: Type.NUMBER },
                },
              },
            },
          },
        },
      });
      const parsed = JSON.parse((response.text ?? '{}').trim());
      sendJson(res, 200, parsed);
      return true;
    } catch (err) {
      sendJson(res, 500, {
        error: extractGeminiErrorMessage(
          err,
          'Erro ao analisar foto com Gemini AI.'
        ),
      });
      return true;
    }
  }

  if (method === 'POST' && pathname === '/api/ai/cinematic-director') {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    try {
      const body = await readJsonBody(req);
      const property = body.property as Partial<Property> | undefined;
      if (!property?.title) {
        sendJson(res, 400, { error: 'Dados do imóvel são obrigatórios.' });
        return true;
      }
      const { ai, Type } = await getGenAIClient();
      const response = await generateContentResilient(ai, {
        contents: `Crie um roteiro cinematográfico de apresentação imobiliária para a A D S Imóveis e Intermediações de Negócios (CRECI 226079-F, São Paulo).
Imóvel: ${property.title}
Bairro: ${property.neighborhood}, São Paulo (${property.regionHighlight || ''})
Tipo: ${property.propertyType} | Transação: ${property.transactionType}
Área: ${property.areaSqm} m² | Quartos: ${property.bedrooms} | Vagas: ${property.parkingSpaces} | Mobiliado: ${property.furnished ? 'Sim' : 'Não'}
Diferenciais: ${(property.features || []).join(', ')}
Quantidade de fotos disponíveis: ${(property.images || []).length || 2}
Gere um título de vídeo, gancho inicial, clima musical e de 3 a 4 cenas curtas com legenda na tela (máx 7 palavras), locução comercial realista e direção de movimento de câmera ('zoom-in', 'pan-left', 'pan-right', 'zoom-out').`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              hook: { type: Type.STRING },
              musicMood: { type: Type.STRING },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sceneNumber: { type: Type.INTEGER },
                    caption: { type: Type.STRING },
                    voiceover: { type: Type.STRING },
                    motion: { type: Type.STRING },
                    durationSec: { type: Type.INTEGER },
                  },
                },
              },
            },
          },
        },
      });
      const parsed = JSON.parse((response.text ?? '{}').trim());
      sendJson(res, 200, parsed);
      return true;
    } catch (err) {
      sendJson(res, 500, {
        error: extractGeminiErrorMessage(
          err,
          'Erro ao gerar roteiro cinematográfico.'
        ),
      });
      return true;
    }
  }

  if (method === 'POST' && pathname === '/api/ai/virtual-tour') {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    try {
      const body = await readJsonBody(req);
      const property = body.property as Partial<Property> | undefined;
      if (!property?.title) {
        sendJson(res, 400, { error: 'Dados do imóvel são obrigatórios.' });
        return true;
      }
      const { ai, Type } = await getGenAIClient();
      const imageParts: Array<
        { inlineData: { data: string; mimeType: string } } | { text: string }
      > = [];
      for (const img of (property.images || []).slice(0, 2)) {
        const part = await resolveImageAsInlinePart(img);
        if (part) imageParts.push(part);
      }
      imageParts.push({
        text: `Crie os dados completos de Visita Virtual nas 3 modalidades (Panorâmico 360°, História Guiada e Explorador de Hotspots) para o imóvel "${property.title}" em ${property.neighborhood}, São Paulo, da A D S Imóveis (CRECI 226079-F).
Posicione de 3 a 4 hotspots com coordenadas percentuais x (15 a 85) e y (20 a 80), roomLabel curto, título e descrição realística dos ambientes e localização em São Paulo.`,
      });

      const response = await generateContentResilient(ai, {
        contents: { parts: imageParts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              panoramicSceneTitle: { type: Type.STRING },
              panoramicHighlights: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              chapters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    narration: { type: Type.STRING },
                    cameraHint: { type: Type.STRING },
                    imageIndex: { type: Type.INTEGER },
                    durationSec: { type: Type.INTEGER },
                  },
                },
              },
              hotspots: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    roomLabel: { type: Type.STRING },
                    imageIndex: { type: Type.INTEGER },
                  },
                },
              },
            },
          },
        },
      });
      const parsed = JSON.parse((response.text ?? '{}').trim());
      sendJson(res, 200, parsed);
      return true;
    } catch (err) {
      sendJson(res, 500, {
        error: extractGeminiErrorMessage(err, 'Erro ao gerar Visita Virtual.'),
      });
      return true;
    }
  }

  if (method === 'POST' && pathname === '/api/ai/generate-description') {
    const session = requireAdminSession(req, res);
    if (!session) return true;
    try {
      const body = await readJsonBody(req);
      const property = body.property as Partial<Property> | undefined;
      if (!property?.title) {
        sendJson(res, 400, { error: 'Dados do imóvel são obrigatórios.' });
        return true;
      }
      const { ai, Type } = await getGenAIClient();
      const response = await generateContentResilient(ai, {
        contents: `Escreva textos comerciais profissionais e sem clichês exagerados para a A D S Imóveis e Intermediações de Negócios (CRECI 226079-F), focada em oportunidades reais de venda e locação em São Paulo.
Dados do imóvel:
Título: ${property.title}
Tipo: ${property.propertyType} | Finalidade: ${property.transactionType}
Bairro: ${property.neighborhood} | Referência: ${property.regionHighlight || 'São Paulo'}
Área: ${property.areaSqm} m² | Quartos: ${property.bedrooms} | Suítes: ${property.suites} | Banheiros: ${property.bathrooms} | Vagas: ${property.parkingSpaces}
Mobiliado: ${property.furnished ? 'Sim' : 'Não'} | Lazer Completo: ${property.fullLeisure ? 'Sim' : 'Não'}
Diferenciais: ${(property.features || []).join(', ')}

Não invente telefones, nomes de corretores ou depoimentos. Retorne JSON com subtitle (1 frase), portalDescription (2 a 3 parágrafos refinados), instagramCaption (texto pronto para Instagram com hashtags de São Paulo e menção ao CRECI 226079-F) e seoKeywords.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subtitle: { type: Type.STRING },
              portalDescription: { type: Type.STRING },
              instagramCaption: { type: Type.STRING },
              seoKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
      });
      const parsed = JSON.parse((response.text ?? '{}').trim());
      sendJson(res, 200, parsed);
      return true;
    } catch (err) {
      sendJson(res, 500, {
        error: extractGeminiErrorMessage(
          err,
          'Erro ao gerar descrição comercial.'
        ),
      });
      return true;
    }
  }

  // =========================================================================
  // Public Virtual Assistant Concierge Route
  // =========================================================================
  if (method === 'POST' && pathname === '/api/assistant/chat') {
    const body = await readJsonBody(req);
    const message =
      typeof body.message === 'string' ? body.message.trim().slice(0, 500) : '';
    const tenantId = isValidId(body.tenantId) ? body.tenantId : DEFAULT_TENANT_ID;
    if (!message) {
      sendJson(res, 400, { error: 'Digite sua dúvida para continuar.' });
      return true;
    }

    const store = getStore();
    const tenant =
      store.tenants[tenantId] ||
      store.tenants[DEFAULT_TENANT_ID] ||
      DEFAULT_TENANT_CONFIG;
    const assistantName = tenant.assistantName || 'Sofia';

    try {
      const { ai } = await getGenAIClient();
      const response = await generateContentResilient(ai, {
        contents: `Pergunta do cliente: "${message}"`,
        config: {
          systemInstruction: `Você é ${assistantName}, assistente virtual da ${tenant.companyName} (${tenant.slogan}, CRECI ${tenant.creci}).
Responda em português do Brasil de forma objetiva, acolhedora e simples (máximo 2 a 3 frases curtas).
Fatos oficiais que você conhece:
- Atuação: vendas e locações em ${tenant.city}.
- Regiões principais: ${tenant.regions.join(', ')}.
- Tipos de imóveis: apartamentos residenciais (venda e aluguel), apartamentos mobiliados, lojas e imóveis comerciais, opções com ou sem vaga de garagem e condomínios com lazer completo.
- Nunca invente telefones, endereços, nomes de corretores ou preços específicos que não foram perguntados.
- Sempre convide o cliente a continuar o atendimento pelas redes sociais oficiais (Instagram ou WhatsApp) usando os botões exibidos logo abaixo da sua mensagem.`,
        },
      });
      sendJson(res, 200, {
        reply:
          response.text?.trim() ||
          `Olá! Aqui é a ${assistantName}, da ${tenant.companyName}. Posso te ajudar com vendas e locações em São Paulo — clique abaixo para falar conosco no Instagram ou WhatsApp.`,
      });
      return true;
    } catch (err) {
      sendJson(res, 503, {
        error: extractGeminiErrorMessage(
          err,
          'Assistente temporariamente indisponível.'
        ),
      });
      return true;
    }
  }

  return false;
}
