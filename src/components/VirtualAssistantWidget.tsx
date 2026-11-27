import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, MessageCircle, Send, X } from 'lucide-react';
import type { TenantConfig } from '../types/realEstate';
import { ASSISTANT_AVATAR_IMAGE } from '../data/defaults';
import { apiAssistantChat } from '../lib/storeClient';
import { buildWhatsAppLink } from '../lib/formatters';

interface VirtualAssistantWidgetProps {
  tenant: TenantConfig;
  onNavigate: (path: string) => void;
  onFallbackContact: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'assistant' | 'user';
  text: string;
}

function resolveSimpleLocalReply(
  question: string,
  assistantName: string,
  tenant: TenantConfig
): string | null {
  const q = question.toLowerCase();
  if (q.includes('bairro') || q.includes('regi') || q.includes('onde')) {
    return `Atuamos em São Paulo com foco no ${tenant.regions.join(', ')} e proximidades do Metrô Alto do Ipiranga e Terminal Sacomã. Posso te direcionar para o nosso Instagram ou atendimento direto agora mesmo!`;
  }
  if (q.includes('alug') || q.includes('loca')) {
    return `Temos apartamentos residenciais, unidades mobiliadas e imóveis comerciais para locação em São Paulo. Veja as opções no catálogo ou clique abaixo para falar direto pelo WhatsApp ou Instagram.`;
  }
  if (q.includes('compr') || q.includes('vend')) {
    return `A ${tenant.companyName} (CRECI ${tenant.creci}) trabalha com vendas de apartamentos e lojas comerciais em São Paulo. Vamos conversar pelas nossas redes sociais oficiais para selecionar opções para você?`;
  }
  if (q.includes('mobiliad')) {
    return `Sim! Trabalhamos com apartamentos mobiliados prontos para morar, especialmente próximos ao Alto do Ipiranga. Clique abaixo para acompanhar as novidades no Instagram ou solicitar atendimento.`;
  }
  if (q.includes('comercial') || q.includes('loja')) {
    return `Temos opções de lojas e imóveis comerciais em regiões estratégicas de São Paulo. Posso te levar diretamente para o nosso Instagram ou WhatsApp para envio das opções!`;
  }
  if (q.includes('creci') || q.includes('segur') || q.includes('confi')) {
    return `A ${tenant.companyName} atua regularmente com CRECI ${tenant.creci}. Acompanhe nossas oportunidades reais no Instagram oficial ou fale conosco pelo formulário/WhatsApp.`;
  }
  if (q.includes('rede') || q.includes('insta') || q.includes('whats')) {
    return `Aqui estão os atalhos diretos para o Instagram oficial e para o nosso atendimento! Será um prazer continuar por lá.`;
  }
  void assistantName;
  return null;
}

