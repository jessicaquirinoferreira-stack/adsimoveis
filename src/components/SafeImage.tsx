import { useState } from 'react';
import { Building2 } from 'lucide-react';

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  loading?: 'lazy' | 'eager';
}

export function SafeImage({
  src,
  alt,
  className = '',
  fallbackLabel,
  loading = 'lazy',
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-neutral-200 via-neutral-100 to-stone-200 text-neutral-600 p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Building2 className="w-7 h-7 opacity-60" />
        <span className="text-xs font-medium max-w-[220px] truncate">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
