import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Compass,
  Download,
  FileText,
  Film,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react';
import type { AIPropertyAnalysis, Property } from '../../types/realEstate';
import {
  apiAnalyzePhoto,
  apiCinematicDirector,
  apiGenerateDescription,
  apiGenerateVirtualTour,
  apiUploadMedia,
} from '../../lib/storeClient';

interface AIStudioModuleProps {
  properties: Property[];
  onSaveProperty: (updated: Property) => Promise<void>;
}

export function AIStudioModule({ properties, onSaveProperty }: AIStudioModuleProps) {
  const [selectedId, setSelectedId] = useState<string>(properties[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'photo' | 'video' | 'tour' | 'copy'>('photo');
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Photo Enhancer state
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [analysis, setAnalysis] = useState<AIPropertyAnalysis | null>(null);
  const [brightness, setBrightness] = useState(1.06);
  const [contrast, setContrast] = useState(1.08);
  const [saturate, setSaturate] = useState(1.08);
  const [warmth, setWarmth] = useState(4);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Cinematic Video state
  const [storyboard, setStoryboard] =
    useState<AIPropertyAnalysis['cinematicStoryboard'] | null>(null);
  const [renderingVideo, setRenderingVideo] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState('');

  // Copy Generator state
  const [generatedCopy, setGeneratedCopy] = useState<{
    subtitle: string;
    portalDescription: string;
    instagramCaption: string;
    seoKeywords: string[];
  } | null>(null);

  const property = properties.find((p) => p.id === selectedId) || properties[0];

  useEffect(() => {
    if (!property && properties[0]) {
      setSelectedId(properties[0].id);
    }
  }, [properties, property]);

  useEffect(() => {
    if (property?.aiAnalysis?.cinematicStoryboard) {
      setStoryboard(property.aiAnalysis.cinematicStoryboard);
    } else {
      setStoryboard(null);
    }
    setGeneratedVideoUrl(property?.videoUrl || '');
    setAnalysis(property?.aiAnalysis || null);
    setSelectedImageIdx(0);
  }, [property?.id]);

  // Draw preview onto Canvas whenever photo parameters change
  useEffect(() => {
    if (activeTab !== 'photo' || !property) return;
    const imgSrc = property.images[selectedImageIdx] || property.images[0];
    const canvas = canvasRef.current;
    if (!canvas || !imgSrc) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const targetW = 960;
      const targetH = Math.round((img.height / img.width) * targetW) || 640;
      canvas.width = targetW;
      canvas.height = targetH;
      ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate}) sepia(${Math.max(0, warmth) / 100})`;
      ctx.drawImage(img, 0, 0, targetW, targetH);
      ctx.filter = 'none';
    };
    img.src = imgSrc;
  }, [activeTab, property, selectedImageIdx, brightness, contrast, saturate, warmth]);

  if (!property) {
    return (
      <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-10 text-center">
        <p className="font-display text-2xl font-semibold">
          Cadastre um imóvel primeiro
        </p>
        <p className="text-sm text-[var(--ink-muted)] mt-1">
          O Estúdio de IA opera diretamente sobre as fotos e dados dos imóveis cadastrados.
        </p>
      </div>
    );
  }

  const currentImg = property.images[selectedImageIdx] || property.images[0] || '';

  const handleAnalyzePhoto = async () => {
    if (!currentImg) {
      setErrorMsg('Este imóvel ainda não possui fotos.');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    setStatusMsg('Analisando composição e iluminação com Gemini...');
    try {
      const result = await apiAnalyzePhoto(
        currentImg,
        `${property.title} — ${property.neighborhood}, São Paulo`
      );
      setAnalysis(result);
      if (result.enhancementParams) {
        setBrightness(result.enhancementParams.brightness ?? 1.06);
        setContrast(result.enhancementParams.contrast ?? 1.08);
        setSaturate(result.enhancementParams.saturate ?? 1.08);
        setWarmth(result.enhancementParams.warmth ?? 4);
      }
      await onSaveProperty({
        ...property,
        aiAnalysis: { ...(property.aiAnalysis || {}), ...result },
      });
      setStatusMsg('Diagnóstico visual concluído e parâmetros sugeridos aplicados.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha na análise de imagem.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEnhancedPhoto = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    setErrorMsg('');
    setStatusMsg('Exportando foto aprimorada e enviando para armazenamento...');
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const { url } = await apiUploadMedia(
        `enhanced_${property.slug}_${Date.now()}.jpg`,
        dataUrl
      );
      const nextImages = [url, ...property.images.filter((u) => u !== url)].slice(0, 20);
      await onSaveProperty({
        ...property,
        images: nextImages,
      });
      setSelectedImageIdx(0);
      setStatusMsg('Foto aprimorada salva como capa principal do imóvel.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar foto aprimorada.');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateStoryboard = async () => {
    setBusy(true);
    setErrorMsg('');
    setStatusMsg('Gerando roteiro cinematográfico de apresentação...');
    try {
      const sb = await apiCinematicDirector(property);
      setStoryboard(sb);
      await onSaveProperty({
        ...property,
        aiAnalysis: { ...(property.aiAnalysis || {}), cinematicStoryboard: sb },
      });
      setStatusMsg('Roteiro cinematográfico pronto. Clique em Renderizar Vídeo HD.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao gerar roteiro.');
    } finally {
      setBusy(false);
    }
  };

  const handleRenderCinematicVideo = async () => {
    if (property.images.length === 0) {
      setErrorMsg('Adicione ao menos 1 foto ao imóvel para renderizar o vídeo.');
      return;
    }
    setRenderingVideo(true);
    setErrorMsg('');
    setStatusMsg('Renderizando vídeo HD no navegador (aguarde ~10s)...');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D indisponível neste navegador.');

      const loadedImages = await Promise.all(
        property.images.slice(0, 4).map(
          (src) =>
            new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => resolve(img);
              img.onerror = () => reject(new Error('Falha ao carregar imagem para vídeo.'));
              img.src = src;
            })
        )
      );

      const scenes =
        storyboard?.scenes && storyboard.scenes.length > 0
          ? storyboard.scenes
          : loadedImages.map((_im, idx) => ({
              sceneNumber: idx + 1,
              caption: idx === 0 ? property.title : `${property.neighborhood} · São Paulo`,
              voiceover: '',
              motion: idx % 2 === 0 ? ('zoom-in' as const) : ('pan-right' as const),
              durationSec: 3,
            }));

      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const recordingDone = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      });

      recorder.start();

      const fps = 30;
      for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
        const scene = scenes[sIdx];
        const img = loadedImages[sIdx % loadedImages.length];
        const frames = Math.min(4, Math.max(2, scene.durationSec || 3)) * fps;

        for (let f = 0; f < frames; f++) {
          const progress = f / frames;
          const scale =
            scene.motion === 'zoom-out'
              ? 1.12 - progress * 0.1
              : 1.0 + progress * 0.12;
          const panX =
            scene.motion === 'pan-left'
              ? -progress * 40
              : scene.motion === 'pan-right'
                ? progress * 40 - 20
                : 0;

          ctx.fillStyle = '#0d0e10';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const drawW = canvas.width * scale;
          const drawH = (img.height / img.width) * drawW;
          const dx = (canvas.width - drawW) / 2 + panX;
          const dy = (canvas.height - drawH) / 2;
          ctx.drawImage(img, dx, dy, drawW, drawH);

          // Editorial scrim + lower third
          const grad = ctx.createLinearGradient(0, 420, 0, 720);
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(1, 'rgba(0,0,0,0.82)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 420, canvas.width, 300);

          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = '600 18px sans-serif';
          ctx.fillText(
            `A D S IMÓVEIS · CRECI 226079-F · ${property.neighborhood.toUpperCase()}`,
            56,
            618
          );

          ctx.fillStyle = '#ffffff';
          ctx.font = '600 36px Georgia, serif';
          ctx.fillText(scene.caption.slice(0, 56), 56, 666);

          await new Promise((r) => setTimeout(r, 1000 / fps));
        }
      }

      recorder.stop();
      const videoBlob = await recordingDone;
      const localPreviewUrl = URL.createObjectURL(videoBlob);
      setGeneratedVideoUrl(localPreviewUrl);

      // Upload to Vercel Blob / storage if <= 10MB
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(videoBlob);
      });
      if (dataUrl && videoBlob.size < 9.5 * 1024 * 1024) {
        const uploaded = await apiUploadMedia(
          `cinematic_${property.slug}.webm`,
          dataUrl
        );
        setGeneratedVideoUrl(uploaded.url);
        await onSaveProperty({ ...property, videoUrl: uploaded.url });
        setStatusMsg('Vídeo AI Property Cinematic renderizado e anexado ao imóvel.');
      } else {
        setStatusMsg('Vídeo renderizado localmente para download.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao renderizar vídeo.');
    } finally {
      setRenderingVideo(false);
    }
  };

  const handleGenerateVirtualTour = async () => {
    setBusy(true);
    setErrorMsg('');
    setStatusMsg('Estruturando Visita Virtual nas 3 modalidades com IA...');
    try {
      const vt = await apiGenerateVirtualTour(property);
      await onSaveProperty({
        ...property,
        virtualTourData: vt,
      });
      setStatusMsg('Visita Virtual atualizada e publicada na página do imóvel.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao gerar Visita Virtual.');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateCopy = async () => {
    setBusy(true);
    setErrorMsg('');
    setStatusMsg('Redigindo descrições comerciais para São Paulo...');
    try {
      const copy = await apiGenerateDescription(property);
      setGeneratedCopy(copy);
      setStatusMsg('Descrições comerciais prontas.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao gerar descrição.');
    } finally {
      setBusy(false);
    }
  };

  const handleApplyCopy = async () => {
    if (!generatedCopy) return;
    setBusy(true);
    try {
      await onSaveProperty({
        ...property,
        subtitle: generatedCopy.subtitle,
        description: generatedCopy.portalDescription,
      });
      setStatusMsg('Subtítulo e descrição aplicados e publicados no imóvel.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-[var(--ink-muted)]">
            Inteligência Artificial Aplicada ao Portfólio
          </p>
          <h2 className="font-display text-2xl font-semibold">
            Estúdio de IA Imobiliária — A D S Imóveis
          </h2>
        </div>

        <label className="block min-w-[260px]">
          <span className="text-xs text-[var(--ink-muted)] block mb-1">
            Imóvel selecionado
          </span>
          <select
            value={property.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full h-10 px-3 text-sm bg-[var(--canvas-bg)] border border-[var(--border-color)] rounded-lg"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.neighborhood})
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Mode Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-lg w-fit">
        {(
          [
            { id: 'photo', label: 'Análise & Melhoria de Fotos', icon: Camera },
            { id: 'video', label: 'AI Property Cinematic', icon: Film },
            { id: 'tour', label: 'Visita Virtual (3 Modos)', icon: Compass },
            { id: 'copy', label: 'Descrições Comerciais', icon: FileText },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[var(--accent-color)] text-[var(--accent-text)]'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {statusMsg && (
        <div className="px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900">
          {errorMsg}
        </div>
      )}

      {/* TAB 1: PHOTO ANALYSIS & ENHANCER */}
      {activeTab === 'photo' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Prévia HDR em Tempo Real</p>
              <div className="flex items-center gap-2">
                {property.images.map((_img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImageIdx(idx)}
                    className={`px-2.5 py-1 text-xs rounded border ${
                      idx === selectedImageIdx
                        ? 'bg-[var(--accent-color)] text-[var(--accent-text)] border-transparent'
                        : 'border-[var(--border-color)] text-[var(--ink-muted)]'
                    }`}
                  >
                    Foto {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className="aspect-[16/10] bg-neutral-100 rounded-lg overflow-hidden border border-[var(--border-color)] flex items-center justify-center">
              {currentImg ? (
                <canvas ref={canvasRef} className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-[var(--ink-muted)]">
                  Adicione fotos ao imóvel para editar.
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <label className="space-y-1">
                <span>Brilho ({brightness.toFixed(2)})</span>
                <input
                  type="range"
                  min={0.85}
                  max={1.25}
                  step={0.01}
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full accent-[var(--accent-color)]"
                />
              </label>
              <label className="space-y-1">
                <span>Contraste ({contrast.toFixed(2)})</span>
                <input
                  type="range"
                  min={0.9}
                  max={1.3}
                  step={0.01}
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full accent-[var(--accent-color)]"
                />
              </label>
              <label className="space-y-1">
                <span>Saturação ({saturate.toFixed(2)})</span>
                <input
                  type="range"
                  min={0.8}
                  max={1.35}
                  step={0.01}
                  value={saturate}
                  onChange={(e) => setSaturate(Number(e.target.value))}
                  className="w-full accent-[var(--accent-color)]"
                />
              </label>
              <label className="space-y-1">
                <span>Aquecimento ({warmth}%)</span>
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={warmth}
                  onChange={(e) => setWarmth(Number(e.target.value))}
                  className="w-full accent-[var(--accent-color)]"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleAnalyzePhoto}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)] disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Analisar e Otimizar com IA
              </button>
              <button
                type="button"
                disabled={busy || !currentImg}
                onClick={handleSaveEnhancedPhoto}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border-color)] hover:bg-[var(--canvas-bg)]"
              >
                <Upload className="w-3.5 h-3.5" />
                Salvar foto aprimorada na galeria
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-5 space-y-4">
            <h3 className="font-display text-xl font-semibold">
              Diagnóstico Arquitetônico da Foto
            </h3>
            {analysis?.lightingNotes ? (
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                  <span className="text-[var(--ink-muted)]">Ambiente detectado</span>
                  <span className="font-medium">{analysis.roomType || 'Social'}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                  <span className="text-[var(--ink-muted)]">Avaliação técnica</span>
                  <span className="font-mono-tabular font-semibold">
                    {analysis.qualityScore || 85}/100
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)] mb-1">
                    Iluminação & Enquadramento
                  </p>
                  <p className="text-sm text-[var(--ink-primary)] leading-relaxed">
                    {analysis.lightingNotes}
                  </p>
                </div>
                {analysis.stagingRecommendations && analysis.stagingRecommendations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)] mb-1.5">
                      Recomendações de Staging
                    </p>
                    <ul className="space-y-1.5 text-xs text-[var(--ink-muted)]">
                      {analysis.stagingRecommendations.map((rec, i) => (
                        <li key={i}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
                Clique em &ldquo;Analisar e Otimizar com IA&rdquo; para receber diagnóstico de
                iluminação, recomendações de staging e calibração automática de cor.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AI PROPERTY CINEMATIC VIDEO */}
      {activeTab === 'video' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-5 space-y-4">
            <h3 className="font-display text-xl font-semibold">
              AI Property Cinematic — Direção e Roteiro
            </h3>
            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              A IA cria o roteiro de cenas, movimentos de câmera e legendas comerciais
              focadas em São Paulo; em seguida, o motor audiovisual renderiza um vídeo HD
              pronto para o site e redes sociais.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={handleGenerateStoryboard}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border-color)] hover:bg-[var(--canvas-bg)]"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                1. Gerar Roteiro com IA
              </button>
              <button
                type="button"
                disabled={renderingVideo}
                onClick={handleRenderCinematicVideo}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)] disabled:opacity-60"
              >
                {renderingVideo ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Film className="w-3.5 h-3.5" />
                )}
                2. Renderizar Vídeo HD (.webm)
              </button>
            </div>

            {storyboard && (
              <div className="space-y-3 pt-3 border-t border-[var(--border-color)]">
                <p className="text-sm font-semibold">{storyboard.title}</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  Trilha sugerida: {storyboard.musicMood}
                </p>
                <div className="space-y-2">
                  {storyboard.scenes?.map((sc) => (
                    <div
                      key={sc.sceneNumber}
                      className="p-3 rounded-lg bg-[var(--canvas-bg)] border border-[var(--border-color)] text-xs space-y-1"
                    >
                      <p className="font-semibold">
                        Cena 0{sc.sceneNumber} ({sc.motion}) · {sc.caption}
                      </p>
                      <p className="text-[var(--ink-muted)]">{sc.voiceover}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-6 bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-5 space-y-4">
            <h3 className="font-display text-xl font-semibold">
              Vídeo Gerado e Anexado ao Imóvel
            </h3>
            {generatedVideoUrl ? (
              <div className="space-y-3">
                <video
                  src={generatedVideoUrl}
                  controls
                  className="w-full rounded-lg border border-[var(--border-color)] bg-black aspect-video"
                />
                <a
                  href={generatedVideoUrl}
                  download={`${property.slug}.webm`}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border-color)] hover:bg-[var(--canvas-bg)]"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar arquivo de vídeo
                </a>
              </div>
            ) : (
              <div className="aspect-video rounded-lg border border-dashed border-[var(--border-color)] flex items-center justify-center text-xs text-[var(--ink-muted)] p-6 text-center">
                Gere o roteiro e clique em &ldquo;Renderizar Vídeo HD&rdquo; para criar a
                apresentação audiovisual automática deste imóvel.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AI VIRTUAL TOUR */}
      {activeTab === 'tour' && (
        <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-xl font-semibold">
                Gerador de Visita Virtual (3 Modalidades)
              </h3>
              <p className="text-xs text-[var(--ink-muted)] mt-1">
                Cria automaticamente a cena Panorâmica 360°, capítulos de História Guiada e
                pontos interativos do Explorador de Hotspots para este imóvel.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleGenerateVirtualTour}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)] shrink-0"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Compass className="w-3.5 h-3.5" />}
              Gerar e Publicar Tour com IA
            </button>
          </div>

          {property.virtualTourData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-[var(--border-color)] text-xs">
              <div className="p-4 rounded-lg bg-[var(--canvas-bg)] border border-[var(--border-color)] space-y-2">
                <p className="font-semibold">1. Panorâmico 360°</p>
                <p>{property.virtualTourData.panoramicSceneTitle}</p>
                <ul className="text-[var(--ink-muted)] space-y-1">
                  {property.virtualTourData.panoramicHighlights?.map((h, i) => (
                    <li key={i}>• {h}</li>
                  ))}
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-[var(--canvas-bg)] border border-[var(--border-color)] space-y-2">
                <p className="font-semibold">
                  2. História Guiada ({property.virtualTourData.chapters?.length || 0} capítulos)
                </p>
                <ul className="text-[var(--ink-muted)] space-y-1">
                  {property.virtualTourData.chapters?.map((c) => (
                    <li key={c.id}>• {c.title}</li>
                  ))}
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-[var(--canvas-bg)] border border-[var(--border-color)] space-y-2">
                <p className="font-semibold">
                  3. Hotspots ({property.virtualTourData.hotspots?.length || 0} pontos)
                </p>
                <ul className="text-[var(--ink-muted)] space-y-1">
                  {property.virtualTourData.hotspots?.map((hs) => (
                    <li key={hs.id}>
                      • {hs.roomLabel}: {hs.title}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COMMERCIAL COPY GENERATOR */}
      {activeTab === 'copy' && (
        <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-xl font-semibold">
                Gerador de Descrições Comerciais — A D S Imóveis
              </h3>
              <p className="text-xs text-[var(--ink-muted)] mt-1">
                Redige descrição editorial para o portal, legenda para Instagram e palavras-chave
                de SEO local em São Paulo (CRECI 226079-F).
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleGenerateCopy}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)] shrink-0"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Gerar Textos Comerciais
            </button>
          </div>

          {generatedCopy && (
            <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
              <div className="p-4 rounded-lg bg-[var(--canvas-bg)] border border-[var(--border-color)] space-y-1">
                <p className="text-xs font-semibold text-[var(--ink-muted)]">Subtítulo sugerido</p>
                <p className="text-sm font-medium">{generatedCopy.subtitle}</p>
              </div>
              <div className="p-4 rounded-lg bg-[var(--canvas-bg)] border border-[var(--border-color)] space-y-1">
                <p className="text-xs font-semibold text-[var(--ink-muted)]">
                  Descrição para o Site e Portais
                </p>
                <p className="text-sm whitespace-pre-line leading-relaxed">
                  {generatedCopy.portalDescription}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-[var(--canvas-bg)] border border-[var(--border-color)] space-y-1">
                <p className="text-xs font-semibold text-[var(--ink-muted)]">
                  Legenda para Instagram
                </p>
                <p className="text-sm whitespace-pre-line leading-relaxed">
                  {generatedCopy.instagramCaption}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleApplyCopy}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-emerald-700 text-white"
              >
                <Check className="w-3.5 h-3.5" />
                Aplicar subtítulo e descrição ao imóvel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