export function VirtualAssistantWidget({
  tenant,
  onNavigate,
  onFallbackContact,
}: VirtualAssistantWidgetProps) {
  const assistantName = tenant.assistantName || 'Sofia';
  const assistantRole = tenant.assistantRole || 'Assistente Virtual';
  const avatarUrl = tenant.assistantAvatarUrl || ASSISTANT_AVATAR_IMAGE;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Olá! Eu sou a ${assistantName}, ${assistantRole.toLowerCase()} da ${tenant.companyName} (CRECI ${tenant.creci}). Posso responder dúvidas rápidas sobre vendas, locações em São Paulo e levar você às nossas redes sociais.`,
    },
  ]);

  const listRef = useRef<HTMLDivElement>(null);

  const whatsappUrl = buildWhatsAppLink(
    tenant.whatsapp,
    `Olá! Conversei com a ${assistantName} no site da ${tenant.companyName} e quero atendimento.`
  );
  const instagramUrl =
    tenant.instagramUrl || 'https://www.instagram.com/ads.imoveiseintermediacaodeneg/';

  const scrollToBottom = () => {
    window.setTimeout(() => {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 60);
  };

  const handleAsk = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    scrollToBottom();

    const quick = resolveSimpleLocalReply(trimmed, assistantName, tenant);
    if (quick) {
      setMessages((prev) => [
        ...prev,
        { id: `a_${Date.now()}`, sender: 'assistant', text: quick },
      ]);
      scrollToBottom();
      return;
    }

    setLoading(true);
    try {
      const { reply } = await apiAssistantChat(tenant.tenantId, trimmed);
      setMessages((prev) => [
        ...prev,
        { id: `a_${Date.now()}`, sender: 'assistant', text: reply },
      ]);
    } catch (err) {
      const errMsg =
        err instanceof Error && err.message
          ? err.message
          : 'Não foi possível consultar a assistente neste momento.';
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          sender: 'assistant',
          text: `${errMsg} Enquanto isso, clique abaixo para falar direto conosco pelo Instagram ou atendimento.`,
        },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const quickTopics = [
    'Quais bairros atendem?',
    'Imóveis mobiliados',
    'Lojas comerciais',
    'Falar nas redes sociais',
  ];

  return (
    <div className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-40">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mb-3 w-[336px] max-w-[calc(100vw-2rem)] bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Assistant Header */}
            <div className="p-4 border-b border-[var(--border-color)] bg-[var(--canvas-bg)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={avatarUrl}
                  alt={assistantName}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-full object-cover border border-[var(--border-color)] shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-[var(--ink-primary)] leading-tight truncate">
                    {assistantName}
                  </p>
                  <p className="text-[11px] text-[var(--ink-muted)] truncate">
                    {assistantRole} · A D S Imóveis
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar assistente"
                className="p-1.5 rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-bg)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={listRef}
              className="p-4 space-y-3 max-h-[260px] overflow-y-auto text-xs leading-relaxed"
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${
                    m.sender === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-xl ${
                      m.sender === 'user'
                        ? 'bg-[var(--accent-color)] text-[var(--accent-text)]'
                        : 'bg-[var(--canvas-bg)] border border-[var(--border-color)] text-[var(--ink-primary)]'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="text-[11px] text-[var(--ink-muted)] px-1">
                  {assistantName} está respondendo...
                </div>
              )}
            </div>

            {/* Quick FAQ Prompts */}
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {quickTopics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => void handleAsk(topic)}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-[var(--border-color)] bg-[var(--canvas-bg)] text-[var(--ink-primary)] hover:border-[var(--accent-color)] transition-colors"
                >
                  {topic}
                </button>
              ))}
            </div>

            {/* Social Network Handoff Buttons */}
            <div className="px-4 py-2.5 border-t border-[var(--border-color)] bg-[var(--canvas-bg)] grid grid-cols-2 gap-2">
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 text-[11px] font-medium rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--ink-primary)] hover:border-[var(--accent-color)] transition-colors whitespace-nowrap"
              >
                <span>Instagram</span>
                <ArrowUpRight className="w-3 h-3" />
              </a>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 text-[11px] font-medium rounded-lg bg-[#25D366] text-white hover:opacity-95 transition-opacity whitespace-nowrap"
                >
                  <span>WhatsApp</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onFallbackContact();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 text-[11px] font-medium rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)] whitespace-nowrap"
                >
                  <span>Atendimento</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleAsk(input);
              }}
              className="p-3 border-t border-[var(--border-color)] flex items-center gap-2 bg-[var(--surface-bg)]"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Pergunte algo para ${assistantName}...`}
                className="flex-1 h-9 px-3 text-xs bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-[var(--accent-color)]"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Enviar mensagem"
                className="h-9 w-9 rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)] flex items-center justify-center disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="px-4 py-2 border-t border-[var(--border-color)] bg-[var(--canvas-bg)] flex items-center justify-between text-[11px] text-[var(--ink-muted)]">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onNavigate('/imoveis');
                }}
                className="underline hover:text-[var(--ink-primary)]"
              >
                Ver catálogo completo
              </button>
              <span>CRECI {tenant.creci}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Humanized Launcher Button (Bottom-Left) */}
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.03, y: -1 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        aria-label={`Conversar com ${assistantName}, ${assistantRole}`}
        className="flex items-center gap-2.5 pr-4 pl-1.5 py-1.5 rounded-full bg-[var(--surface-bg)] border border-[var(--border-color)] shadow-lg hover:shadow-xl transition-shadow"
      >
        <img
          src={avatarUrl}
          alt={assistantName}
          referrerPolicy="no-referrer"
          className="w-10 h-10 rounded-full object-cover border border-[var(--border-color)] shrink-0"
        />
        <div className="text-left leading-tight hidden sm:block">
          <p className="text-xs font-semibold text-[var(--ink-primary)] whitespace-nowrap">
            {assistantName}
          </p>
          <p className="text-[11px] text-[var(--ink-muted)] whitespace-nowrap">
            {assistantRole}
          </p>
        </div>
        <MessageCircle className="w-4 h-4 text-[var(--accent-color)] shrink-0 sm:ml-1" />
      </motion.button>
    </div>
  );
}
