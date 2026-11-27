import { useState } from 'react';
import { CheckCircle2, MessageSquare } from 'lucide-react';
import type { LeadInterestType, TenantConfig } from '../types/realEstate';
import { apiCreateLead } from '../lib/storeClient';
import { syncLeadToFirestore } from '../lib/firebase';
import { buildWhatsAppLink } from '../lib/formatters';

interface LeadFormProps {
  tenant: TenantConfig;
  propertyId?: string;
  propertyTitle?: string;
  defaultInterest?: LeadInterestType;
  sourcePage?: string;
  heading?: string;
  subheading?: string;
}

export function LeadForm({
  tenant,
  propertyId = '',
  propertyTitle = '',
  defaultInterest = 'visita',
  sourcePage = '/',
  heading = 'Solicite atendimento ou agende uma visita',
  subheading = 'Atendimento consultivo pela A D S Imóveis e Intermediações de Negócios (CRECI 226079-F) em São Paulo.',
}: LeadFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [interestType, setInterestType] = useState<LeadInterestType>(defaultInterest);
  const [message, setMessage] = useState(
    propertyTitle
      ? `Olá, gostaria de receber mais informações sobre o imóvel: ${propertyTitle}.`
      : ''
  );
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const whatsappUrl = buildWhatsAppLink(
    tenant.whatsapp,
    propertyTitle
      ? `Olá, tenho interesse no imóvel "${propertyTitle}" visto no site da ${tenant.companyName}.`
      : `Olá, gostaria de atendimento imobiliário em São Paulo com a ${tenant.companyName}.`
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) {
      setError('Por favor, informe seu nome completo.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 8) {
      setError('Por favor, informe um telefone ou WhatsApp válido com DDD.');
      return;
    }
    if (!lgpdConsent) {
      setError('Para enviar seus dados, confirme a concordância com a política de privacidade (LGPD).');
      return;
    }

    setSubmitting(true);
    try {
      const { lead } = await apiCreateLead({
        tenantId: tenant.tenantId,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        message: message.trim(),
        interestType,
        propertyId,
        propertyTitle,
        sourcePage,
        lgpdConsent: true,
      });
      await syncLeadToFirestore(lead);
      setSubmitted(true);
      setName('');
      setPhone('');
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar solicitação.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-[var(--radius-card)] p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3 text-emerald-700">
          <CheckCircle2 className="w-6 h-6 shrink-0" />
          <h3 className="font-display text-2xl font-semibold text-[var(--ink-primary)]">
            Solicitação registrada com sucesso
          </h3>
        </div>
        <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
          Seus dados foram encaminhados para a equipe da {tenant.companyName} (CRECI{' '}
          {tenant.creci}). Retornaremos o atendimento pelo canal informado.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="px-4 py-2 text-xs font-medium border border-[var(--border-color)] rounded-[var(--radius-btn)] text-[var(--ink-primary)] hover:bg-[var(--canvas-bg)] transition-colors"
          >
            Enviar nova mensagem
          </button>
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-[var(--radius-btn)] bg-[var(--accent-color)] text-[var(--accent-text)] hover:opacity-90 transition-opacity"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Continuar no WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-[var(--radius-card)] p-6 sm:p-8 space-y-5"
    >
      <div>
        <h3 className="font-display text-2xl font-semibold text-[var(--ink-primary)]">
          {heading}
        </h3>
        <p className="text-sm text-[var(--ink-muted)] mt-1 leading-relaxed">
          {subheading}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--ink-primary)]">
            Nome completo *
          </span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            className="w-full px-3.5 py-2.5 text-sm bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-[var(--radius-btn)] text-[var(--ink-primary)] focus:outline-none focus:border-[var(--accent-color)]"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--ink-primary)]">
            Telefone / WhatsApp *
          </span>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 00000-0000"
            className="w-full px-3.5 py-2.5 text-sm bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-[var(--radius-btn)] text-[var(--ink-primary)] focus:outline-none focus:border-[var(--accent-color)]"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--ink-primary)]">
            E-mail
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            className="w-full px-3.5 py-2.5 text-sm bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-[var(--radius-btn)] text-[var(--ink-primary)] focus:outline-none focus:border-[var(--accent-color)]"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--ink-primary)]">
            Finalidade
          </span>
          <select
            value={interestType}
            onChange={(e) => setInterestType(e.target.value as LeadInterestType)}
            className="w-full px-3.5 py-2.5 text-sm bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-[var(--radius-btn)] text-[var(--ink-primary)] focus:outline-none focus:border-[var(--accent-color)]"
          >
            <option value="visita">Agendar visita</option>
            <option value="venda">Compra de imóvel</option>
            <option value="aluguel">Locação residencial</option>
            <option value="comercial">Imóvel comercial</option>
            <option value="avaliacao">Anunciar meu imóvel</option>
          </select>
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-[var(--ink-primary)]">
          Mensagem ou preferência de horário
        </span>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Conte o tipo de imóvel, região de São Paulo ou horário preferido..."
          className="w-full px-3.5 py-2.5 text-sm bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-[var(--radius-btn)] text-[var(--ink-primary)] focus:outline-none focus:border-[var(--accent-color)]"
        />
      </label>

      <label className="flex items-start gap-2.5 text-xs text-[var(--ink-muted)] cursor-pointer">
        <input
          type="checkbox"
          checked={lgpdConsent}
          onChange={(e) => setLgpdConsent(e.target.checked)}
          className="mt-0.5 accent-[var(--accent-color)]"
        />
        <span>
          Autorizo o tratamento dos meus dados exclusivamente para retorno de atendimento
          imobiliário pela {tenant.companyName}, conforme a LGPD (Lei nº 13.709/2018).
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-3 text-sm font-medium rounded-[var(--radius-btn)] bg-[var(--accent-color)] text-[var(--accent-text)] hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {submitting ? 'Enviando solicitação...' : 'Solicitar atendimento'}
        </button>

        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-[var(--radius-btn)] border border-[var(--border-color)] text-[var(--ink-primary)] hover:bg-[var(--canvas-bg)] transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Atendimento via WhatsApp
          </a>
        )}
      </div>
    </form>
  );
}
