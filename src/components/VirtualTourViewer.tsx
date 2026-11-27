import { useEffect, useRef, useState } from 'react';
import { Compass, Film, MapPin, Pause, Play, RotateCcw } from 'lucide-react';
import type { Property, VirtualTourMode } from '../types/realEstate';
import { SafeImage } from './SafeImage';

interface VirtualTourViewerProps {
  property: Property;
}

export function VirtualTourViewer({ property }: VirtualTourViewerProps) {
  const [mode, setMode] = useState<VirtualTourMode>(
    property.virtualTourMode || 'panoramic_360'
  );
  const [panOffset, setPanOffset] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [activeChapterIdx, setActiveChapterIdx] = useState(0);
  const [isPlayingStory, setIsPlayingStory] = useState(false);
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(
    property.virtualTourData?.hotspots?.[0]?.id || null
  );
  const dragStartX = useRef<number | null>(null);

  const images = property.images.length > 0 ? property.images : [''];
  const tour = property.virtualTourData;
  const chapters =
    tour?.chapters && tour.chapters.length > 0
      ? tour.chapters
      : images.map((_img, idx) => ({
          id: `auto-ch-${idx}`,
          title: idx === 0 ? 'Ambiente Principal' : `Perspectiva ${idx + 1}`,
          narration:
            property.subtitle ||
            `Apresentação em ${property.neighborhood}, ${property.city}.`,
          cameraHint: 'Movimento panorâmico suave',
          imageIndex: idx,
          durationSec: 5,
        }));

  const hotspots =
    tour?.hotspots && tour.hotspots.length > 0
      ? tour.hotspots
      : [
          {
            id: 'default-hs-1',
            x: 48,
            y: 48,
            title: property.title,
            description:
              property.regionHighlight ||
              `Imóvel localizado em ${property.neighborhood}, São Paulo.`,
            roomLabel: 'Visão Geral',
            imageIndex: 0,
          },
        ];

  useEffect(() => {
    if (mode !== 'guided_story' || !isPlayingStory) return;
    const current = chapters[activeChapterIdx] || chapters[0];
    const timer = window.setTimeout(() => {
      setActiveChapterIdx((prev) => (prev + 1) % chapters.length);
    }, (current?.durationSec || 5) * 1000);
    return () => window.clearTimeout(timer);
  }, [mode, isPlayingStory, activeChapterIdx, chapters]);

  const currentChapter = chapters[activeChapterIdx] || chapters[0];
  const activeHotspot =
    hotspots.find((h) => h.id === activeHotspotId) || hotspots[0];

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== 'panoramic_360') return;
    setIsDragging(true);
    dragStartX.current = e.clientX;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || dragStartX.current === null || mode !== 'panoramic_360') return;
    const delta = e.clientX - dragStartX.current;
    dragStartX.current = e.clientX;
    setPanOffset((prev) => Math.max(0, Math.min(100, prev - delta * 0.18)));
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    dragStartX.current = null;
  };

  return (
    <section className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-[var(--radius-card)] overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs text-[var(--ink-muted)]">
            Experiência Interativa · 3 Modalidades
          </p>
          <h3 className="font-display text-2xl font-semibold text-[var(--ink-primary)]">
            Visita Virtual do Imóvel
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg">
          <button
            type="button"
            onClick={() => {
              setMode('panoramic_360');
              setIsPlayingStory(false);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              mode === 'panoramic_360'
                ? 'bg-[var(--accent-color)] text-[var(--accent-text)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Panorâmico 360°
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('guided_story');
              setIsPlayingStory(true);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              mode === 'guided_story'
                ? 'bg-[var(--accent-color)] text-[var(--accent-text)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            História Guiada
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('hotspot_explorer');
              setIsPlayingStory(false);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              mode === 'hotspot_explorer'
                ? 'bg-[var(--accent-color)] text-[var(--accent-text)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Explorador de Hotspots
          </button>
        </div>
      </div>

      {/* Mode 1: Panoramic 360 */}
      {mode === 'panoramic_360' && (
        <div className="relative">
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className={`relative aspect-[16/9] overflow-hidden select-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            <img
              src={images[0]}
              alt={tour?.panoramicSceneTitle || property.title}
              referrerPolicy="no-referrer"
              draggable={false}
              className="w-full h-full object-cover scale-125 transition-transform duration-75"
              style={{
                objectPosition: `${panOffset}% 50%`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25 pointer-events-none" />
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white pointer-events-none">
              <span className="text-xs font-medium bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-md">
                Arraste horizontalmente para explorar o ambiente
              </span>
              <span className="font-mono-tabular text-xs bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-md">
                {Math.round(panOffset * 3.6)}°
              </span>
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-white">
              <div>
                <p className="font-display text-2xl font-semibold">
                  {tour?.panoramicSceneTitle || property.title}
                </p>
                <p className="text-xs text-white/85 mt-1">
                  {(tour?.panoramicHighlights || []).slice(0, 2).join(' · ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPanOffset(50)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-md transition-colors self-start sm:self-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Centralizar visão
              </button>
            </div>
          </div>
          <div className="px-5 py-3 bg-[var(--canvas-bg)] border-t border-[var(--border-color)] flex items-center gap-4">
            <span className="text-xs text-[var(--ink-muted)] whitespace-nowrap">
              Ângulo 360°
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={panOffset}
              onChange={(e) => setPanOffset(Number(e.target.value))}
              aria-label="Ângulo panorâmico"
              className="w-full accent-[var(--accent-color)]"
            />
          </div>
        </div>
      )}

      {/* Mode 2: Guided AI Story */}
      {mode === 'guided_story' && (
        <div>
          <div className="relative aspect-[16/9] overflow-hidden bg-neutral-900">
            <SafeImage
              src={images[currentChapter.imageIndex % images.length]}
              alt={currentChapter.title}
              className="w-full h-full object-cover transition-transform duration-[4500ms] ease-out scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 text-white flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-xs text-white/80 mb-1">
                  Capítulo {activeChapterIdx + 1} de {chapters.length} ·{' '}
                  {currentChapter.cameraHint}
                </p>
                <h4 className="font-display text-2xl sm:text-3xl font-semibold">
                  {currentChapter.title}
                </h4>
                <p className="text-sm text-white/90 mt-1.5 leading-relaxed">
                  {currentChapter.narration}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPlayingStory((v) => !v)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-white text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors shrink-0 self-start sm:self-end"
              >
                {isPlayingStory ? (
                  <>
                    <Pause className="w-3.5 h-3.5" /> Pausar tour
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" /> Reproduzir tour
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 bg-[var(--canvas-bg)] border-t border-[var(--border-color)]">
            {chapters.map((ch, idx) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  setActiveChapterIdx(idx);
                  setIsPlayingStory(true);
                }}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  idx === activeChapterIdx
                    ? 'bg-[var(--surface-bg)] border-[var(--accent-color)] text-[var(--ink-primary)]'
                    : 'bg-transparent border-[var(--border-color)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                }`}
              >
                <p className="text-xs font-medium">
                  0{idx + 1}. {ch.title}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mode 3: Interactive Hotspot Explorer */}
      {mode === 'hotspot_explorer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2 relative aspect-[16/9] lg:aspect-auto lg:min-h-[380px] overflow-hidden bg-neutral-100">
            <SafeImage
              src={images[(activeHotspot?.imageIndex || 0) % images.length]}
              alt={activeHotspot?.title || property.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/15 pointer-events-none" />
            {hotspots.map((hs, idx) => {
              const selected = hs.id === activeHotspot?.id;
              return (
                <button
                  key={hs.id}
                  type="button"
                  onClick={() => setActiveHotspotId(hs.id)}
                  style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
                  aria-label={hs.title}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-transform border-2 ${
                    selected
                      ? 'bg-[var(--accent-color)] text-[var(--accent-text)] border-white scale-110 shadow-lg'
                      : 'bg-white/95 text-neutral-900 border-neutral-800/30 hover:scale-105'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
          <div className="p-5 flex flex-col justify-between gap-4 border-t lg:border-t-0 lg:border-l border-[var(--border-color)] bg-[var(--surface-bg)]">
            {activeHotspot && (
              <div className="space-y-2">
                <p className="text-xs text-[var(--ink-muted)]">
                  Ambiente selecionado · {activeHotspot.roomLabel}
                </p>
                <h4 className="font-display text-2xl font-semibold text-[var(--ink-primary)]">
                  {activeHotspot.title}
                </h4>
                <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
                  {activeHotspot.description}
                </p>
              </div>
            )}
            <div className="space-y-1.5 pt-4 border-t border-[var(--border-color)]">
              <p className="text-xs font-medium text-[var(--ink-primary)] mb-2">
                Pontos de interesse
              </p>
              {hotspots.map((hs, idx) => (
                <button
                  key={hs.id}
                  type="button"
                  onClick={() => setActiveHotspotId(hs.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center justify-between ${
                    hs.id === activeHotspot?.id
                      ? 'bg-[var(--canvas-bg)] text-[var(--ink-primary)] font-semibold'
                      : 'text-[var(--ink-muted)] hover:bg-[var(--canvas-bg)]'
                  }`}
                >
                  <span>
                    0{idx + 1}. {hs.title}
                  </span>
                  <span className="text-[11px] opacity-75">{hs.roomLabel}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
