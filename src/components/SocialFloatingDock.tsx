import { motion } from 'motion/react';
import type { TenantConfig } from '../types/realEstate';
import { buildWhatsAppLink } from '../lib/formatters';

interface SocialFloatingDockProps {
  tenant: TenantConfig;
  onFallbackContact: () => void;
}

export function SocialFloatingDock({
  tenant,
  onFallbackContact,
}: SocialFloatingDockProps) {
  const whatsappUrl = buildWhatsAppLink(
    tenant.whatsapp,
    `Olá! Vim pelo site da ${tenant.companyName} e gostaria de atendimento.`
  );
  const instagramUrl =
    tenant.instagramUrl || 'https://www.instagram.com/ads.imoveiseintermediacaodeneg/';

  return (
    <aside
      aria-label="Canais oficiais nas redes sociais"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-2.5"
    >
      {/* Official Instagram Button */}
      <motion.a
        href={instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram oficial da A D S Imóveis"
        whileHover={{ scale: 1.07, y: -2 }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="group relative w-12 h-12 rounded-full shadow-lg flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500"
        style={{
          background:
            'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)',
        }}
      >
        <span className="hidden sm:block pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute right-14 px-2.5 py-1 rounded-md bg-neutral-900 text-white text-xs font-medium whitespace-nowrap shadow-md">
          Instagram Oficial
        </span>
        {/* Official Instagram Glyph SVG */}
        <svg
          viewBox="0 0 24 24"
          className="w-6 h-6 text-white fill-none stroke-current"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      </motion.a>

      {/* Official WhatsApp Button */}
      {whatsappUrl ? (
        <motion.a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp oficial da A D S Imóveis"
          whileHover={{ scale: 1.07, y: -2 }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="group relative w-12 h-12 rounded-full bg-[#25D366] text-white shadow-lg flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
        >
          <span className="hidden sm:block pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute right-14 px-2.5 py-1 rounded-md bg-neutral-900 text-white text-xs font-medium whitespace-nowrap shadow-md">
            WhatsApp Oficial
          </span>
          <WhatsAppOfficialGlyph />
        </motion.a>
      ) : (
        <motion.button
          type="button"
          onClick={onFallbackContact}
          aria-label="WhatsApp e Atendimento Oficial"
          whileHover={{ scale: 1.07, y: -2 }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="group relative w-12 h-12 rounded-full bg-[#25D366] text-white shadow-lg flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
        >
          <span className="hidden sm:block pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute right-14 px-2.5 py-1 rounded-md bg-neutral-900 text-white text-xs font-medium whitespace-nowrap shadow-md">
            Atendimento WhatsApp
          </span>
          <WhatsAppOfficialGlyph />
        </motion.button>
      )}
    </aside>
  );
}

export function WhatsAppOfficialGlyph({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={`${className} fill-current`}
      aria-hidden="true"
    >
      <path d="M16.004 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.26.59 4.46 1.71 6.4L3.1 29l6.77-1.78c1.87 1.02 3.97 1.56 6.13 1.56h.01c7.06 0 12.8-5.74 12.8-12.8 0-3.42-1.33-6.64-3.75-9.05A12.71 12.71 0 0 0 16.004 3.2zm7.46 18.21c-.31.88-1.82 1.68-2.51 1.78-.64.1-1.45.14-2.34-.15-.54-.17-1.23-.4-2.12-.78-3.73-1.61-6.17-5.37-6.36-5.62-.19-.25-1.52-2.02-1.52-3.86s.96-2.74 1.3-3.11c.34-.37.75-.46 1-.46.25 0 .5 0 .72.01.23.01.54-.09.84.64.31.75 1.06 2.58 1.15 2.77.09.19.15.41.03.66-.12.25-.19.41-.37.63-.19.22-.39.49-.56.66-.19.19-.38.39-.16.76.22.37.98 1.61 2.1 2.61 1.44 1.29 2.66 1.69 3.03 1.88.37.19.59.16.81-.1.22-.25.94-1.09 1.19-1.47.25-.37.5-.31.84-.19.34.12 2.18 1.03 2.55 1.22.37.19.62.28.71.44.09.16.09.9-.22 1.78z" />
    </svg>
  );
}
