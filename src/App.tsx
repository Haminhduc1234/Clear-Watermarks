import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { Upload, Download, Play, Pause, Volume2, VolumeX, Trash2, Wand2, Loader2, RotateCcw, Video, Zap, Sparkles, Blend, Layers, Eye, EyeOff, Sliders, Image as ImageIcon, Check, X, LogOut } from 'lucide-react';
import { cn } from './lib/utils';
import type { User } from './types/auth';
import AuthScreen from './components/AuthScreen';
import { getSupabase, mapSupabaseUser, isUserApproved } from './lib/supabase';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type BlendMode = 'smooth' | 'blur' | 'delogo';
type SmoothLevel = 'low' | 'medium' | 'high';

export default function App() {
  // Authentication states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [isMultiThreaded, setIsMultiThreaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Quality mode: 'high' (CRF 18 visually lossless) or 'fast' (CRF 26 ultrafast)
  const [qualityMode, setQualityMode] = useState<'fast' | 'high'>('high');

  // Blending & Smoothing options
  const [blendMode, setBlendMode] = useState<BlendMode>('smooth');
  const [smoothLevel, setSmoothLevel] = useState<SmoothLevel>('medium');

  // Custom Branding / Watermark Overlay
  const [enableCustomLogo, setEnableCustomLogo] = useState<boolean>(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoScale, setLogoScale] = useState<number>(15); // 5% to 35% of video width
  const [logoOpacity, setLogoOpacity] = useState<number>(90); // 10% to 100%
  const logoImgRef = useRef<HTMLImageElement | null>(null);

  // Live preview & comparison states
  const [showPreview, setShowPreview] = useState(true);
  const [isHoldingCompare, setIsHoldingCompare] = useState(false);

  // Video playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const durationRef = useRef<number>(0);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const ffmpegRef = useRef(new FFmpeg());
  const lastLogsRef = useRef<string[]>([]);

  const [rect, setRect] = useState<Rect | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(console.error);
    } else {
      videoRef.current.pause();
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const time = parseFloat(e.target.value);
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  // Load FFmpeg
  useEffect(() => {
    const ffmpeg = ffmpegRef.current;
    let isMounted = true;

    const load = async () => {
      try {
        ffmpeg.on('progress', ({ progress, time }) => {
          if (!isMounted) return;
          if (typeof progress === 'number' && !isNaN(progress) && progress > 0) {
            const pct = Math.min(99, Math.max(1, Math.round(progress * 100)));
            setProgress((prev) => Math.max(prev, pct));
          } else if (typeof time === 'number' && !isNaN(time) && time > 0) {
            // time can be in microseconds (in ffmpeg.wasm) or seconds
            const currentSec = time > 100000 ? time / 1000000 : time;
            const total = durationRef.current;
            if (total > 0) {
              const pct = Math.min(99, Math.max(1, Math.round((currentSec / total) * 100)));
              setProgress((prev) => Math.max(prev, pct));
            }
          }
        });

        ffmpeg.on('log', ({ message }) => {
          console.log('[FFmpeg]', message);
          if (!message || typeof message !== 'string') return;
          lastLogsRef.current.push(message);
          if (lastLogsRef.current.length > 50) lastLogsRef.current.shift();
          if (!isMounted) return;

          // 1. Detect input duration if reported: e.g. "Duration: 00:00:15.32"
          const durMatch = message.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
          if (durMatch) {
            const h = parseFloat(durMatch[1]);
            const m = parseFloat(durMatch[2]);
            const s = parseFloat(durMatch[3]);
            const total = h * 3600 + m * 60 + s;
            if (total > 0) {
              durationRef.current = total;
            }
          }

          // 2. Detect encoded time from transcoding progress log: e.g. "time=00:00:05.12"
          const timeMatch = message.match(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
          if (timeMatch) {
            const h = parseFloat(timeMatch[1]);
            const m = parseFloat(timeMatch[2]);
            const s = parseFloat(timeMatch[3]);
            const currentSec = h * 3600 + m * 60 + s;
            const total = durationRef.current;
            if (total > 0) {
              const pct = Math.min(99, Math.max(1, Math.round((currentSec / total) * 100)));
              setProgress((prev) => Math.max(prev, pct));
            }
          }
        });

        console.log('Initializing FFmpeg offline (stable core)...');
        setIsMultiThreaded(false);

        await ffmpeg.load({
          coreURL: await toBlobURL('/ffmpeg/core/ffmpeg-core.js', 'text/javascript'),
          wasmURL: await toBlobURL('/ffmpeg/core/ffmpeg-core.wasm', 'application/wasm'),
        });

        if (isMounted) {
          console.log("FFmpeg loaded successfully.");
          setFfmpegLoaded(true);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error loading FFmpeg:', err);
          setLoadError('Failed to load video processing engine. Please ensure you are on a supported browser.');
        }
      }
    };
    load();

    return () => {
      isMounted = false;
      // Terminate FFmpeg worker on unmount to prevent memory leaks
      try {
        ffmpeg.terminate();
      } catch (e) {
        // Ignore termination errors if it wasn't fully loaded
      }
    };
  }, []);

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('video/')) {
      alert('Please select a video file.');
      return;
    }
    setFile(selectedFile);
    setVideoUrl(URL.createObjectURL(selectedFile));
    setRect(null);
    setOutputUrl(null);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    durationRef.current = 0;
    setIsPlaying(false);
    setShowPreview(true);
    setIsHoldingCompare(false);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // Drawing logic
  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current || !videoRef.current) return null;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;
    if ('touches' in e) {
      const touch = e.touches?.[0] || (e as React.TouchEvent).changedTouches?.[0];
      if (!touch) return null;
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Coordinates relative to the canvas CSS size
    let x = clientX - rect.left;
    let y = clientY - rect.top;

    // Clamp to canvas bounds
    x = Math.max(0, Math.min(x, rect.width));
    y = Math.max(0, Math.min(y, rect.height));

    // We need to map these to the video's native resolution
    const video = videoRef.current;
    const scaleX = video.videoWidth / rect.width;
    const scaleY = video.videoHeight / rect.height;

    return {
      x: x * scaleX,
      y: y * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isProcessing || outputUrl) return;
    const pos = getMousePos(e);
    if (!pos) return;

    setIsDrawing(true);
    setStartPos(pos);
    setRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !startPos) return;
    const pos = getMousePos(e);
    if (!pos) return;

    setRect({
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      width: Math.abs(pos.x - startPos.x),
      height: Math.abs(pos.y - startPos.y),
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith('image/')) {
      alert('Vui lòng chọn tệp hình ảnh (PNG, JPG, WEBP, v.v.)');
      return;
    }
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    const url = URL.createObjectURL(selected);
    setLogoFile(selected);
    setLogoUrl(url);
    setEnableCustomLogo(true);

    const img = new Image();
    img.onload = () => {
      logoImgRef.current = img;
    };
    img.src = url;
  };

  const removeLogo = () => {
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    setLogoFile(null);
    setLogoUrl(null);
    logoImgRef.current = null;
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const drawCustomLogoOnCanvas = (
    ctx: CanvasRenderingContext2D,
    targetCanvasW: number,
    targetCanvasH: number,
    r: Rect | null,
    scalePct: number,
    opacityPct: number
  ) => {
    const img = logoImgRef.current;
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const targetW = Math.max(20, Math.round(targetCanvasW * (scalePct / 100)));
    const aspect = img.naturalWidth / img.naturalHeight;
    const targetH = Math.max(20, Math.round(targetW / aspect));

    let lx = 0;
    let ly = 0;

    if (r) {
      // Mặc định tự động căn chính giữa đè lên logo cũ
      lx = Math.round(r.x + (r.width - targetW) / 2);
      ly = Math.round(r.y + (r.height - targetH) / 2);
    } else {
      lx = Math.round((targetCanvasW - targetW) / 2);
      ly = Math.round((targetCanvasH - targetH) / 2);
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0.05, Math.min(1.0, opacityPct / 100));
    ctx.drawImage(img, lx, ly, targetW, targetH);
    ctx.restore();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (rect && (rect.width < 5 || rect.height < 5)) {
      setRect(null);
    } else if (rect && rect.width >= 5 && rect.height >= 5) {
      setShowPreview(true);
    }
  };

  // Helper: Draw badge on canvas
  const drawBadge = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
    bgColor: string,
    maxWidth: number
  ) => {
    const fontSize = 11;
    ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const textMetrics = ctx.measureText(text);
    const badgeW = textMetrics.width + 12;
    const badgeH = fontSize + 8;

    const badgeY = y >= badgeH + 4 ? y - badgeH - 3 : y + 3;
    const badgeX = Math.max(3, Math.min(maxWidth - badgeW - 3, x));

    ctx.save();
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    if ('roundRect' in ctx && typeof ctx.roundRect === 'function') {
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
    } else {
      ctx.rect(badgeX, badgeY, badgeW, badgeH);
    }
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, badgeX + 6, badgeY + badgeH / 2);
    ctx.restore();
  };

  // Render the simulated watermark removal preview directly on canvas
  const renderPreviewPatch = (
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    r: Rect,
    mode: BlendMode,
    level: SmoothLevel
  ) => {
    const x = Math.floor(r.x);
    const y = Math.floor(r.y);
    const w = Math.floor(r.width);
    const h = Math.floor(r.height);

    if (w <= 2 || h <= 2) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip(); // Restrict simulated patch to the watermark bounds

    if (mode === 'blur') {
      const blurRadius = level === 'low' ? 8 : level === 'high' ? 24 : 14;
      ctx.filter = `blur(${blurRadius}px)`;

      const pad = Math.min(20, Math.floor(w / 4));
      const sx = Math.max(0, x - pad);
      const sy = Math.max(0, y - pad);
      const sw = Math.min(vw - sx, w + pad * 2);
      const sh = Math.min(vh - sy, h + pad * 2);

      ctx.drawImage(video, sx, sy, sw, sh, sx, sy, sw, sh);
    } else {
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }
      const offCanvas = offscreenCanvasRef.current;
      if (offCanvas.width !== w || offCanvas.height !== h) {
        offCanvas.width = Math.max(1, w);
        offCanvas.height = Math.max(1, h);
      }
      const offCtx = offCanvas.getContext('2d');
      if (offCtx) {
        offCtx.clearRect(0, 0, w, h);

        const borderSize = Math.max(2, Math.min(6, Math.floor(Math.min(w, h) / 6)));

        const lx = Math.max(0, x - borderSize);
        offCtx.drawImage(video, lx, y, borderSize, h, 0, 0, w, h);

        const rx = Math.min(vw - borderSize, x + w);
        offCtx.globalAlpha = 0.5;
        offCtx.drawImage(video, rx, y, borderSize, h, 0, 0, w, h);

        const ty = Math.max(0, y - borderSize);
        offCtx.drawImage(video, x, ty, w, borderSize, 0, 0, w, h);

        const by = Math.min(vh - borderSize, y + h);
        offCtx.drawImage(video, x, by, w, borderSize, 0, 0, w, h);

        offCtx.globalAlpha = 1.0;

        if (mode === 'smooth') {
          const blurRadius = level === 'low' ? 4 : level === 'high' ? 12 : 7;
          ctx.filter = `blur(${blurRadius}px)`;
        } else {
          ctx.filter = 'blur(1px)';
        }
        ctx.drawImage(offCanvas, x, y, w, h);
      }
    }

    ctx.restore();

    // Outline around watermark region
    ctx.save();
    ctx.strokeStyle = mode === 'smooth' ? '#3b82f6' : mode === 'blur' ? '#8b5cf6' : '#10b981';
    ctx.lineWidth = Math.max(1.5, vw / 450);
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();

    const label = mode === 'smooth'
      ? `✨ Preview: Hòa trộn (${level === 'low' ? 'Nhẹ' : level === 'high' ? 'Mạnh' : 'Vừa'})`
      : mode === 'blur'
        ? `🌫️ Preview: Làm mờ (${level === 'low' ? 'Nhẹ' : level === 'high' ? 'Mạnh' : 'Vừa'})`
        : '🎯 Preview: Delogo';

    drawBadge(ctx, x, y, label, 'rgba(15, 23, 42, 0.88)', vw);
  };

  // Main canvas render function with live preview for Inpaint + Custom Logo
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // If drawing or preview disabled or user is holding to compare original:
    if (isDrawing || !showPreview || isHoldingCompare) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (rect && rect.width > 0 && rect.height > 0) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.28)';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = Math.max(2, canvas.width / 320);
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

        if (isHoldingCompare) {
          drawBadge(ctx, rect.x, rect.y, '👁️ Video gốc (Chưa xử lý)', '#ea580c', canvas.width);
        }
      }
      return;
    }

    // Always draw full video
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Inpaint simulated preview
    if (rect && rect.width > 0 && rect.height > 0) {
      renderPreviewPatch(ctx, video, rect, blendMode, smoothLevel);
    }

    // Overlay custom logo if enabled
    if (enableCustomLogo && logoImgRef.current) {
      drawCustomLogoOnCanvas(
        ctx,
        canvas.width,
        canvas.height,
        rect,
        logoScale,
        logoOpacity
      );
    }
  }, [
    rect,
    isDrawing,
    showPreview,
    isHoldingCompare,
    blendMode,
    smoothLevel,
    enableCustomLogo,
    logoScale,
    logoOpacity
  ]);

  // Animation frame loop to keep live preview synced with playing or seeking video
  useEffect(() => {
    if (!videoUrl || outputUrl) return;

    let animId: number;
    let isMounted = true;

    const loop = () => {
      if (!isMounted) return;
      renderCanvas();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
    };
  }, [renderCanvas, videoUrl, outputUrl]);

  // Handle video loaded metadata to initialize canvas size & auto-play
  const handleVideoLoaded = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (canvas && video) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const dur = video.duration || 0;
      setDuration(dur);
      durationRef.current = dur;
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const processVideo = async () => {
    if (!file || !rect || !ffmpegLoaded) return;

    try {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setIsProcessing(true);
      setProgress(2);
      const ffmpeg = ffmpegRef.current;

      const inputExt = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.mp4';
      const inputName = 'input' + inputExt;
      const outputName = 'output.mp4';
      const logoName = 'custom_logo.png';

      await ffmpeg.writeFile(inputName, await fetchFile(file));
      setProgress((prev) => Math.max(prev, 6));

      let hasCustomLogo = false;
      if (enableCustomLogo && logoFile) {
        await ffmpeg.writeFile(logoName, await fetchFile(logoFile));
        hasCustomLogo = true;
        setProgress((prev) => Math.max(prev, 10));
      }

      const video = videoRef.current;
      const vw = video?.videoWidth || 1920;
      const vh = video?.videoHeight || 1080;

      // Calculate delogo / inpaint region with strict boundary padding
      const pad = 2;
      let x = Math.max(pad, Math.floor(rect.x));
      let y = Math.max(pad, Math.floor(rect.y));
      let w = Math.max(8, Math.floor(rect.width));
      let h = Math.max(8, Math.floor(rect.height));

      // w and h must be even for x264 and filter chains
      if (w % 2 !== 0) w += 1;
      if (h % 2 !== 0) h += 1;

      // Strictly ensure delogo is contained inside [pad, vw - pad] and [pad, vh - pad]
      if (w > vw - pad * 2) {
        w = Math.max(8, (vw - pad * 2) % 2 === 0 ? vw - pad * 2 : vw - pad * 2 - 1);
      }
      if (h > vh - pad * 2) {
        h = Math.max(8, (vh - pad * 2) % 2 === 0 ? vh - pad * 2 : vh - pad * 2 - 1);
      }
      x = Math.max(pad, Math.min(x, vw - w - pad));
      y = Math.max(pad, Math.min(y, vh - h - pad));

      // Calculate logo dimensions & placement for FFmpeg (Centered directly over old watermark)
      const img = logoImgRef.current;
      const logoAspect = (img && img.naturalWidth && img.naturalHeight)
        ? (img.naturalWidth / img.naturalHeight)
        : 1;

      let logoScaleW = Math.max(20, Math.round(vw * (logoScale / 100)));
      logoScaleW = logoScaleW % 2 === 0 ? logoScaleW : logoScaleW + 1;
      let logoScaleH = Math.max(10, Math.round(logoScaleW / logoAspect));
      logoScaleH = logoScaleH % 2 === 0 ? logoScaleH : logoScaleH + 1;

      const logoAlpha = (logoOpacity / 100).toFixed(2);

      // Căn chính giữa đè trực tiếp lên vùng watermark rect đã chọn
      let targetLX = Math.max(0, Math.round(rect.x + (rect.width - logoScaleW) / 2));
      let targetLY = Math.max(0, Math.round(rect.y + (rect.height - logoScaleH) / 2));
      targetLX = Math.max(0, Math.min(vw - logoScaleW, targetLX));
      targetLY = Math.max(0, Math.min(vh - logoScaleH, targetLY));
      const overlayExpr = `${targetLX}:${targetLY}:eof_action=repeat`;

      let filterArgs: string[] = [];

      if (hasCustomLogo) {
        let baseFilter = '';
        if (blendMode === 'smooth') {
          const radius = smoothLevel === 'low' ? 4 : smoothLevel === 'high' ? 12 : 7;
          baseFilter = `[0:v]delogo=x=${x}:y=${y}:w=${w}:h=${h}[delogoed];[delogoed]split[base][to_crop];[to_crop]crop=${w}:${h}:${x}:${y},boxblur=${radius}:2[blurred];[base][blurred]overlay=${x}:${y}[cleaned];`;
        } else if (blendMode === 'blur') {
          const radius = smoothLevel === 'low' ? 8 : smoothLevel === 'high' ? 22 : 14;
          baseFilter = `[0:v]split[base][to_crop];[to_crop]crop=${w}:${h}:${x}:${y},boxblur=${radius}:3[blurred];[base][blurred]overlay=${x}:${y}[cleaned];`;
        } else {
          baseFilter = `[0:v]delogo=x=${x}:y=${y}:w=${w}:h=${h}[cleaned];`;
        }

        const filterGraph = `${baseFilter}[1:v]scale=${logoScaleW}:${logoScaleH},format=rgba,colorchannelmixer=aa=${logoAlpha}[logo];[cleaned][logo]overlay=${overlayExpr}[outv]`;
        filterArgs = ['-filter_complex', filterGraph, '-map', '[outv]', '-map', '0:a?'];
      } else {
        if (blendMode === 'smooth') {
          const radius = smoothLevel === 'low' ? 4 : smoothLevel === 'high' ? 12 : 7;
          const filterGraph = `[0:v]delogo=x=${x}:y=${y}:w=${w}:h=${h}[delogoed];[delogoed]split[base][to_crop];[to_crop]crop=${w}:${h}:${x}:${y},boxblur=${radius}:2[blurred];[base][blurred]overlay=${x}:${y}[outv]`;
          filterArgs = ['-filter_complex', filterGraph, '-map', '[outv]', '-map', '0:a?'];
        } else if (blendMode === 'blur') {
          const radius = smoothLevel === 'low' ? 8 : smoothLevel === 'high' ? 22 : 14;
          const filterGraph = `[0:v]split[base][to_crop];[to_crop]crop=${w}:${h}:${x}:${y},boxblur=${radius}:3[blurred];[base][blurred]overlay=${x}:${y}[outv]`;
          filterArgs = ['-filter_complex', filterGraph, '-map', '[outv]', '-map', '0:a?'];
        } else {
          filterArgs = ['-vf', `delogo=x=${x}:y=${y}:w=${w}:h=${h}`];
        }
      }

      const isHighQuality = qualityMode === 'high';
      const inputArgs = ['-i', inputName];
      if (hasCustomLogo) {
        inputArgs.push('-i', logoName);
      }

      const args = [
        '-y',
        ...inputArgs,
        ...filterArgs,
        '-c:v', 'libx264',
        '-crf', isHighQuality ? '18' : '26',
        '-preset', 'ultrafast',
        '-pix_fmt', 'yuv420p',
        '-threads', '1',
        '-c:a', 'aac',
        '-b:a', '128k',
        outputName,
      ];

      setProgress((prev) => Math.max(prev, 12));
      const ret = await ffmpeg.exec(args);
      if (ret !== 0) {
        const errorDetails = lastLogsRef.current.slice(-8).join('\n');
        throw new Error(`FFmpeg xử lý không thành công (mã lỗi ${ret}).\n\nChi tiết log:\n${errorDetails}`);
      }

      setProgress(98);
      const data = await ffmpeg.readFile(outputName);
      const rawBytes = data instanceof Uint8Array ? data : new Uint8Array(data as any);
      // Copy to clean normal ArrayBuffer so Blob creation never fails with SharedArrayBuffer
      const cleanBuffer = new Uint8Array(rawBytes.length);
      cleanBuffer.set(rawBytes);
      const blob = new Blob([cleanBuffer.buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      setOutputUrl(url);
      setProgress(100);
    } catch (err) {
      console.error('Error processing video:', err);
      const recentLogs = lastLogsRef.current.slice(-6).join('\n');
      alert(`Đã xảy ra lỗi khi xử lý video: ${err instanceof Error ? err.message : String(err)}${recentLogs ? `\n\nLogs:\n${recentLogs}` : ''}`);
    } finally {
      const ffmpeg = ffmpegRef.current;
      try {
        await ffmpeg.deleteFile('input' + (file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.mp4'));
      } catch (e) { }
      try {
        await ffmpeg.deleteFile('output.mp4');
      } catch (e) { }
      try {
        await ffmpeg.deleteFile('custom_logo.png');
      } catch (e) { }

      setIsProcessing(false);
    }
  };

  const startOver = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    removeLogo();
    setFile(null);
    setVideoUrl(null);
    setOutputUrl(null);
    setRect(null);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setShowPreview(true);
    setIsHoldingCompare(false);
  };

  // Check Supabase login session on mount
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setIsAuthChecking(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && isUserApproved(session.user)) {
        setCurrentUser(mapSupabaseUser(session.user));
      } else {
        if (session?.user && !isUserApproved(session.user)) {
          supabase.auth.signOut().catch(() => {});
        }
        setCurrentUser(null);
      }
      setIsAuthChecking(false);
    }).catch(() => {
      setIsAuthChecking(false);
    });

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && isUserApproved(session.user)) {
        setCurrentUser(mapSupabaseUser(session.user));
      } else {
        if (session?.user && !isUserApproved(session.user)) {
          supabase.auth.signOut().catch(() => {});
        }
        setCurrentUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    setCurrentUser(null);
    startOver();
  };

  // Auth Gate: Show loading during session verification
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
          <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
        </div>
        <p className="text-sm font-semibold text-slate-200">Đang xác thực phiên đăng nhập...</p>
        <p className="text-xs text-slate-500 mt-1">Hệ thống bảo mật ClearMark</p>
      </div>
    );
  }

  // Auth Gate: Require login to access any application features
  if (!currentUser) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sticky Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200 px-3.5 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-2xs">
            <Wand2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-gray-900 leading-none">
              ClearMark
            </h1>
            <p className="text-[10px] sm:text-[11px] text-gray-500 hidden sm:block mt-0.5">
              Xóa & Thay thế Watermark Video AI
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {ffmpegLoaded ? (
            <span className="text-[11px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1 bg-green-50 text-green-700 border border-green-200/80 rounded-full flex items-center gap-1.5 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="hidden sm:inline">Engine Ready</span>
            </span>
          ) : loadError ? (
            <span className="text-[11px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full">
              Engine Error
            </span>
          ) : (
            <span className="text-[11px] sm:text-xs font-medium px-2 sm:px-2.5 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-yellow-600" />
              <span className="hidden sm:inline">Đang nạp</span> Engine...
            </span>
          )}

          {/* User Profile Chip & Logout */}
          <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-gray-200">
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-2xs">
                {currentUser.name.charAt(0)}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-bold text-gray-900 leading-tight truncate max-w-[120px]">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-gray-500 capitalize leading-tight">
                  {currentUser.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 sm:p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              title="Đăng xuất khỏi tài khoản"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-8xl mx-auto px-3 sm:px-6 py-4 sm:py-6 md:py-8">
        {!videoUrl ? (
          /* Upload Screen */
          <div className="max-w-3xl mx-auto mt-4 sm:mt-8 md:mt-12">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900">
                Clear Watermark
              </h2>
              <p className="mt-2 sm:mt-3 text-sm sm:text-base text-gray-600 max-w-xl mx-auto">
                Xử lý 100% ngoại tuyến trực tiếp trong trình duyệt web của bạn.
                <br />Riêng tư & an toàn.
              </p>
            </div>

            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={cn(
                "mt-4 sm:mt-6 flex justify-center rounded-2xl border-2 border-dashed px-4 py-12 sm:py-20 md:py-24 transition-all duration-200 ease-in-out cursor-pointer",
                isDragging ? "border-blue-500 bg-blue-50/70 scale-[0.99]" : "border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/20 shadow-xs"
              )}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <div className="text-center pointer-events-none">
                <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 sm:mb-4 shadow-inner">
                  <Video className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>
                <div className="text-sm sm:text-base font-semibold text-gray-800">
                  <span className="text-blue-600 underline underline-offset-2">Chọn video</span> hoặc kéo thả vào đây
                </div>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFile(e.target.files[0]);
                  }}
                />
                <p className="text-xs text-gray-500 mt-1.5">Hỗ trợ MP4, WebM, MOV (Khuyên dùng video dưới 150MB)</p>
              </div>
            </div>
          </div>
        ) : (
          /* Editor / Result Screen */
          <div className="space-y-4 sm:space-y-6">
            {/* Top Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
              <div>
                <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
                  {outputUrl ? 'So sánh kết quả Video' : 'Kéo chọn Watermark & Tùy chỉnh'}
                </h2>
                <p className="text-xs text-gray-500 hidden sm:block">
                  {outputUrl
                    ? 'So sánh video gốc và video sau khi đã xử lý sạch watermark'
                    : 'Kéo thả chuột hoặc ngón tay trên khung video để khoanh vùng watermark cần xóa'}
                </p>
              </div>
              <button
                onClick={startOver}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Chọn video khác</span>
              </button>
            </div>

            {!outputUrl ? (
              /* Before Processing: Responsive 7/5 Grid on Desktop, Stack on Mobile/Tablet */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-7 items-start">
                {/* Left Column (7 cols on Desktop, Full on Tablet/Mobile): Video Player & Controls */}
                <div className="lg:col-span-7 space-y-3 sm:space-y-4">
                  {/* Video Viewport Container */}
                  <div
                    ref={containerRef}
                    className="relative rounded-2xl overflow-hidden bg-black shadow-lg border border-gray-200 aspect-video flex items-center justify-center select-none"
                  >
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      className="absolute max-w-full max-h-full object-contain pointer-events-none"
                      onLoadedMetadata={handleVideoLoaded}
                      onTimeUpdate={() => {
                        if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                      }}
                      onDurationChange={() => {
                        if (videoRef.current) setDuration(videoRef.current.duration);
                      }}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      playsInline
                      autoPlay
                      loop
                      muted={isMuted}
                    />

                    <canvas
                      ref={canvasRef}
                      className="absolute max-w-full max-h-full object-contain cursor-crosshair touch-none z-10"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                  </div>

                  {/* Player Controls Bar */}
                  <div className="bg-gray-900 text-white p-2.5 sm:p-3 rounded-xl flex flex-col gap-2 shadow-sm">
                    {/* Timeline Scrubber */}
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="text-[11px] sm:text-xs font-mono text-gray-300 min-w-8 text-right">
                        {formatTime(currentTime)}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        step={0.05}
                        value={currentTime}
                        onChange={handleSeek}
                        className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                      <span className="text-[11px] sm:text-xs font-mono text-gray-400 min-w-8">
                        {formatTime(duration)}
                      </span>
                    </div>

                    {/* Buttons Row */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={togglePlay}
                          className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                          title={isPlaying ? "Tạm dừng" : "Phát video"}
                        >
                          {isPlaying ? (
                            <>
                              <Pause className="w-3.5 h-3.5 text-blue-400" />
                              <span className="text-[11px] sm:text-xs">Tạm dừng</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
                              <span className="text-[11px] sm:text-xs">Phát</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={toggleMute}
                          className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                          title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
                        >
                          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {rect && rect.width > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => setShowPreview(!showPreview)}
                              className={cn(
                                "px-2 sm:px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium flex items-center gap-1 transition-all border",
                                showPreview
                                  ? "bg-blue-600 border-blue-500 text-white shadow-2xs"
                                  : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                              )}
                              title="Bật/Tắt chế độ xem trước trực tiếp trên video"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{showPreview ? "Preview" : "Tắt preview"}</span>
                            </button>

                            {showPreview && (
                              <button
                                type="button"
                                onMouseDown={() => setIsHoldingCompare(true)}
                                onMouseUp={() => setIsHoldingCompare(false)}
                                onMouseLeave={() => setIsHoldingCompare(false)}
                                onTouchStart={() => setIsHoldingCompare(true)}
                                onTouchEnd={() => setIsHoldingCompare(false)}
                                className={cn(
                                  "px-2 sm:px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium flex items-center gap-1 transition-all select-none border",
                                  isHoldingCompare
                                    ? "bg-amber-600 border-amber-500 text-white ring-2 ring-amber-400/40"
                                    : "bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300 hover:text-white"
                                )}
                                title="Nhấn giữ chuột hoặc ngón tay để xem lại video gốc chưa xóa watermark"
                              >
                                <EyeOff className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{isHoldingCompare ? "Đang xem gốc" : "Giữ xem gốc"}</span>
                                <span className="sm:hidden">{isHoldingCompare ? "Gốc" : "Xem gốc"}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setRect(null)}
                              className="text-[11px] sm:text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-950/40 border border-red-800/40 hover:bg-red-900/40 transition-colors"
                              title="Hủy vùng watermark đã chọn"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Hủy vùng</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column (5 cols on Desktop, Full on Tablet/Mobile): Settings & Action Panel */}
                <div className="lg:col-span-5 bg-white p-3.5 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                  {/* Live Preview Info Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-blue-50/70 p-2.5 sm:p-3 rounded-xl border border-blue-100/90 text-xs">
                    <div className="text-blue-900 flex items-start sm:items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 sm:mt-0" />
                      <span className="leading-snug">
                        {rect && rect.width > 0
                          ? `Đã chọn vùng ${Math.round(rect.width)}x${Math.round(rect.height)}px. Xem trước tức thì thay đổi bên dưới!`
                          : "Kéo thả chuột hoặc ngón tay trên video để khoanh vùng watermark."}
                      </span>
                    </div>
                    {rect && rect.width > 0 && (
                      <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-blue-600 text-white shadow-2xs whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        Live Preview
                      </span>
                    )}
                  </div>

                  {/* Watermark Removal & Blending Method */}
                  <div className="space-y-3 p-3 sm:p-3.5 rounded-xl bg-blue-50/40 border border-blue-100">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                          <Blend className="w-3.5 h-3.5 text-blue-600" />
                          Phương pháp xóa & hòa trộn
                        </label>
                        <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                          {blendMode === 'smooth' ? 'Hòa trộn tự nhiên' : blendMode === 'blur' ? 'Làm mờ mềm mại' : 'Nội suy cơ bản'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* Smooth Inpaint Blend (Recommended) */}
                        <button
                          type="button"
                          onClick={() => {
                            setBlendMode('smooth');
                            setShowPreview(true);
                          }}
                          disabled={isProcessing}
                          className={cn(
                            "flex flex-col items-start p-2.5 rounded-xl border text-left transition-all",
                            blendMode === 'smooth'
                              ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20 shadow-xs"
                              : "border-gray-200 hover:border-gray-300 bg-white"
                          )}
                        >
                          <div className="font-semibold text-xs text-gray-900 flex items-center gap-1.5">
                            <Sparkles className={cn("w-3.5 h-3.5", blendMode === 'smooth' ? "text-blue-600" : "text-gray-400")} />
                            <span>Hòa trộn tự nhiên</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                            Xóa logo & làm mịn triệt tiêu vết lộ (Khuyên dùng)
                          </p>
                        </button>

                        {/* Soft Blur */}
                        <button
                          type="button"
                          onClick={() => {
                            setBlendMode('blur');
                            setShowPreview(true);
                          }}
                          disabled={isProcessing}
                          className={cn(
                            "flex flex-col items-start p-2.5 rounded-xl border text-left transition-all",
                            blendMode === 'blur'
                              ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20 shadow-xs"
                              : "border-gray-200 hover:border-gray-300 bg-white"
                          )}
                        >
                          <div className="font-semibold text-xs text-gray-900 flex items-center gap-1.5">
                            <EyeOff className={cn("w-3.5 h-3.5", blendMode === 'blur' ? "text-blue-600" : "text-gray-400")} />
                            <span>Làm mờ mềm mại</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                            Làm mờ mịn (Soft blur) che logo truyền hình
                          </p>
                        </button>

                        {/* Classic Delogo */}
                        <button
                          type="button"
                          onClick={() => {
                            setBlendMode('delogo');
                            setShowPreview(true);
                          }}
                          disabled={isProcessing}
                          className={cn(
                            "flex flex-col items-start p-2.5 rounded-xl border text-left transition-all",
                            blendMode === 'delogo'
                              ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20 shadow-xs"
                              : "border-gray-200 hover:border-gray-300 bg-white"
                          )}
                        >
                          <div className="font-semibold text-xs text-gray-900 flex items-center gap-1.5">
                            <Layers className={cn("w-3.5 h-3.5", blendMode === 'delogo' ? "text-blue-600" : "text-gray-400")} />
                            <span>Nội suy cơ bản</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                            Thuật toán Delogo lấy mẫu biên truyền thống
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Smooth Level (Only if blendMode !== 'delogo') */}
                    {blendMode !== 'delogo' && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                            <Sliders className="w-3.5 h-3.5 text-blue-600" />
                            Độ làm mịn vết xóa
                          </label>
                          <span className="text-[11px] text-gray-500 font-medium">
                            {smoothLevel === 'low' ? 'Nhẹ (ít mờ)' : smoothLevel === 'high' ? 'Mạnh (mờ sâu)' : 'Vừa (tự nhiên nhất)'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                          {(['low', 'medium', 'high'] as const).map((lvl) => (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => {
                                setSmoothLevel(lvl);
                                setShowPreview(true);
                              }}
                              disabled={isProcessing}
                              className={cn(
                                "py-1.5 px-2.5 rounded-lg border text-xs font-medium text-center transition-all",
                                smoothLevel === lvl
                                  ? "border-blue-600 bg-blue-50 text-blue-700 shadow-2xs font-semibold"
                                  : "border-gray-200 hover:border-gray-300 text-gray-600 bg-white"
                              )}
                            >
                              {lvl === 'low' ? 'Nhẹ' : lvl === 'medium' ? 'Vừa' : 'Mạnh'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Brand Watermark / Custom Logo Overlay Card */}
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 sm:p-3.5 space-y-3">
                    {/* Hidden File Input */}
                    <input
                      type="file"
                      ref={logoInputRef}
                      onChange={handleLogoUpload}
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                    />

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-600 text-white shrink-0">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                            <span>Chèn Logo / Watermark thương hiệu</span>
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded-full">
                              Tùy chọn
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500">
                            Tự động đè chính giữa vị trí logo cũ vừa chọn
                          </p>
                        </div>
                      </div>

                      {/* Toggle switch */}
                      <button
                        type="button"
                        onClick={() => {
                          if (!enableCustomLogo && !logoFile) {
                            logoInputRef.current?.click();
                          } else {
                            setEnableCustomLogo(!enableCustomLogo);
                          }
                          setShowPreview(true);
                        }}
                        className={cn(
                          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden",
                          enableCustomLogo ? "bg-indigo-600" : "bg-gray-300"
                        )}
                        title="Bật/Tắt chèn logo riêng"
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                            enableCustomLogo ? "translate-x-5" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>

                    {/* If custom logo enabled */}
                    {enableCustomLogo && (
                      <div className="space-y-3 pt-2 border-t border-indigo-100 animate-in fade-in duration-200">
                        {/* File upload or Selected file preview */}
                        {!logoFile ? (
                          <button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            className="w-full flex flex-col items-center justify-center p-3.5 sm:p-4 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-xl bg-white text-indigo-700 transition-colors"
                          >
                            <Upload className="w-5 h-5 mb-1.5 text-indigo-600" />
                            <span className="text-xs font-semibold">Tải lên ảnh Logo / Watermark</span>
                            <span className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5">Khuyên dùng ảnh PNG trong suốt</span>
                          </button>
                        ) : (
                          <div className="flex items-center justify-between p-2.5 bg-white border border-indigo-100 rounded-xl">
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              {logoUrl && (
                                <img
                                  src={logoUrl}
                                  alt="Logo preview"
                                  className="w-9 h-9 object-contain bg-gray-100 rounded-lg p-1 border border-gray-200 shrink-0"
                                />
                              )}
                              <div className="truncate">
                                <div className="text-xs font-medium text-gray-900 truncate">
                                  {logoFile.name}
                                </div>
                                <div className="text-[10px] text-gray-400">
                                  {(logoFile.size / 1024).toFixed(1)} KB • Sẵn sàng đè logo cũ
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              <button
                                type="button"
                                onClick={() => logoInputRef.current?.click()}
                                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors"
                              >
                                Đổi ảnh
                              </button>
                              <button
                                type="button"
                                onClick={removeLogo}
                                className="text-xs text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors"
                                title="Xóa logo"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Sliders: Logo Size & Logo Opacity */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Logo Scale */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-semibold text-gray-700">
                                Kích thước: <span className="text-indigo-600 font-bold">{logoScale}%</span>
                              </label>
                              <span className="text-[10px] text-gray-400">chiều rộng video</span>
                            </div>
                            <input
                              type="range"
                              min={5}
                              max={35}
                              step={1}
                              value={logoScale}
                              onChange={(e) => {
                                setLogoScale(parseInt(e.target.value, 10));
                                setShowPreview(true);
                              }}
                              className="w-full accent-indigo-600 cursor-pointer h-2 bg-gray-200 rounded-lg"
                            />
                          </div>

                          {/* Logo Opacity */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-semibold text-gray-700">
                                Độ rõ nét: <span className="text-indigo-600 font-bold">{logoOpacity}%</span>
                              </label>
                              <span className="text-[10px] text-gray-400">độ trong suốt</span>
                            </div>
                            <input
                              type="range"
                              min={10}
                              max={100}
                              step={5}
                              value={logoOpacity}
                              onChange={(e) => {
                                setLogoOpacity(parseInt(e.target.value, 10));
                                setShowPreview(true);
                              }}
                              className="w-full accent-indigo-600 cursor-pointer h-2 bg-gray-200 rounded-lg"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quality Mode Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Chế độ xuất video
                      </label>
                      <span className="text-[11px] font-medium text-gray-400">
                        {qualityMode === 'high' ? 'CRF 18 • Độ nét gốc' : 'CRF 26 • Tối ưu tốc độ'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* High Quality */}
                      <button
                        type="button"
                        onClick={() => setQualityMode('high')}
                        disabled={isProcessing}
                        className={cn(
                          "flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl border text-left transition-all",
                          qualityMode === 'high'
                            ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20 shadow-xs"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        )}
                      >
                        <div className={cn(
                          "p-1.5 rounded-lg shrink-0 mt-0.5",
                          qualityMode === 'high' ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                        )}>
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-gray-900 flex items-center gap-1.5">
                            <span>Chất lượng gốc (HD/4K)</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                            Giữ độ nét gốc 1:1, chi tiết mượt mà
                          </p>
                        </div>
                      </button>

                      {/* Fast Quality */}
                      <button
                        type="button"
                        onClick={() => setQualityMode('fast')}
                        disabled={isProcessing}
                        className={cn(
                          "flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl border text-left transition-all",
                          qualityMode === 'fast'
                            ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20 shadow-xs"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        )}
                      >
                        <div className={cn(
                          "p-1.5 rounded-lg shrink-0 mt-0.5",
                          qualityMode === 'fast' ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                        )}>
                          <Zap className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-gray-900 flex items-center gap-1.5">
                            <span>Xử lý nhanh</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                            Tối đa tốc độ render, tệp nhẹ hơn
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={processVideo}
                    disabled={isProcessing || !ffmpegLoaded || !rect || rect.width === 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 sm:py-3.5 rounded-xl font-bold text-sm sm:text-base text-white shadow-md transition-all bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Đang xử lý ({progress}%)
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-5 h-5" />
                        {enableCustomLogo && logoFile
                          ? "Xóa Watermark & Chèn Logo thương hiệu"
                          : "Xóa & Hòa trộn Watermark"}
                      </>
                    )}
                  </button>

                  {/* Processing Progress Bar */}
                  {isProcessing && (
                    <div className="space-y-1.5 pt-1 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between text-xs font-medium text-gray-600">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                          Đang render từng khung hình video...
                        </span>
                        <span className="font-mono text-blue-600 font-bold">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden shadow-inner">
                        <div
                          className="h-2.5 rounded-full transition-all duration-300 ease-out bg-gradient-to-r from-blue-600 to-indigo-600 relative overflow-hidden"
                          style={{ width: `${Math.max(3, progress)}%` }}
                        >
                          <div className="absolute inset-0 bg-white/30 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* After Processing: Side-by-side Video Comparison on Tablet/Desktop, Stack on Mobile */
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-7 items-start">
                  {/* Original Video */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-gray-400" />
                        Video Gốc (Ban đầu)
                      </span>
                    </div>
                    <div className="relative rounded-2xl overflow-hidden bg-black shadow-md border border-gray-200 aspect-video flex items-center justify-center">
                      <video
                        src={videoUrl || undefined}
                        className="max-w-full max-h-full object-contain"
                        controls
                        playsInline
                      />
                    </div>
                  </div>

                  {/* Cleaned Result Video */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold text-green-700 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Video Đã Xử Lý Sạch Watermark
                      </span>
                      <span className="text-[11px] font-semibold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200 shadow-2xs">
                        Hoàn tất 100%
                      </span>
                    </div>
                    <div className="relative rounded-2xl overflow-hidden bg-black shadow-lg border-2 border-green-500/50 aspect-video flex items-center justify-center">
                      <video
                        src={outputUrl}
                        className="max-w-full max-h-full object-contain"
                        controls
                        playsInline
                        autoPlay
                      />
                    </div>
                  </div>
                </div>

                {/* Download and Next Action Bar */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-gray-950 text-base sm:text-lg">Video của bạn đã sẵn sàng!</h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                      Đã xóa logo thành công với chất lượng cao. Bấm nút bên dưới để tải tệp MP4 về thiết bị của bạn.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
                    <a
                      href={outputUrl}
                      download={`cleaned_${file?.name || 'video.mp4'}`}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-sm transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Tải Video Về Máy (.MP4)
                    </a>
                    <button
                      type="button"
                      onClick={startOver}
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-medium transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Làm video khác
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
