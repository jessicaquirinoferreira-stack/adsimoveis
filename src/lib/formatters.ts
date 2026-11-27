import type { Property } from '../types/realEstate';

export function formatBRL(value?: number): string {
  if (!value || value <= 0) return 'Sob consulta';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatTransactionLabel(type: Property['transactionType']): string {
  if (type === 'venda') return 'Venda';
  if (type === 'aluguel') return 'Locação';
  return 'Venda ou Locação';
}

export function formatPropertyTypeLabel(type: Property['propertyType']): string {
  const map: Record<Property['propertyType'], string> = {
    apartamento: 'Apartamento',
    comercial: 'Imóvel Comercial',
    casa: 'Casa',
    studio: 'Studio',
    terreno: 'Terreno',
  };
  return map[type] || type;
}

export function formatParkingLabel(spaces: number): string {
  if (spaces === 0) return 'Sem vaga';
  if (spaces === 1) return '1 vaga';
  return `${spaces} vagas`;
}

export function buildWhatsAppLink(whatsappRaw: string, message: string): string | null {
  const digits = whatsappRaw.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const full = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler arquivo local.'));
    reader.readAsDataURL(file);
  });
}
