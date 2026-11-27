import { useRef, useState } from 'react';
import { motion, useScroll, useSpring } from 'motion/react';

export function ScrollProgressLine() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 240,
    damping: 32,
    restDelta: 0.001,
  });

  return (
    <motion.div
      style={{ scaleX }}
      className="fixed top-0 left-0 right-0 h-[2px] bg-[var(--accent-color)] origin-left z-50 pointer-events-none"
    />
  );
}

export function SpotlightCard({
  children,
  className = '',
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 50, active: false });

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPos({ x, y, active: true });
  };

  return (
    <div
      ref={cardRef}
      onPointerMove={handleMove}
      onPointerLeave={() => setPos((p) => ({ ...p, active: false }))}
      onClick={onClick}
      className={`relative overflow-hidden ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: pos.active ? 1 : 0,
          background: `radial-gradient(420px circle at ${pos.x}% ${pos.y}%, rgba(140,109,70,0.12), transparent 60%)`,
        }}
      />
      {children}
    </div>
  );
}

export function EditorialMarquee({ items }: { items: string[] }) {
  const line = items.join('  ·  ');
  return (
    <div className="border-y border-[var(--border-color)] bg-[var(--surface-bg)] py-3 overflow-hidden select-none">
      <motion.div
        className="flex whitespace-nowrap gap-10 text-xs tracking-[0.18em] uppercase text-[var(--ink-muted)] font-medium"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ repeat: Infinity, duration: 28, ease: 'linear' }}
      >
        <span>{line}</span>
        <span>{line}</span>
      </motion.div>
    </div>
  );
}
