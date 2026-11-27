import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { TenantConfig } from '../types/realEstate';

interface CinematicIntroProps {
  tenant: TenantConfig;
  onComplete: () => void;
}

export function CinematicIntro({ tenant, onComplete }: CinematicIntroProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const [exiting, setExiting] = useState(false);

  const handleSkip = () => {
    if (exiting) return;
    setExiting(true);
    if (overlayRef.current) {
      gsap.killTweensOf(overlayRef.current);
      gsap.to(overlayRef.current, {
        opacity: 0,
        duration: 0.18,
        ease: 'power2.out',
        onComplete: () => onCompleteRef.current(),
      });
    } else {
      onCompleteRef.current();
    }
  };

  // Ambient architectural dust & twilight light-mote particle canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    let animId = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 48 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 0.7 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 0.28,
      vy: -0.12 - Math.random() * 0.25,
      alpha: 0.12 + Math.random() * 0.4,
      warm: Math.random() > 0.35,
    }));

    const render = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) p.y = window.innerHeight + 10;
        if (p.x < -10) p.x = window.innerWidth + 10;
        if (p.x > window.innerWidth + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.warm
          ? `rgba(226, 198, 142, ${p.alpha})`
          : `rgba(196, 168, 232, ${p.alpha * 0.85})`;
        ctx.fill();
      }
      animId = window.requestAnimationFrame(render);
    };
    animId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Precision 7.0-second GSAP architectural drawing & title choreography
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      onCompleteRef.current();
      return;
    }

    const overlay = overlayRef.current;
    const svg = svgRef.current;
    if (!overlay || !svg) return;

    // Prepare every SVG stroke with exact path lengths for realistic drafting draw-in
    const strokes = Array.from(svg.querySelectorAll<SVGGeometryElement>('.arch-draw'));
    const horizonStrokes = Array.from(
      svg.querySelectorAll<SVGGeometryElement>('.arch-horizon')
    );
    const fineStrokes = Array.from(svg.querySelectorAll<SVGGeometryElement>('.arch-fine'));
    const blueprintGuides = Array.from(
      svg.querySelectorAll<SVGGeometryElement>('.arch-guide')
    );

    const prepStroke = (el: SVGGeometryElement) => {
      const len = typeof el.getTotalLength === 'function' ? el.getTotalLength() : 240;
      el.style.strokeDasharray = `${len}`;
      el.style.strokeDashoffset = `${len}`;
    };

    [...strokes, ...horizonStrokes, ...fineStrokes, ...blueprintGuides].forEach(prepStroke);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          onCompleteRef.current();
        },
      });

      // Continuous 7.0s timeline progress bar at bottom edge
      if (progressBarRef.current) {
        tl.fromTo(
          progressBarRef.current,
          { scaleX: 0 },
          { scaleX: 1, duration: 7.0, ease: 'none' },
          0
        );
      }

      // 0.00s - 0.90s: Horizon perspective & blueprint reference guides sketch in
      tl.to(
        horizonStrokes,
        {
          strokeDashoffset: 0,
          duration: 1.0,
          stagger: 0.08,
          ease: 'power2.inOut',
        },
        0.1
      );

      tl.to(
        blueprintGuides,
        {
          strokeDashoffset: 0,
          opacity: 0.55,
          duration: 0.9,
          stagger: 0.06,
          ease: 'power2.out',
        },
        0.25
      );

      // 0.55s - 2.95s: Main contemporary residence elevation draws line by line
      tl.to(
        strokes,
        {
          strokeDashoffset: 0,
          duration: 2.25,
          stagger: 0.09,
          ease: 'power2.inOut',
        },
        0.55
      );

      // 1.75s - 3.35s: Glass mullions, louvers, interior mullions, landscape scale
      tl.to(
        fineStrokes,
        {
          strokeDashoffset: 0,
          duration: 1.5,
          stagger: 0.04,
          ease: 'power1.inOut',
        },
        1.75
      );

      // 2.65s - 4.10s: Realistic architectural glass, warm interior glow & volumetric light
      tl.fromTo(
        '.arch-fill-glass',
        { opacity: 0 },
        { opacity: 1, duration: 1.25, stagger: 0.1, ease: 'power2.out' },
        2.65
      );

      tl.fromTo(
        '.arch-fill-warm',
        { opacity: 0 },
        { opacity: 1, duration: 1.35, stagger: 0.12, ease: 'power2.out' },
        2.85
      );

      tl.fromTo(
        '.arch-ambient-glow',
        { opacity: 0, scale: 0.94 },
        { opacity: 1, scale: 1, duration: 1.5, ease: 'power2.out' },
        2.9
      );

      // Subtle fade-down of drafting construction guides as realism settles
      tl.to(
        blueprintGuides,
        {
          opacity: 0.14,
          duration: 1.0,
          ease: 'power1.out',
        },
        3.2
      );

      // Diagonal cinema light sweep across the residence
      tl.fromTo(
        '.arch-light-sweep',
        { attr: { x: 20 }, opacity: 0 },
        { attr: { x: 780 }, opacity: 0.9, duration: 1.55, ease: 'power2.inOut' },
        3.25
      );

      // 3.55s - 5.10s: Grand, free, unboxed site name reveal
      tl.fromTo(
        '.intro-brand-kicker',
        { y: 14, opacity: 0, letterSpacing: '0.45em' },
        { y: 0, opacity: 1, letterSpacing: '0.28em', duration: 0.85, ease: 'power3.out' },
        3.55
      );

      tl.fromTo(
        '.intro-brand-title',
        { y: 24, opacity: 0, clipPath: 'inset(0 0 100% 0)' },
        {
          y: 0,
          opacity: 1,
          clipPath: 'inset(0 0 0% 0)',
          duration: 1.15,
          ease: 'power3.out',
        },
        3.75
      );

      tl.fromTo(
        '.intro-brand-divider',
        { scaleX: 0, opacity: 0 },
        { scaleX: 1, opacity: 1, duration: 0.95, ease: 'power2.out' },
        4.15
      );

      tl.fromTo(
        '.intro-brand-sub',
        { y: 12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.85, stagger: 0.12, ease: 'power2.out' },
        4.35
      );

      // 4.80s - 6.15s: Gentle cinematic camera drift forward on entire free composition
      tl.to(
        '.intro-stage',
        {
          scale: 1.025,
          duration: 2.1,
          ease: 'power1.inOut',
        },
        4.6
      );

      // 6.20s - 7.00s: Smooth dissolve directly into the live hero at exactly 7.00s
      tl.to(
        overlay,
        {
          opacity: 0,
          duration: 0.8,
          ease: 'power2.inOut',
        },
        6.2
      );
    }, overlayRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-label={`Abertura cinematográfica — ${tenant.companyName}`}
      className="fixed inset-0 z-50 overflow-hidden bg-[#08070B] text-white flex flex-col items-center justify-center select-none"
    >
      {/* Open atmospheric gradient backdrop — zero box/circle/frame */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 42%, rgba(92, 54, 145, 0.20) 0%, rgba(168, 128, 72, 0.08) 42%, rgba(8, 7, 11, 0.98) 82%)',
        }}
      />

      {/* Ambient dust / light motes canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-full h-full"
      />

      {/* Free, expansive open stage (no box, no circle, no square container) */}
      <div className="intro-stage relative z-10 w-full max-w-6xl px-4 sm:px-8 flex flex-col items-center justify-center">
        {/* Soft architectural illumination behind house elevation */}
        <div
          aria-hidden="true"
          className="arch-ambient-glow pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 w-[min(92vw,860px)] h-64 opacity-0"
          style={{
            background:
              'radial-gradient(ellipse 68% 60% at 50% 58%, rgba(236, 184, 108, 0.24) 0%, rgba(154, 96, 224, 0.14) 48%, transparent 78%)',
          }}
        />

        {/* Large, Open Architectural Residence Elevation SVG */}
        <div className="relative w-full max-w-[920px] overflow-visible">
          <svg
            ref={svgRef}
            viewBox="0 0 960 350"
            className="w-full h-auto overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="introGoldInk" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#E6C994" />
                <stop offset="50%" stopColor="#FFF4DC" />
                <stop offset="100%" stopColor="#C49AF0" />
              </linearGradient>

              <linearGradient id="introGlassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(196, 178, 240, 0.24)" />
                <stop offset="55%" stopColor="rgba(248, 214, 152, 0.28)" />
                <stop offset="100%" stopColor="rgba(28, 22, 42, 0.45)" />
              </linearGradient>

              <linearGradient id="introWarmGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(255, 224, 158, 0.58)" />
                <stop offset="100%" stopColor="rgba(204, 134, 62, 0.16)" />
              </linearGradient>

              <linearGradient id="introRoofFill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(136, 92, 198, 0.20)" />
                <stop offset="100%" stopColor="rgba(24, 20, 34, 0.42)" />
              </linearGradient>

              <linearGradient id="introSweepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="50%" stopColor="rgba(255, 246, 220, 0.24)" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>

              <clipPath id="houseBodyClip">
                <path d="M 225 190 L 225 112 L 352 112 L 480 42 L 608 112 L 735 112 L 735 190 L 820 190 L 820 292 L 155 292 L 155 215 L 225 215 Z" />
              </clipPath>
            </defs>

            {/* Distant São Paulo Skyline Contour (Open, free background depth) */}
            <path
              className="arch-guide"
              d="M 60 292 L 60 220 L 92 220 L 92 252 L 118 252 L 118 168 L 156 168 L 156 292 M 775 292 L 775 152 L 818 152 L 818 188 L 848 188 L 848 122 L 892 122 L 892 292"
              fill="none"
              stroke="rgba(196, 174, 232, 0.42)"
              strokeWidth="1.1"
              opacity="0"
            />

            {/* Drafting Dimension & Perspective Guides */}
            <line
              className="arch-guide"
              x1="480"
              y1="20"
              x2="480"
              y2="310"
              stroke="rgba(230, 201, 148, 0.45)"
              strokeWidth="0.9"
              strokeDasharray="4 6"
              opacity="0"
            />
            <line
              className="arch-guide"
              x1="210"
              y1="42"
              x2="750"
              y2="42"
              stroke="rgba(230, 201, 148, 0.35)"
              strokeWidth="0.8"
              opacity="0"
            />
            <line
              className="arch-guide"
              x1="155"
              y1="112"
              x2="805"
              y2="112"
              stroke="rgba(230, 201, 148, 0.35)"
              strokeWidth="0.8"
              opacity="0"
            />

            {/* Realistic Architectural Material Fills (Fade in after lines finish) */}
            <polygon
              className="arch-fill-glass"
              points="352,112 480,42 608,112"
              fill="url(#introRoofFill)"
              opacity="0"
            />
            {/* Warm illuminated main living room & upper mezzanine glass */}
            <rect
              className="arch-fill-warm"
              x="275"
              y="196"
              width="160"
              height="96"
              fill="url(#introWarmGlow)"
              opacity="0"
            />
            <rect
              className="arch-fill-warm"
              x="456"
              y="206"
              width="58"
              height="86"
              fill="url(#introWarmGlow)"
              opacity="0"
            />
            <rect
              className="arch-fill-glass"
              x="534"
              y="196"
              width="146"
              height="96"
              fill="url(#introGlassGrad)"
              opacity="0"
            />
            <rect
              className="arch-fill-glass"
              x="258"
              y="122"
              width="154"
              height="60"
              fill="url(#introGlassGrad)"
              opacity="0"
            />
            <rect
              className="arch-fill-warm"
              x="442"
              y="118"
              width="76"
              height="64"
              fill="url(#introWarmGlow)"
              opacity="0"
            />
            <rect
              className="arch-fill-glass"
              x="546"
              y="122"
              width="156"
              height="60"
              fill="url(#introGlassGrad)"
              opacity="0"
            />

            {/* Diagonal Light Sweep Inside Architectural Mass */}
            <g clipPath="url(#houseBodyClip)">
              <rect
                className="arch-light-sweep"
                x="150"
                y="20"
                width="190"
                height="300"
                transform="skewX(-22)"
                fill="url(#introSweepGrad)"
                opacity="0"
              />
            </g>

            {/* Open Horizon & Ground Reflections */}
            <line
              className="arch-horizon"
              x1="20"
              y1="292"
              x2="940"
              y2="292"
              stroke="url(#introGoldInk)"
              strokeWidth="1.8"
            />
            <line
              className="arch-horizon"
              x1="230"
              y1="302"
              x2="730"
              y2="302"
              stroke="rgba(230, 201, 148, 0.35)"
              strokeWidth="1"
            />
            <line
              className="arch-horizon"
              x1="310"
              y1="312"
              x2="650"
              y2="312"
              stroke="rgba(196, 154, 240, 0.25)"
              strokeWidth="0.9"
            />

            {/* Primary Architectural Drawing Strokes */}
            {/* Upper Pitched Roof Ridge & Cantilever Overhangs */}
            <path
              className="arch-draw"
              d="M 332 112 L 480 38 L 628 112"
              fill="none"
              stroke="url(#introGoldInk)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              className="arch-draw"
              d="M 366 108 L 480 48 L 594 108"
              fill="none"
              stroke="rgba(255, 244, 220, 0.72)"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Upper Cantilevered Slab Roof */}
            <path
              className="arch-draw"
              d="M 212 112 L 748 112 L 748 122 L 212 122 Z"
              fill="none"
              stroke="url(#introGoldInk)"
              strokeWidth="1.9"
              strokeLinejoin="round"
            />
            {/* Upper Volume Exterior Walls */}
            <path
              className="arch-draw"
              d="M 232 122 L 232 190 L 728 190 L 728 122"
              fill="none"
              stroke="url(#introGoldInk)"
              strokeWidth="1.9"
              strokeLinejoin="round"
            />
            {/* Floating Cantilevered Floor Slab & Balcony */}
            <path
              className="arch-draw"
              d="M 196 190 L 826 190 L 826 198 L 196 198 Z"
              fill="none"
              stroke="url(#introGoldInk)"
              strokeWidth="2.0"
              strokeLinejoin="round"
            />
            {/* Ground Floor Living Volumes & Columns */}
            <path
              className="arch-draw"
              d="M 248 198 L 248 292 M 708 198 L 708 292"
              fill="none"
              stroke="url(#introGoldInk)"
              strokeWidth="2.0"
            />
            {/* Left Courtyard Wall & Entry Steps */}
            <path
              className="arch-draw"
              d="M 132 292 L 132 238 L 248 238 M 422 292 L 422 280 L 542 280 L 542 292"
              fill="none"
              stroke="rgba(230, 201, 148, 0.85)"
              strokeWidth="1.5"
            />
            {/* Right Pergola / Carport Architectural Wing */}
            <path
              className="arch-draw"
              d="M 708 198 L 814 198 L 814 292"
              fill="none"
              stroke="rgba(230, 201, 148, 0.9)"
              strokeWidth="1.7"
            />

            {/* Fine Architectural Details: Window Mullions, Glass Balcony, Door, Louvers & Cypress Trees */}
            {/* Upper Windows & Balcony Rail */}
            <path
              className="arch-fine"
              d="M 258 122 L 258 182 L 412 182 L 412 122 M 310 122 L 310 182 M 362 122 L 362 182"
              fill="none"
              stroke="rgba(255, 244, 220, 0.78)"
              strokeWidth="1.15"
            />
            <path
              className="arch-fine"
              d="M 442 122 L 442 182 L 518 182 L 518 122 M 480 122 L 480 182"
              fill="none"
              stroke="rgba(255, 244, 220, 0.88)"
              strokeWidth="1.2"
            />
            <path
              className="arch-fine"
              d="M 546 122 L 546 182 L 702 182 L 702 122 M 598 122 L 598 182 M 650 122 L 650 182"
              fill="none"
              stroke="rgba(255, 244, 220, 0.78)"
              strokeWidth="1.15"
            />
            {/* Upper Attic Architectural Quad Window (echoing A D S emblem) */}
            <path
              className="arch-fine"
              d="M 466 76 L 494 76 L 494 100 L 466 100 Z M 480 76 L 480 100 M 466 88 L 494 88"
              fill="none"
              stroke="#FFF4DC"
              strokeWidth="1.25"
            />
            {/* Ground Floor Floor-to-Ceiling Glass Facade & Pivot Entrance */}
            <path
              className="arch-fine"
              d="M 275 198 L 275 292 M 328 198 L 328 292 M 382 198 L 382 292 M 435 198 L 435 292"
              fill="none"
              stroke="rgba(255, 244, 220, 0.82)"
              strokeWidth="1.15"
            />
            <path
              className="arch-fine"
              d="M 456 206 L 514 206 L 514 292 M 456 206 L 456 292 M 500 248 L 500 262"
              fill="none"
              stroke="#FFF4DC"
              strokeWidth="1.45"
            />
            <path
              className="arch-fine"
              d="M 534 198 L 534 292 M 584 198 L 584 292 M 632 198 L 632 292 M 680 198 L 680 292"
              fill="none"
              stroke="rgba(255, 244, 220, 0.8)"
              strokeWidth="1.15"
            />
            {/* Horizontal Pergola Louvers */}
            <path
              className="arch-fine"
              d="M 722 212 L 800 212 M 722 224 L 800 224 M 722 236 L 800 236"
              fill="none"
              stroke="rgba(230, 201, 148, 0.65)"
              strokeWidth="1.1"
            />
            {/* Architectural Cypress / Landscape Foliage Silhouettes */}
            <path
              className="arch-fine"
              d="M 178 292 L 178 228 M 178 260 C 160 250, 162 214, 178 202 C 194 214, 196 250, 178 260"
              fill="none"
              stroke="rgba(196, 174, 232, 0.68)"
              strokeWidth="1.1"
            />
            <path
              className="arch-fine"
              d="M 852 292 L 852 212 M 852 255 C 836 244, 838 200, 852 184 C 866 200, 868 244, 852 255"
              fill="none"
              stroke="rgba(196, 174, 232, 0.68)"
              strokeWidth="1.1"
            />
          </svg>
        </div>

        {/* Grand, Free, Unboxed Site Title Choreography */}
        <div className="mt-4 sm:mt-6 text-center space-y-3 max-w-4xl">
          <p className="intro-brand-kicker opacity-0 text-[11px] sm:text-xs uppercase tracking-[0.28em] text-[#E6C994] font-medium">
            {tenant.slogan} · São Paulo
          </p>

          <h2 className="intro-brand-title opacity-0 font-display text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.04] text-balance bg-gradient-to-r from-[#FFF8EC] via-[#F2DEC0] to-[#D4B0FA] bg-clip-text text-transparent">
            {tenant.companyName}
          </h2>

          <div className="intro-brand-divider opacity-0 mx-auto w-44 sm:w-64 h-px bg-gradient-to-r from-transparent via-[#E6C994]/80 to-transparent" />

          <p className="intro-brand-sub opacity-0 text-xs sm:text-sm tracking-[0.22em] uppercase text-white/75">
            Vendas e Locações · CRECI {tenant.creci}
          </p>
        </div>
      </div>

      {/* Bottom 7-second timeline hairline + Skip button */}
      <div className="fixed bottom-0 left-0 right-0 z-20 px-6 pb-5 pt-3 flex items-center justify-between gap-4">
        <div className="flex-1 max-w-xs h-[2px] bg-white/15 overflow-hidden">
          <div
            ref={progressBarRef}
            className="h-full origin-left bg-gradient-to-r from-[#E6C994] to-[#C49AF0]"
            style={{ transform: 'scaleX(0)' }}
          />
        </div>

        <button
          type="button"
          onClick={handleSkip}
          className="text-xs tracking-[0.18em] uppercase text-white/70 hover:text-white transition-colors px-3 py-1.5 whitespace-nowrap"
        >
          Pular introdução
        </button>
      </div>
    </div>
  );
}
