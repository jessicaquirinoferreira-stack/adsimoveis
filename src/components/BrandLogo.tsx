import { useState } from 'react';
import { OFFICIAL_LOGO_LOCAL, OFFICIAL_LOGO_URL } from '../data/defaults';

interface BrandLogoProps {
  src?: string;
  alt?: string;
  className?: string;
  tone?: 'on-light' | 'on-dark';
}

export function BrandLogo({
  src,
  alt = 'A D S Imóveis e Intermediações de Negócios',
  className = 'h-16 w-auto',
  tone = 'on-light',
}: BrandLogoProps) {
  const initialSrc = src?.trim() || OFFICIAL_LOGO_URL;
  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [prevPropSrc, setPrevPropSrc] = useState(initialSrc);

  if (initialSrc !== prevPropSrc) {
    setPrevPropSrc(initialSrc);
    setCurrentSrc(initialSrc);
  }

  const filterClass =
    tone === 'on-dark'
      ? '[filter:drop-shadow(0_0_10px_rgba(255,255,255,0.92))_drop-shadow(0_2px_16px_rgba(255,255,255,0.45))]'
      : '[filter:drop-shadow(0_2px_6px_rgba(40,12,72,0.12))]';

  return (
    <img
      src={currentSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => {
        if (currentSrc !== OFFICIAL_LOGO_LOCAL) {
          setCurrentSrc(OFFICIAL_LOGO_LOCAL);
        }
      }}
      className={`bg-transparent object-contain select-none ${filterClass} ${className}`}
    />
  );
}
