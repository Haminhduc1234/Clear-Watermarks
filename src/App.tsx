import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import {
  Upload,
  Download,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Trash2,
  Wand2,
  Loader2,
  RotateCcw,
  Video,
  Zap,
  Sparkles,
  Blend,
  Layers,
  Eye,
  EyeOff,
  Sliders,
  Image as ImageIcon,
  Check,
  X,
  LogOut,
  Users,
  FileImage,
  Film,
  Move,
  CornerUpLeft,
  CornerUpRight,
  CornerDownLeft,
  CornerDownRight,
  Crosshair,
  Settings,
  Sparkle,
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Type
} from 'lucide-react';
import { cn } from './lib/utils';
import type { User } from './types/auth';
import AuthScreen from './components/AuthScreen';
import AdminUsersModal from './components/AdminUsersModal';
import PreviewResultModal from './components/PreviewResultModal';
import TextOverlayModal, { TextItem } from './components/TextOverlayModal';
import { getSupabase, mapSupabaseUser, isUserApproved } from './lib/supabase';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LogoItem {
  id: string;
  name: string;
  file: File;
  url: string;
  img: HTMLImageElement;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number; // 10 to 100
  aspectRatio: number;
}

export type MediaType = 'video' | 'image';
export type BlendMode = 'smooth' | 'blur' | 'delogo';
export type SmoothLevel = 'low' | 'medium' | 'high';

export default function App() {
  // Authentication states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);

  // Sub-Modals for configuring tools
  const [showWatermarkModal, setShowWatermarkModal] = useState<boolean>(false);
  const [showLogoModal, setShowLogoModal] = useState<boolean>(false);
  const [showTextModal, setShowTextModal] = useState<boolean>(false);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  // Media states (Video & Image)
  const [file, setFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Quality mode: 'high' (Lossless/CRF 18) or 'fast' (Optimized speed/size)
  const [qualityMode, setQualityMode] = useState<'fast' | 'high'>('high');

  // Watermark removal options
  const [blendMode, setBlendMode] = useState<BlendMode>('smooth');
  const [smoothLevel, setSmoothLevel] = useState<SmoothLevel>('medium');
  const [rect, setRect] = useState<Rect | null>(null);

  // Multi-Logo states
  const [logos, setLogos] = useState<LogoItem[]>([]);
  const [selectedLogoId, setSelectedLogoId] = useState<string | null>(null);
  const [hoveredLogoId, setHoveredLogoId] = useState<string | null>(null);
  const [hoveredAction, setHoveredAction] = useState<'move' | 'resize' | 'delete' | 'select' | 'none'>('none');

  const [isDraggingLogo, setIsDraggingLogo] = useState<boolean>(false);
  const [isResizingLogo, setIsResizingLogo] = useState<boolean>(false);
  const logoDragStartRef = useRef<{
    logoId: string;
    mouseX: number;
    mouseY: number;
    initialLogoX: number;
    initialLogoY: number;
  } | null>(null);
  const logoResizeStartRef = useRef<{
    logoId: string;
    mouseX: number;
    mouseY: number;
    initialWidth: number;
    initialHeight: number;
    aspectRatio: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  // Text Overlay states
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [hoveredTextId, setHoveredTextId] = useState<string | null>(null);
  const [isDraggingText, setIsDraggingText] = useState<boolean>(false);
  const textDragStartRef = useRef<{
    textId: string;
    mouseX: number;
    mouseY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

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
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const ffmpegRef = useRef(new FFmpeg());
  const lastLogsRef = useRef<string[]>([]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);

  const hasWatermarkRect = Boolean(rect && rect.width >= 5 && rect.height >= 5);
  const hasLogos = logos.length > 0;
  const hasTexts = texts.length > 0;
  const selectedLogo = logos.find((l) => l.id === selectedLogoId) || null;
  const selectedText = texts.find((t) => t.id === selectedTextId) || null;

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

  // Keyboard shortcut listener (Delete/Backspace to delete selected logo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLogoId) {
          deleteLogo(selectedLogoId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLogoId]);

  // Load FFmpeg in background for video processing
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
            const currentSec = time > 100000 ? time / 1000000 : time;
            const total = durationRef.current;
            if (total > 0) {
              const pct = Math.min(99, Math.max(1, Math.round((currentSec / total) * 100)));
              setProgress((prev) => Math.max(prev, pct));
            }
          }
        });

        ffmpeg.on('log', ({ message }) => {
          if (!message || typeof message !== 'string') return;
          lastLogsRef.current.push(message);
          if (lastLogsRef.current.length > 50) lastLogsRef.current.shift();
          if (!isMounted) return;

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

        await ffmpeg.load({
          coreURL: await toBlobURL('/ffmpeg/core/ffmpeg-core.js', 'text/javascript'),
          wasmURL: await toBlobURL('/ffmpeg/core/ffmpeg-core.wasm', 'application/wasm'),
        });

        if (isMounted) {
          setFfmpegLoaded(true);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error loading FFmpeg:', err);
          setLoadError('Engine video ngoại tuyến chưa sẵn sàng. (Bạn vẫn có thể chỉnh sửa hình ảnh tức thì)');
        }
      }
    };
    load();

    return () => {
      isMounted = false;
      try {
        ffmpeg.terminate();
      } catch (e) { }
    };
  }, []);

  const handleFile = (selectedFile: File) => {
    const isVideo = selectedFile.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi)$/i.test(selectedFile.name);
    const isImage = selectedFile.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(selectedFile.name);

    if (!isVideo && !isImage) {
      alert('Vui lòng chọn tệp video (MP4, MOV, WebM...) hoặc tệp hình ảnh (PNG, JPG, WEBP...)');
      return;
    }

    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);

    const type: MediaType = isVideo ? 'video' : 'image';
    setMediaType(type);
    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setMediaUrl(url);

    setRect(null);
    setOutputUrl(null);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    durationRef.current = 0;
    setIsPlaying(false);
    setShowPreview(true);
    setIsHoldingCompare(false);
    setImageDimensions(null);
    setSelectedLogoId(null);
    setIsDraggingLogo(false);
    setIsResizingLogo(false);
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

  // Coordinate mapping for native pixel resolution
  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return null;

    const canvas = canvasRef.current;
    const canvasRect = canvas.getBoundingClientRect();

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

    let x = clientX - canvasRect.left;
    let y = clientY - canvasRect.top;

    x = Math.max(0, Math.min(x, canvasRect.width));
    y = Math.max(0, Math.min(y, canvasRect.height));

    let nativeW = canvas.width || 1920;
    let nativeH = canvas.height || 1080;

    if (mediaType === 'image' && imageRef.current) {
      nativeW = imageRef.current.naturalWidth || canvas.width;
      nativeH = imageRef.current.naturalHeight || canvas.height;
    } else if (mediaType === 'video' && videoRef.current) {
      nativeW = videoRef.current.videoWidth || canvas.width;
      nativeH = videoRef.current.videoHeight || canvas.height;
    }

    const scaleX = nativeW / canvasRect.width;
    const scaleY = nativeH / canvasRect.height;

    return {
      x: x * scaleX,
      y: y * scaleY,
    };
  };

  // Helper: Hit-test a point against the selected logo's delete button
  const isPointOnDeleteButton = (logo: LogoItem, pos: { x: number; y: number }, canvasW: number) => {
    const btnRadius = Math.max(11, canvasW / 120);
    const btnX = logo.x + logo.width + 4;
    const btnY = logo.y - 4;
    return Math.hypot(pos.x - btnX, pos.y - btnY) <= btnRadius * 1.5;
  };

  // Helper: Hit-test a point against the selected logo's resize handle (bottom-right)
  const isPointOnResizeHandle = (logo: LogoItem, pos: { x: number; y: number }, canvasW: number) => {
    const gripRadius = Math.max(12, canvasW / 100);
    const brX = logo.x + logo.width + 2;
    const brY = logo.y + logo.height + 2;
    return Math.hypot(pos.x - brX, pos.y - brY) <= gripRadius * 1.5;
  };

  // Helper: Hit-test a point inside a logo's bounding box
  const isPointInsideLogo = (logo: LogoItem, pos: { x: number; y: number }) => {
    const margin = 4;
    return (
      pos.x >= logo.x - margin &&
      pos.x <= logo.x + logo.width + margin &&
      pos.y >= logo.y - margin &&
      pos.y <= logo.y + logo.height + margin
    );
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (isProcessing || (outputUrl && mediaType !== 'image')) return;
    const pos = getMousePos(e);
    if (!pos || !canvasRef.current) return;
    const canvasW = canvasRef.current.width;

    // 0. If there is a selected text, check its delete button
    if (selectedText) {
      if (isPointOnTextDeleteButton(selectedText, pos, canvasW)) {
        handleDeleteText(selectedText.id);
        return;
      }
    }

    // 1. Check hit on any text item (topmost first) to select & drag
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      if (isPointInsideText(t, pos)) {
        setSelectedTextId(t.id);
        setSelectedLogoId(null);
        setIsDraggingText(true);
        textDragStartRef.current = {
          textId: t.id,
          mouseX: pos.x,
          mouseY: pos.y,
          initialX: t.x,
          initialY: t.y,
        };
        return;
      }
    }

    // 2. If there is a selected logo, check its control handles
    if (selectedLogo) {
      // Check Delete button hit
      if (isPointOnDeleteButton(selectedLogo, pos, canvasW)) {
        deleteLogo(selectedLogo.id);
        return;
      }

      // Check Resize handle hit (bottom-right corner)
      if (isPointOnResizeHandle(selectedLogo, pos, canvasW)) {
        setIsResizingLogo(true);
        logoResizeStartRef.current = {
          logoId: selectedLogo.id,
          mouseX: pos.x,
          mouseY: pos.y,
          initialWidth: selectedLogo.width,
          initialHeight: selectedLogo.height,
          aspectRatio: selectedLogo.aspectRatio,
          initialX: selectedLogo.x,
          initialY: selectedLogo.y,
        };
        return;
      }
    }

    // 3. Check hit on any logo to select & drag (check topmost logo first)
    for (let i = logos.length - 1; i >= 0; i--) {
      const logo = logos[i];
      if (isPointInsideLogo(logo, pos)) {
        setSelectedLogoId(logo.id);
        setSelectedTextId(null);
        setIsDraggingLogo(true);
        logoDragStartRef.current = {
          logoId: logo.id,
          mouseX: pos.x,
          mouseY: pos.y,
          initialLogoX: logo.x,
          initialLogoY: logo.y,
        };
        return;
      }
    }

    // 4. User clicked on empty canvas: deselect logo & text and allow drawing watermark rect
    setSelectedLogoId(null);
    setSelectedTextId(null);
    startDrawing(pos);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getMousePos(e);
    if (!pos || !canvasRef.current) return;
    const canvasW = canvasRef.current.width;
    const canvasH = canvasRef.current.height;

    // 0. Dragging active text item
    if (isDraggingText && textDragStartRef.current) {
      const ref = textDragStartRef.current;
      const dx = pos.x - ref.mouseX;
      const dy = pos.y - ref.mouseY;

      setTexts((prev) =>
        prev.map((t) => {
          if (t.id !== ref.textId) return t;
          const newX = Math.max(0, Math.min(canvasW - (t.width || 40), Math.round(ref.initialX + dx)));
          const newY = Math.max(0, Math.min(canvasH - (t.height || 20), Math.round(ref.initialY + dy)));
          return { ...t, x: newX, y: newY };
        })
      );
      return;
    }

    // 1. Resizing active logo
    if (isResizingLogo && logoResizeStartRef.current) {
      const ref = logoResizeStartRef.current;
      const dx = pos.x - ref.mouseX;
      let newW = Math.max(20, Math.min(canvasW - ref.initialX, Math.round(ref.initialWidth + dx)));
      let newH = Math.max(10, Math.round(newW / ref.aspectRatio));

      if (ref.initialY + newH > canvasH) {
        newH = canvasH - ref.initialY;
        newW = Math.max(20, Math.round(newH * ref.aspectRatio));
      }

      setLogos((prev) =>
        prev.map((l) => (l.id === ref.logoId ? { ...l, width: newW, height: newH } : l))
      );
      return;
    }

    // 2. Dragging active logo
    if (isDraggingLogo && logoDragStartRef.current) {
      const ref = logoDragStartRef.current;
      const dx = pos.x - ref.mouseX;
      const dy = pos.y - ref.mouseY;

      setLogos((prev) =>
        prev.map((l) => {
          if (l.id !== ref.logoId) return l;
          const newX = Math.max(0, Math.min(canvasW - l.width, Math.round(ref.initialLogoX + dx)));
          const newY = Math.max(0, Math.min(canvasH - l.height, Math.round(ref.initialLogoY + dy)));
          return { ...l, x: newX, y: newY };
        })
      );
      return;
    }

    // 3. Drawing watermark rect
    if (isDrawing && startPos) {
      setRect({
        x: Math.min(startPos.x, pos.x),
        y: Math.min(startPos.y, pos.y),
        width: Math.abs(pos.x - startPos.x),
        height: Math.abs(pos.y - startPos.y),
      });
      return;
    }

    // 4. Hover detection when idle (for custom cursor & handles highlight)
    if (!('touches' in e)) {
      if (selectedText) {
        if (isPointOnTextDeleteButton(selectedText, pos, canvasW)) {
          setHoveredAction('delete');
          setHoveredTextId(selectedText.id);
          return;
        }
        if (isPointInsideText(selectedText, pos)) {
          setHoveredAction('move');
          setHoveredTextId(selectedText.id);
          return;
        }
      }

      // Check hover on any text item
      for (let i = texts.length - 1; i >= 0; i--) {
        const t = texts[i];
        if (isPointInsideText(t, pos)) {
          setHoveredAction('select');
          setHoveredTextId(t.id);
          return;
        }
      }

      if (selectedLogo) {
        if (isPointOnDeleteButton(selectedLogo, pos, canvasW)) {
          setHoveredAction('delete');
          setHoveredLogoId(selectedLogo.id);
          return;
        }
        if (isPointOnResizeHandle(selectedLogo, pos, canvasW)) {
          setHoveredAction('resize');
          setHoveredLogoId(selectedLogo.id);
          return;
        }
        if (isPointInsideLogo(selectedLogo, pos)) {
          setHoveredAction('move');
          setHoveredLogoId(selectedLogo.id);
          return;
        }
      }

      // Check other logos
      for (let i = logos.length - 1; i >= 0; i--) {
        const logo = logos[i];
        if (isPointInsideLogo(logo, pos)) {
          setHoveredAction('select');
          setHoveredLogoId(logo.id);
          return;
        }
      }

      setHoveredAction('none');
      setHoveredLogoId(null);
      setHoveredTextId(null);
    }
  };

  const handlePointerUp = () => {
    if (isDraggingText) {
      setIsDraggingText(false);
      textDragStartRef.current = null;
    }
    if (isResizingLogo) {
      setIsResizingLogo(false);
      logoResizeStartRef.current = null;
    }
    if (isDraggingLogo) {
      setIsDraggingLogo(false);
      logoDragStartRef.current = null;
    }
    setIsDrawing(false);
    if (rect && (rect.width < 5 || rect.height < 5)) {
      setRect(null);
    } else if (rect && rect.width >= 5 && rect.height >= 5) {
      setShowPreview(true);
    }
  };

  const startDrawing = (pos: { x: number; y: number }) => {
    setIsDrawing(true);
    setStartPos(pos);
    setRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  // Upload one or multiple logos continuously
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let canvasW = 1920;
    let canvasH = 1080;
    if (canvasRef.current) {
      canvasW = canvasRef.current.width;
      canvasH = canvasRef.current.height;
    } else if (mediaType === 'image' && imageRef.current) {
      canvasW = imageRef.current.naturalWidth || 1920;
      canvasH = imageRef.current.naturalHeight || 1080;
    } else if (mediaType === 'video' && videoRef.current) {
      canvasW = videoRef.current.videoWidth || 1920;
      canvasH = videoRef.current.videoHeight || 1080;
    }

    const fileList: File[] = Array.from(files);

    fileList.forEach((selected, index) => {
      if (!selected.type.startsWith('image/')) {
        alert(`Tệp "${selected.name}" không phải là ảnh hợp lệ.`);
        return;
      }

      const url = URL.createObjectURL(selected);
      const img = new Image();

      img.onload = () => {
        const nw = img.naturalWidth || 200;
        const nh = img.naturalHeight || 200;
        const aspect = nw / nh;

        // Default width is ~18% of canvas width
        const initW = Math.max(40, Math.round(canvasW * 0.18));
        const initH = Math.max(20, Math.round(initW / aspect));

        // Stagger positions if multiple logos
        const offset = ((logos.length + index) * 35) % Math.max(60, Math.round(canvasW * 0.25));
        const initX = Math.max(10, Math.min(canvasW - initW - 10, Math.round((canvasW - initW) / 2) + offset));
        const initY = Math.max(10, Math.min(canvasH - initH - 10, Math.round((canvasH - initH) / 2) + offset));

        const newLogo: LogoItem = {
          id: 'logo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          name: selected.name,
          file: selected,
          url,
          img,
          x: initX,
          y: initY,
          width: initW,
          height: initH,
          opacity: 100,
          aspectRatio: aspect,
        };

        setLogos((prev) => [...prev, newLogo]);
        setSelectedLogoId(newLogo.id);
        setShowPreview(true);
      };

      img.src = url;
    });

    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  // Delete a specific logo
  const deleteLogo = (id: string) => {
    setLogos((prev) => {
      const target = prev.find((l) => l.id === id);
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((l) => l.id !== id);
    });
    if (selectedLogoId === id) {
      setSelectedLogoId(null);
    }
  };

  // Clear all logos
  const clearAllLogos = () => {
    logos.forEach((l) => {
      if (l.url) URL.revokeObjectURL(l.url);
    });
    setLogos([]);
    setSelectedLogoId(null);
  };

  // Helper: Draw custom text item on canvas
  const drawTextItemOnCanvas = (
    ctx: CanvasRenderingContext2D,
    item: TextItem,
    isSelected: boolean = false,
    isHovered: boolean = false,
    canvasW: number = 1920
  ): { width: number; height: number } => {
    ctx.save();
    const opacity = Math.max(0.1, Math.min(1.0, (item.opacity || 100) / 100));
    ctx.globalAlpha = opacity;

    const fontStyle = item.isItalic ? 'italic' : 'normal';
    const fontWeight = item.isBold ? 'bold' : 'normal';
    ctx.font = `${fontStyle} ${fontWeight} ${item.fontSize}px ${item.fontFamily || 'sans-serif'}`;
    ctx.textBaseline = 'top';

    const metrics = ctx.measureText(item.text || 'Chữ mẫu');
    const textW = Math.ceil(metrics.width);
    const textH = Math.ceil(item.fontSize * 1.18);
    const pad = item.bgColor !== 'transparent' ? (item.bgPadding || 10) : 4;
    const boxW = textW + pad * 2;
    const boxH = textH + pad * 2;

    // 1. Background Badge
    if (item.bgColor && item.bgColor !== 'transparent') {
      ctx.fillStyle = item.bgColor;
      ctx.beginPath();
      const r = Math.min(item.bgRadius || 8, boxH / 2, boxW / 2);
      if ('roundRect' in ctx && typeof ctx.roundRect === 'function') {
        ctx.roundRect(item.x, item.y, boxW, boxH, r);
      } else {
        ctx.rect(item.x, item.y, boxW, boxH);
      }
      ctx.fill();
    }

    // 2. Drop Shadow
    if (item.shadowColor && item.shadowColor !== 'transparent') {
      ctx.shadowColor = item.shadowColor;
      ctx.shadowBlur = Math.max(3, Math.round(item.fontSize * 0.12));
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    }

    // 3. Text Stroke / Outline
    if (item.strokeColor && item.strokeColor !== 'transparent' && (item.strokeWidth || 0) > 0) {
      ctx.strokeStyle = item.strokeColor;
      ctx.lineWidth = item.strokeWidth || 2;
      ctx.strokeText(item.text, item.x + pad, item.y + pad + (item.fontSize * 0.05));
    }

    // 4. Text Fill
    ctx.fillStyle = item.color || '#ffffff';
    ctx.fillText(item.text, item.x + pad, item.y + pad + (item.fontSize * 0.05));

    // 5. Underline
    if (item.isUnderline) {
      ctx.beginPath();
      ctx.strokeStyle = item.color || '#ffffff';
      ctx.lineWidth = Math.max(1.5, Math.round(item.fontSize / 16));
      const lineY = item.y + pad + textH + 1;
      ctx.moveTo(item.x + pad, lineY);
      ctx.lineTo(item.x + pad + textW, lineY);
      ctx.stroke();
    }

    ctx.restore();

    // 6. Interactive Selection Frame (Only if showPreview & not holding compare)
    if (!isDrawing && showPreview && !isHoldingCompare) {
      if (isSelected) {
        ctx.save();
        const strokeW = Math.max(2, canvasW / 420);

        // Bounding frame
        ctx.strokeStyle = '#9333ea';
        ctx.lineWidth = strokeW;
        ctx.setLineDash(isDraggingText ? [] : [6, 4]);
        ctx.strokeRect(item.x - 2, item.y - 2, boxW + 4, boxH + 4);

        // Subtle background tint
        ctx.fillStyle = 'rgba(147, 51, 234, 0.08)';
        ctx.fillRect(item.x - 2, item.y - 2, boxW + 4, boxH + 4);

        // Top-Right DELETE BUTTON
        const delRadius = Math.max(10, strokeW * 4.2);
        const delX = item.x + boxW + 4;
        const delY = item.y - 4;
        ctx.beginPath();
        ctx.arc(delX, delY, delRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const crossSize = delRadius * 0.42;
        ctx.moveTo(delX - crossSize, delY - crossSize);
        ctx.lineTo(delX + crossSize, delY + crossSize);
        ctx.moveTo(delX + crossSize, delY - crossSize);
        ctx.lineTo(delX - crossSize, delY + crossSize);
        ctx.stroke();

        // Info Badge Top-Left
        const badgeText = isDraggingText
          ? '✥ Đang di chuyển chữ...'
          : `✎ ${item.text.length > 16 ? item.text.substring(0, 14) + '...' : item.text} (${item.fontSize}px)`;

        drawBadge(
          ctx,
          item.x,
          item.y,
          badgeText,
          isDraggingText ? '#581c87' : '#7e22ce',
          canvasW
        );

        ctx.restore();
      } else if (isHovered) {
        ctx.save();
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(item.x - 1, item.y - 1, boxW + 2, boxH + 2);
        drawBadge(ctx, item.x, item.y, `Click chọn chữ: ${item.text}`, '#a855f7', canvasW);
        ctx.restore();
      }
    }

    return { width: boxW, height: boxH };
  };

  // Helper: Hit-test a point inside a text item's bounding box
  const isPointInsideText = (item: TextItem, pos: { x: number; y: number }) => {
    const margin = 6;
    const w = item.width || 120;
    const h = item.height || 40;
    return (
      pos.x >= item.x - margin &&
      pos.x <= item.x + w + margin &&
      pos.y >= item.y - margin &&
      pos.y <= item.y + h + margin
    );
  };

  // Helper: Hit-test a point on text's delete button
  const isPointOnTextDeleteButton = (item: TextItem, pos: { x: number; y: number }, canvasW: number) => {
    const strokeW = Math.max(2, canvasW / 420);
    const delRadius = Math.max(10, strokeW * 4.2);
    const delX = item.x + (item.width || 120) + 4;
    const delY = item.y - 4;
    return Math.hypot(pos.x - delX, pos.y - delY) <= delRadius * 1.5;
  };

  const handleAddText = (newText: TextItem) => {
    setTexts((prev) => [...prev, newText]);
  };

  const handleUpdateText = (id: string, updates: Partial<TextItem>) => {
    setTexts((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const handleDeleteText = (id: string) => {
    setTexts((prev) => prev.filter((t) => t.id !== id));
    if (selectedTextId === id) setSelectedTextId(null);
  };

  const clearAllTexts = () => {
    setTexts([]);
    setSelectedTextId(null);
  };

  // Update selected logo scale (%)
  const updateSelectedLogoScale = (scalePct: number) => {
    if (!selectedLogoId || !canvasRef.current) return;
    const canvasW = canvasRef.current.width;
    const canvasH = canvasRef.current.height;

    setLogos((prev) =>
      prev.map((l) => {
        if (l.id !== selectedLogoId) return l;
        const newW = Math.max(20, Math.min(canvasW - l.x, Math.round(canvasW * (scalePct / 100))));
        let newH = Math.max(10, Math.round(newW / l.aspectRatio));
        if (l.y + newH > canvasH) {
          newH = canvasH - l.y;
        }
        return { ...l, width: newW, height: newH };
      })
    );
  };

  // Update selected logo opacity (%)
  const updateSelectedLogoOpacity = (opacityPct: number) => {
    if (!selectedLogoId) return;
    setLogos((prev) =>
      prev.map((l) => (l.id === selectedLogoId ? { ...l, opacity: opacityPct } : l))
    );
  };

  // Preset logo placement for selected logo
  const setLogoPositionPreset = (
    logoId: string,
    preset: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
  ) => {
    let canvasW = 1920;
    let canvasH = 1080;
    if (canvasRef.current) {
      canvasW = canvasRef.current.width;
      canvasH = canvasRef.current.height;
    } else if (mediaType === 'image' && imageRef.current) {
      canvasW = imageRef.current.naturalWidth || 1920;
      canvasH = imageRef.current.naturalHeight || 1080;
    } else if (mediaType === 'video' && videoRef.current) {
      canvasW = videoRef.current.videoWidth || 1920;
      canvasH = videoRef.current.videoHeight || 1080;
    }

    setLogos((prev) =>
      prev.map((l) => {
        if (l.id !== logoId) return l;
        const margin = Math.round(Math.min(canvasW, canvasH) * 0.035);
        let newX = l.x;
        let newY = l.y;

        switch (preset) {
          case 'top-left':
            newX = margin;
            newY = margin;
            break;
          case 'top-right':
            newX = canvasW - l.width - margin;
            newY = margin;
            break;
          case 'bottom-left':
            newX = margin;
            newY = canvasH - l.height - margin;
            break;
          case 'bottom-right':
            newX = canvasW - l.width - margin;
            newY = canvasH - l.height - margin;
            break;
          case 'center':
            newX = Math.round((canvasW - l.width) / 2);
            newY = Math.round((canvasH - l.height) / 2);
            break;
        }

        return {
          ...l,
          x: Math.max(0, Math.min(canvasW - l.width, newX)),
          y: Math.max(0, Math.min(canvasH - l.height, newY)),
        };
      })
    );
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
    source: CanvasImageSource,
    r: Rect,
    mode: BlendMode,
    level: SmoothLevel,
    nativeW: number,
    nativeH: number
  ) => {
    const x = Math.floor(r.x);
    const y = Math.floor(r.y);
    const w = Math.floor(r.width);
    const h = Math.floor(r.height);

    if (w <= 2 || h <= 2) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    if (mode === 'blur') {
      const blurRadius = level === 'low' ? 8 : level === 'high' ? 24 : 14;
      ctx.filter = `blur(${blurRadius}px)`;

      const pad = Math.min(20, Math.floor(w / 4));
      const sx = Math.max(0, x - pad);
      const sy = Math.max(0, y - pad);
      const sw = Math.min(nativeW - sx, w + pad * 2);
      const sh = Math.min(nativeH - sy, h + pad * 2);

      ctx.drawImage(source, sx, sy, sw, sh, sx, sy, sw, sh);
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
        offCtx.drawImage(source, lx, y, borderSize, h, 0, 0, w, h);

        const rx = Math.min(nativeW - borderSize, x + w);
        offCtx.globalAlpha = 0.5;
        offCtx.drawImage(source, rx, y, borderSize, h, 0, 0, w, h);

        const ty = Math.max(0, y - borderSize);
        offCtx.drawImage(source, x, ty, w, borderSize, 0, 0, w, h);

        const by = Math.min(nativeH - borderSize, y + h);
        offCtx.drawImage(source, x, by, w, borderSize, 0, 0, w, h);

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
  };

  // Main canvas render function with live preview & multi-logos
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let sourceElem: HTMLVideoElement | HTMLImageElement | null = null;
    let nativeW = 0;
    let nativeH = 0;

    if (mediaType === 'image') {
      const img = imageRef.current;
      if (!img || !img.complete || img.naturalWidth === 0) return;
      sourceElem = img;
      nativeW = img.naturalWidth;
      nativeH = img.naturalHeight;
    } else if (mediaType === 'video') {
      const vid = videoRef.current;
      if (!vid || vid.readyState < 2) return;
      sourceElem = vid;
      nativeW = vid.videoWidth;
      nativeH = vid.videoHeight;
    }

    if (!sourceElem || !nativeW || !nativeH) return;

    if (canvas.width !== nativeW || canvas.height !== nativeH) {
      canvas.width = nativeW;
      canvas.height = nativeH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // If drawing or preview disabled or user is holding to compare original:
    if (isDrawing || !showPreview || isHoldingCompare) {
      ctx.drawImage(sourceElem, 0, 0, canvas.width, canvas.height);

      if (rect && rect.width > 0 && rect.height > 0) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.28)';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = Math.max(2, canvas.width / 320);
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

        if (isHoldingCompare) {
          const originalLabel = mediaType === 'image' ? '👁️ Ảnh gốc (Chưa xóa)' : '👁️ Video gốc (Chưa xóa)';
          drawBadge(ctx, rect.x, rect.y, originalLabel, '#ea580c', canvas.width);
        }
      }
      return;
    }

    // 1. Draw full source media
    ctx.drawImage(sourceElem, 0, 0, canvas.width, canvas.height);

    // 2. Inpaint simulated preview (ONLY IF user drew a watermark rect)
    if (rect && rect.width > 0 && rect.height > 0) {
      renderPreviewPatch(ctx, sourceElem, rect, blendMode, smoothLevel, nativeW, nativeH);
    }

    // 3. Render all custom logos sequentially
    logos.forEach((logo) => {
      if (!logo.img || !logo.img.complete) return;

      // Draw logo image
      ctx.save();
      ctx.globalAlpha = Math.max(0.05, Math.min(1.0, logo.opacity / 100));
      ctx.drawImage(logo.img, logo.x, logo.y, logo.width, logo.height);
      ctx.restore();

      // If in interactive editor preview mode:
      if (!isDrawing && showPreview && !isHoldingCompare) {
        const isSelected = logo.id === selectedLogoId;
        const isHovered = logo.id === hoveredLogoId;

        if (isSelected) {
          ctx.save();
          const strokeW = Math.max(2, canvas.width / 420);

          // Bounding frame
          ctx.strokeStyle = '#4f46e5';
          ctx.lineWidth = strokeW;
          ctx.setLineDash(isDraggingLogo || isResizingLogo ? [] : [6, 4]);
          ctx.strokeRect(logo.x - 2, logo.y - 2, logo.width + 4, logo.height + 4);

          // Subtle background tint
          ctx.fillStyle = 'rgba(79, 70, 229, 0.12)';
          ctx.fillRect(logo.x - 2, logo.y - 2, logo.width + 4, logo.height + 4);

          // 3 Corner grip dots (Top-Left, Top-Right, Bottom-Left)
          const gripSize = Math.max(6, strokeW * 2.8);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#4338ca';
          ctx.lineWidth = 1.5;

          const cornerPoints = [
            { x: logo.x - 2, y: logo.y - 2 },
            { x: logo.x + logo.width + 2, y: logo.y - 2 },
            { x: logo.x - 2, y: logo.y + logo.height + 2 },
          ];
          cornerPoints.forEach((pt) => {
            ctx.fillRect(pt.x - gripSize / 2, pt.y - gripSize / 2, gripSize, gripSize);
            ctx.strokeRect(pt.x - gripSize / 2, pt.y - gripSize / 2, gripSize, gripSize);
          });

          // Bottom-Right RESIZE HANDLE (Primary grip for proportional zooming)
          const brX = logo.x + logo.width + 2;
          const brY = logo.y + logo.height + 2;
          const resizeGripSize = Math.max(10, gripSize * 1.5);
          ctx.fillStyle = isResizingLogo ? '#312e81' : '#4f46e5';
          ctx.fillRect(brX - resizeGripSize / 2, brY - resizeGripSize / 2, resizeGripSize, resizeGripSize);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.strokeRect(brX - resizeGripSize / 2, brY - resizeGripSize / 2, resizeGripSize, resizeGripSize);

          // Top-Right DELETE BUTTON (Circular Red Badge with '×')
          const delRadius = Math.max(10, strokeW * 4.2);
          const delX = logo.x + logo.width + 4;
          const delY = logo.y - 4;
          ctx.beginPath();
          ctx.arc(delX, delY, delRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // '×' symbol inside delete badge
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const crossSize = delRadius * 0.42;
          ctx.moveTo(delX - crossSize, delY - crossSize);
          ctx.lineTo(delX + crossSize, delY + crossSize);
          ctx.moveTo(delX + crossSize, delY - crossSize);
          ctx.lineTo(delX - crossSize, delY + crossSize);
          ctx.stroke();

          // Info Badge Top-Left
          const badgeText = isDraggingLogo
            ? '✥ Đang di chuyển logo...'
            : isResizingLogo
              ? `⤡ Thu phóng (${Math.round(logo.width)}×${Math.round(logo.height)})`
              : `✥ ${logo.name.length > 14 ? logo.name.substring(0, 12) + '...' : logo.name} (${Math.round(logo.width)}×${Math.round(logo.height)})`;

          drawBadge(
            ctx,
            logo.x,
            logo.y,
            badgeText,
            isDraggingLogo || isResizingLogo ? '#312e81' : '#4338ca',
            canvas.width
          );

          ctx.restore();
        } else if (isHovered) {
          // Hover state for other logos
          ctx.save();
          ctx.strokeStyle = 'rgba(99, 102, 241, 0.7)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(logo.x - 1, logo.y - 1, logo.width + 2, logo.height + 2);
          drawBadge(ctx, logo.x, logo.y, `Click chọn: ${logo.name}`, '#6366f1', canvas.width);
          ctx.restore();
        }
      }
    });

    // 4. Render all custom text items sequentially
    texts.forEach((textItem) => {
      const isSelected = textItem.id === selectedTextId;
      const isHovered = textItem.id === hoveredTextId;
      const box = drawTextItemOnCanvas(ctx, textItem, isSelected, isHovered, canvas.width);
      textItem.width = box.width;
      textItem.height = box.height;
    });
  }, [
    mediaType,
    rect,
    logos,
    selectedLogoId,
    hoveredLogoId,
    hoveredAction,
    texts,
    selectedTextId,
    hoveredTextId,
    isDraggingText,
    isDrawing,
    showPreview,
    isHoldingCompare,
    blendMode,
    smoothLevel,
    isDraggingLogo,
    isResizingLogo,
  ]);

  // Video playback loop or image reactive render
  useEffect(() => {
    if (!mediaUrl || (outputUrl && mediaType !== 'image')) return;

    if (mediaType === 'image') {
      renderCanvas();
      return;
    }

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
  }, [renderCanvas, mediaUrl, mediaType, outputUrl]);

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

  // Handle image loaded event
  const handleImageLoaded = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (canvas && img) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      renderCanvas();
    }
  };

  // Instant high-resolution Image Inpaint & Watermark/Logo processing
  const processImage = async () => {
    if (!file || !imageRef.current) return;

    try {
      setIsProcessing(true);
      setProgress(15);

      const img = imageRef.current;
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;

      if (!nw || !nh) {
        throw new Error('Kích thước ảnh không hợp lệ.');
      }

      // Create full-resolution offscreen canvas
      const procCanvas = document.createElement('canvas');
      procCanvas.width = nw;
      procCanvas.height = nh;
      const pctx = procCanvas.getContext('2d', { willReadFrequently: true });
      if (!pctx) throw new Error('Không thể khởi tạo bộ xử lý đồ họa ảnh.');

      // 1. Draw base full-resolution image
      pctx.drawImage(img, 0, 0, nw, nh);
      setProgress(40);

      // 2. Perform watermark removal ONLY IF rect is selected
      if (hasWatermarkRect && rect) {
        const x = Math.max(0, Math.floor(rect.x));
        const y = Math.max(0, Math.floor(rect.y));
        const w = Math.min(nw - x, Math.floor(rect.width));
        const h = Math.min(nh - y, Math.floor(rect.height));

        if (w > 2 && h > 2) {
          pctx.save();
          pctx.beginPath();
          pctx.rect(x, y, w, h);
          pctx.clip();

          if (blendMode === 'blur') {
            const blurRadius = smoothLevel === 'low' ? 8 : smoothLevel === 'high' ? 24 : 14;
            pctx.filter = `blur(${blurRadius}px)`;
            const pad = Math.min(24, Math.floor(w / 4));
            const sx = Math.max(0, x - pad);
            const sy = Math.max(0, y - pad);
            const sw = Math.min(nw - sx, w + pad * 2);
            const sh = Math.min(nh - sy, h + pad * 2);
            pctx.drawImage(img, sx, sy, sw, sh, sx, sy, sw, sh);
          } else {
            // Smooth edge-extrapolation inpaint
            const borderSize = Math.max(2, Math.min(8, Math.floor(Math.min(w, h) / 6)));
            const offCanvas = document.createElement('canvas');
            offCanvas.width = Math.max(1, w);
            offCanvas.height = Math.max(1, h);
            const offCtx = offCanvas.getContext('2d');
            if (offCtx) {
              const lx = Math.max(0, x - borderSize);
              offCtx.drawImage(img, lx, y, borderSize, h, 0, 0, w, h);

              const rx = Math.min(nw - borderSize, x + w);
              offCtx.globalAlpha = 0.5;
              offCtx.drawImage(img, rx, y, borderSize, h, 0, 0, w, h);

              const ty = Math.max(0, y - borderSize);
              offCtx.drawImage(img, x, ty, w, borderSize, 0, 0, w, h);

              const by = Math.min(nh - borderSize, y + h);
              offCtx.drawImage(img, x, by, w, borderSize, 0, 0, w, h);

              offCtx.globalAlpha = 1.0;

              const blurRadius =
                blendMode === 'smooth'
                  ? smoothLevel === 'low'
                    ? 4
                    : smoothLevel === 'high'
                      ? 12
                      : 7
                  : 1;
              pctx.filter = `blur(${blurRadius}px)`;
              pctx.drawImage(offCanvas, x, y, w, h);
            }
          }
          pctx.restore();
        }
      }

      setProgress(65);

      // 3. Overlay all custom logos sequentially
      logos.forEach((logo) => {
        if (!logo.img || !logo.img.complete) return;
        pctx.save();
        pctx.globalAlpha = Math.max(0.05, Math.min(1.0, logo.opacity / 100));
        pctx.drawImage(logo.img, logo.x, logo.y, logo.width, logo.height);
        pctx.restore();
      });

      // 3.5. Overlay all custom text items sequentially
      texts.forEach((textItem) => {
        drawTextItemOnCanvas(pctx, textItem, false, false, nw);
      });

      setProgress(85);

      // 4. Export to high-quality Blob
      const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
      const isWebp = file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp');
      const mime = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';
      const quality = qualityMode === 'high' ? 0.98 : 0.85;

      const blob = await new Promise<Blob | null>((resolve) => {
        procCanvas.toBlob((b) => resolve(b), mime, quality);
      });

      if (!blob) throw new Error('Không thể xuất tệp ảnh sau khi xử lý.');

      const url = URL.createObjectURL(blob);
      setOutputUrl(url);
      setProgress(100);
    } catch (err) {
      console.error('Error processing image:', err);
      alert(`Đã xảy ra lỗi khi xử lý ảnh: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Video processing pipeline via FFmpeg WASM supporting multi-logos
  const processVideo = async () => {
    if (!file || !ffmpegLoaded) return;
    if (!hasWatermarkRect && !hasLogos) return;

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

      await ffmpeg.writeFile(inputName, await fetchFile(file));
      setProgress(6);

      // Write each logo to FFmpeg virtual FS
      for (let i = 0; i < logos.length; i++) {
        await ffmpeg.writeFile(`custom_logo_${i}.png`, await fetchFile(logos[i].file));
      }
      setProgress(10);

      const video = videoRef.current;
      const vw = video?.videoWidth || 1920;
      const vh = video?.videoHeight || 1080;

      let filterGraph = '';
      let currentV = '[0:v]';

      // 1. Watermark removal filter (ONLY IF user selected a watermark rect)
      if (hasWatermarkRect && rect) {
        const pad = 2;
        let x = Math.max(pad, Math.floor(rect.x));
        let y = Math.max(pad, Math.floor(rect.y));
        let w = Math.max(8, Math.floor(rect.width));
        let h = Math.max(8, Math.floor(rect.height));
        if (w % 2 !== 0) w += 1;
        if (h % 2 !== 0) h += 1;

        if (w > vw - pad * 2) {
          w = Math.max(8, (vw - pad * 2) % 2 === 0 ? vw - pad * 2 : vw - pad * 2 - 1);
        }
        if (h > vh - pad * 2) {
          h = Math.max(8, (vh - pad * 2) % 2 === 0 ? vh - pad * 2 : vh - pad * 2 - 1);
        }
        x = Math.max(pad, Math.min(x, vw - w - pad));
        y = Math.max(pad, Math.min(y, vh - h - pad));

        if (blendMode === 'smooth') {
          const radius = smoothLevel === 'low' ? 4 : smoothLevel === 'high' ? 12 : 7;
          filterGraph += `[0:v]delogo=x=${x}:y=${y}:w=${w}:h=${h}[delogoed];[delogoed]split[base][to_crop];[to_crop]crop=${w}:${h}:${x}:${y},boxblur=${radius}:2[blurred];[base][blurred]overlay=${x}:${y}[v_clean];`;
          currentV = '[v_clean]';
        } else if (blendMode === 'blur') {
          const radius = smoothLevel === 'low' ? 8 : smoothLevel === 'high' ? 22 : 14;
          filterGraph += `[0:v]split[base][to_crop];[to_crop]crop=${w}:${h}:${x}:${y},boxblur=${radius}:3[blurred];[base][blurred]overlay=${x}:${y}[v_clean];`;
          currentV = '[v_clean]';
        } else {
          filterGraph += `[0:v]delogo=x=${x}:y=${y}:w=${w}:h=${h}[v_clean];`;
          currentV = '[v_clean]';
        }
      }

      // 2. Overlay each logo sequentially
      for (let i = 0; i < logos.length; i++) {
        const l = logos[i];
        let lw = Math.max(4, Math.round(l.width));
        let lh = Math.max(4, Math.round(l.height));
        if (lw % 2 !== 0) lw += 1;
        if (lh % 2 !== 0) lh += 1;

        let lx = Math.max(0, Math.min(vw - lw, Math.round(l.x)));
        let ly = Math.max(0, Math.min(vh - lh, Math.round(l.y)));
        const alpha = (l.opacity / 100).toFixed(2);

        const logoInputIdx = i + 1; // 0 is video input, 1..N are logos
        const logoLabel = `[logo_${i}]`;
        const nextV = (i === logos.length - 1) ? '[outv]' : `[v_overlay_${i}]`;

        // Scale and opacity filter for logo
        filterGraph += `[${logoInputIdx}:v]scale=${lw}:${lh},format=rgba,colorchannelmixer=aa=${alpha}${logoLabel};`;
        // Overlay logo onto current video stream
        filterGraph += `${currentV}${logoLabel}overlay=${lx}:${ly}:eof_action=repeat${nextV};`;
        currentV = nextV;
      }

      // If only watermark removal and no logos
      if (hasWatermarkRect && logos.length === 0) {
        if (filterGraph.endsWith(';')) filterGraph = filterGraph.slice(0, -1);
        filterGraph = filterGraph.replace(/\[v_clean\]$/, '[outv]');
      } else if (filterGraph.endsWith(';')) {
        filterGraph = filterGraph.slice(0, -1);
      }

      const inputArgs = ['-i', inputName];
      for (let i = 0; i < logos.length; i++) {
        inputArgs.push('-i', `custom_logo_${i}.png`);
      }

      const isHighQuality = qualityMode === 'high';
      const args = [
        '-y',
        ...inputArgs,
        '-filter_complex', filterGraph,
        '-map', '[outv]',
        '-map', '0:a?',
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
      for (let i = 0; i < logos.length; i++) {
        try {
          await ffmpeg.deleteFile(`custom_logo_${i}.png`);
        } catch (e) { }
      }

      setIsProcessing(false);
    }
  };

  const handleProcess = () => {
    setShowPreviewModal(true);
    if (mediaType === 'image') {
      processImage();
    } else {
      processVideo();
    }
  };

  const handleOpenPreviewModal = async () => {
    if (!file) return;
    setShowPreviewModal(true);
    if (mediaType === 'image') {
      await processImage();
    } else if (mediaType === 'video') {
      if (!outputUrl && (hasWatermarkRect || hasLogos)) {
        await processVideo();
      }
    }
  };

  const handleClosePreviewModal = () => {
    setShowPreviewModal(false);
    if (mediaType === 'image') {
      setOutputUrl(null);
    }
  };

  const startOver = () => {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    clearAllLogos();
    clearAllTexts();
    setFile(null);
    setMediaType(null);
    setMediaUrl(null);
    setOutputUrl(null);
    setRect(null);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setShowPreview(true);
    setIsHoldingCompare(false);
    setImageDimensions(null);
    setShowPreviewModal(false);
  };

  const canProcess = () => {
    if (isProcessing) return false;
    if (mediaType === 'video' && !ffmpegLoaded) return false;
    return hasWatermarkRect || hasLogos || hasTexts;
  };

  const getActionButtonText = () => {
    if (isProcessing) {
      return `Đang xử lý ${mediaType === 'image' ? 'ảnh' : 'video'} (${progress}%)`;
    }
    const actions: string[] = [];
    if (hasWatermarkRect) actions.push('Xóa Watermark');
    if (hasLogos) actions.push(`Chèn ${logos.length} Logo`);
    if (hasTexts) actions.push(`Chèn ${texts.length} Chữ`);

    if (actions.length > 0) {
      return actions.join(' & ') + (mediaType === 'image' ? ' cho ảnh' : ' cho video');
    }
    return 'Chọn công cụ bên dưới để bắt đầu chỉnh sửa';
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
          supabase.auth.signOut().catch(() => { });
        }
        setCurrentUser(null);
      }
      setIsAuthChecking(false);
    }).catch(() => {
      setIsAuthChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && isUserApproved(session.user)) {
        setCurrentUser(mapSupabaseUser(session.user));
      } else {
        if (session?.user && !isUserApproved(session.user)) {
          supabase.auth.signOut().catch(() => { });
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

  const handleSignOut = async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setCurrentUser(null);
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Đang kiểm tra thông tin phiên đăng nhập...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20 text-gray-900 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-gray-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight bg-gradient-to-r from-gray-900 via-blue-950 to-indigo-900 bg-clip-text text-transparent">
                  ClearMark
                </span>
                <span className="text-[9px] sm:text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 sm:px-2 py-0.5 rounded-full border border-blue-200 shrink-0">
                  Video & Ảnh Pro
                </span>
              </div>
              <p className="text-[11px] text-gray-500 leading-none mt-0.5 hidden sm:block truncate">
                Xóa watermark thông minh • Chèn logo thương hiệu tùy biến
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {currentUser.role === 'admin' && (
              <button
                type="button"
                onClick={() => setShowAdminModal(true)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors shadow-2xs cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Quản lý thành viên</span>
                <span className="sm:hidden">Quản lý</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-gray-200 text-xs">
              <div className="hidden sm:flex flex-col text-right">
                <span className="font-bold text-gray-800 leading-tight">
                  {currentUser.fullName || currentUser.email.split('@')[0]}
                </span>
                <span className="text-[10px] text-gray-400 capitalize">
                  {currentUser.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="p-1.5 sm:p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-6 lg:p-8 flex justify-center">
        {!file ? (
          /* Empty State: File Upload Box */
          <div className="max-w-2xl mx-auto w-full">
            <div className="text-center mb-5 sm:mb-8">
              <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
                Xóa Watermark & Chèn Logo
              </h1>
              <p className="text-xs sm:text-base text-gray-600 mt-1.5 sm:mt-2 max-w-lg mx-auto">
                Hỗ trợ chỉnh sửa cả <strong>hình ảnh</strong> và <strong>video</strong>. Tách rời hoàn toàn tính năng xóa watermark và chèn logo.
              </p>
            </div>

            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={cn(
                "relative border-2 border-dashed rounded-2xl sm:rounded-3xl p-6 sm:p-12 text-center transition-all bg-white/70 backdrop-blur-xs cursor-pointer shadow-sm hover:shadow-md",
                isDragging ? "border-blue-500 bg-blue-50/50 scale-[1.01]" : "border-gray-300 hover:border-blue-400"
              )}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <div className="flex flex-col items-center">
                <div className="mx-auto flex items-center justify-center gap-2 mb-3 sm:mb-4">
                  <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
                    <Video className="w-5 h-5 sm:w-7 sm:h-7" />
                  </div>
                  <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                    <ImageIcon className="w-5 h-5 sm:w-7 sm:h-7" />
                  </div>
                </div>

                <div className="text-sm sm:text-base font-semibold text-gray-800">
                  <span className="text-blue-600 underline underline-offset-2">Chọn video hoặc hình ảnh</span> hoặc kéo thả vào đây
                </div>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  accept="video/*,image/*"
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFile(e.target.files[0]);
                  }}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Hỗ trợ MP4, MOV, WebM, PNG, JPG, JPEG, WEBP (Khuyên dùng video dưới 150MB)
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Editor / Result Screen: Spacious & Focused Studio View */
          <div className="max-w-5xl mx-auto space-y-3.5 sm:space-y-5">
            {/* Top Bar with Media Summary */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-lg md:text-xl font-bold text-gray-900 truncate">
                    {outputUrl
                      ? (mediaType === 'image' ? 'So sánh kết quả Hình ảnh' : 'So sánh kết quả Video')
                      : 'Studio chỉnh sửa Watermark & Logo'}
                  </h2>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0",
                    mediaType === 'image' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"
                  )}>
                    {mediaType === 'image' ? '🖼️ Chế độ Ảnh' : '🎬 Chế độ Video'}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 hidden xs:block">
                  {outputUrl && mediaType !== 'image'
                    ? 'So sánh tệp gốc và thành phẩm sau khi hoàn tất xử lý.'
                    : 'Bấm nút "Xóa watermark", "Chèn logo" hoặc "Chèn chữ" bên dưới để thiết lập.'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={startOver}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 border border-gray-200 px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors shadow-2xs cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{mediaType === 'image' ? 'Ảnh khác' : 'Video khác'}</span>
                </button>
              </div>
            </div>

            {!outputUrl || mediaType === 'image' ? (
              /* Before Processing: Large Viewport + Dedicated Studio Action Strip */
              <div className="space-y-3 sm:space-y-4">
                {/* Viewport Container */}
                <div
                  ref={containerRef}
                  style={
                    mediaType === 'image' && imageDimensions
                      ? { aspectRatio: `${imageDimensions.width} / ${imageDimensions.height}`, maxHeight: '68vh' }
                      : undefined
                  }
                  className={cn(
                    "relative rounded-2xl sm:rounded-3xl overflow-hidden bg-transparent shadow-xl border border-gray-200 flex items-center justify-center select-none",
                    mediaType !== 'image' && "aspect-video"
                  )}
                >
                  {mediaType === 'video' ? (
                    <video
                      ref={videoRef}
                      src={mediaUrl}
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
                  ) : (
                    <img
                      ref={imageRef}
                      src={mediaUrl}
                      alt="Media Preview"
                      onLoad={handleImageLoaded}
                      className="absolute max-w-full max-h-full object-contain pointer-events-none select-none"
                    />
                  )}

                  <canvas
                    ref={canvasRef}
                    className={cn(
                      "absolute max-w-full max-h-full object-contain touch-none z-10 transition-colors",
                      hoveredAction === 'delete'
                        ? "cursor-pointer"
                        : hoveredAction === 'resize'
                          ? "cursor-nwse-resize"
                          : isDraggingLogo
                            ? "cursor-grabbing"
                            : hoveredAction === 'move'
                              ? "cursor-grab"
                              : hoveredAction === 'select'
                                ? "cursor-pointer"
                                : "cursor-crosshair"
                    )}
                    onMouseDown={handlePointerDown}
                    onMouseMove={handlePointerMove}
                    onMouseUp={handlePointerUp}
                    onMouseLeave={handlePointerUp}
                    onTouchStart={handlePointerDown}
                    onTouchMove={handlePointerMove}
                    onTouchEnd={handlePointerUp}
                  />

                  {/* Top-Right On-Canvas Status Badges */}
                  <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-20 flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-1.5 pointer-events-none">
                    {hasWatermarkRect && (
                      <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-semibold bg-blue-600/90 text-white backdrop-blur-md shadow-md flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        Xóa ({Math.round(rect!.width)}×{Math.round(rect!.height)})
                      </span>
                    )}
                    {hasLogos && (
                      <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-semibold bg-indigo-600/90 text-white backdrop-blur-md shadow-md flex items-center gap-1">
                        <Move className="w-3 h-3" />
                        {logos.length} logo
                      </span>
                    )}
                    {hasTexts && (
                      <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-semibold bg-purple-600/90 text-white backdrop-blur-md shadow-md flex items-center gap-1">
                        <Type className="w-3 h-3" />
                        {texts.length} chữ
                      </span>
                    )}
                  </div>
                </div>

                {/* Floating Inspector: Active when a logo is clicked/selected */}
                {selectedLogo && (
                  <div className="bg-white p-3 sm:p-4 rounded-2xl border-2 border-indigo-200 shadow-md flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <img
                        src={selectedLogo.url}
                        alt={selectedLogo.name}
                        className="w-8 h-8 sm:w-9 sm:h-9 object-contain bg-gray-50 rounded-lg p-1 border border-indigo-100 shrink-0"
                      />
                      <div className="overflow-hidden max-w-[120px] sm:max-w-[180px]">
                        <div className="text-xs font-bold text-gray-900 truncate">
                          {selectedLogo.name}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-gray-500 font-mono">
                          {Math.round(selectedLogo.width)} × {Math.round(selectedLogo.height)}px
                        </div>
                      </div>
                    </div>

                    {/* Scale (Thu phóng) & Opacity Sliders */}
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-[200px] w-full sm:w-auto">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-600 mb-0.5">
                          <span className="flex items-center gap-1">
                            <ZoomIn className="w-3 h-3 text-indigo-600" />
                            Thu phóng
                          </span>
                          <span className="text-indigo-600 font-bold">
                            {Math.round((selectedLogo.width / (canvasRef.current?.width || 1920)) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={3}
                          max={60}
                          step={1}
                          value={Math.round((selectedLogo.width / (canvasRef.current?.width || 1920)) * 100)}
                          onChange={(e) => updateSelectedLogoScale(parseInt(e.target.value, 10))}
                          className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-gray-200 rounded-lg"
                        />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-600 mb-0.5">
                          <span>Độ rõ</span>
                          <span className="text-indigo-600 font-bold">{selectedLogo.opacity}%</span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={100}
                          step={5}
                          value={selectedLogo.opacity}
                          onChange={(e) => updateSelectedLogoOpacity(parseInt(e.target.value, 10))}
                          className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-gray-200 rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Quick Alignment & Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0 w-full sm:w-auto justify-between sm:justify-start pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setLogoPositionPreset(selectedLogo.id, 'top-left')}
                          title="Trên-Trái"
                          className="p-1.5 rounded-lg border border-gray-200 hover:bg-indigo-50 text-gray-700 transition-colors cursor-pointer"
                        >
                          <CornerUpLeft className="w-3.5 h-3.5 text-indigo-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogoPositionPreset(selectedLogo.id, 'top-right')}
                          title="Trên-Phải"
                          className="p-1.5 rounded-lg border border-gray-200 hover:bg-indigo-50 text-gray-700 transition-colors cursor-pointer"
                        >
                          <CornerUpRight className="w-3.5 h-3.5 text-indigo-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogoPositionPreset(selectedLogo.id, 'bottom-left')}
                          title="Dưới-Trái"
                          className="p-1.5 rounded-lg border border-gray-200 hover:bg-indigo-50 text-gray-700 transition-colors cursor-pointer"
                        >
                          <CornerDownLeft className="w-3.5 h-3.5 text-indigo-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogoPositionPreset(selectedLogo.id, 'bottom-right')}
                          title="Dưới-Phải"
                          className="p-1.5 rounded-lg border border-gray-200 hover:bg-indigo-50 text-gray-700 transition-colors cursor-pointer"
                        >
                          <CornerDownRight className="w-3.5 h-3.5 text-indigo-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogoPositionPreset(selectedLogo.id, 'center')}
                          title="Chính giữa"
                          className="px-2 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 hover:bg-indigo-50 text-gray-700 transition-colors cursor-pointer"
                        >
                          Giữa
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteLogo(selectedLogo.id)}
                        title="Xóa logo này (hoặc bấm Delete)"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition-colors cursor-pointer ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Video Controls Bar (Only when media is video) */}
                {mediaType === 'video' && (
                  <div className="bg-gray-900 text-white p-2.5 sm:p-3 rounded-2xl flex flex-col gap-2 shadow-sm">
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

                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={togglePlay}
                          className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {isPlaying ? (
                            <>
                              <Pause className="w-3.5 h-3.5 text-blue-400" />
                              <span>Tạm dừng</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
                              <span>Phát</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={toggleMute}
                          className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors cursor-pointer"
                        >
                          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={handleOpenPreviewModal}
                          className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-2xs border-blue-500"
                          title="Xem trước kết quả trong modal và tải về máy"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Preview & Tải về</span>
                          <span className="sm:hidden">Preview</span>
                        </button>

                        <button
                          type="button"
                          onMouseDown={() => setIsHoldingCompare(true)}
                          onMouseUp={() => setIsHoldingCompare(false)}
                          onMouseLeave={() => setIsHoldingCompare(false)}
                          onTouchStart={() => setIsHoldingCompare(true)}
                          onTouchEnd={() => setIsHoldingCompare(false)}
                          className={cn(
                            "px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all select-none border cursor-pointer",
                            isHoldingCompare
                              ? "bg-amber-600 border-amber-500 text-white ring-2 ring-amber-400/40"
                              : "bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300 hover:text-white"
                          )}
                          title="Nhấn giữ để so sánh với video gốc trên canvas"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{isHoldingCompare ? "Đang xem gốc" : "Giữ xem gốc"}</span>
                          <span className="sm:hidden">{isHoldingCompare ? "Xem gốc" : "Giữ xem"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Image Toolbar when media is image */}
                {mediaType === 'image' && (
                  <div className="bg-gray-900 text-white p-2.5 sm:p-3 rounded-2xl flex flex-wrap items-center justify-between gap-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                        <FileImage className="w-3.5 h-3.5" />
                        <span>Ảnh tĩnh</span>
                      </span>
                      {imageDimensions && (
                        <span className="px-2 py-1 rounded-lg bg-gray-800 text-gray-300 font-mono text-xs hidden sm:inline-block">
                          {imageDimensions.width} × {imageDimensions.height} px
                        </span>
                      )}
                      {file && (
                        <span className="text-gray-400 text-xs truncate max-w-[120px] sm:max-w-[150px] hidden md:inline-block">
                          {file.name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={handleOpenPreviewModal}
                        className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-2xs border-blue-500"
                        title="Xem trước kết quả trong modal và tải về máy"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Preview & Tải về</span>
                        <span className="sm:hidden">Preview</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowTextModal(true)}
                        className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer bg-gray-800 hover:bg-gray-700 text-purple-300 hover:text-white border-gray-700 shadow-2xs"
                        title="Chèn chữ & Watermark văn bản lên ảnh"
                      >
                        <Type className="w-3.5 h-3.5 text-purple-400" />
                        <span>Chèn chữ</span>
                        {hasTexts && (
                          <span className="px-1.5 py-0.2 rounded-full bg-purple-600 text-white text-[10px] font-bold">
                            {texts.length}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onMouseDown={() => setIsHoldingCompare(true)}
                        onMouseUp={() => setIsHoldingCompare(false)}
                        onMouseLeave={() => setIsHoldingCompare(false)}
                        onTouchStart={() => setIsHoldingCompare(true)}
                        onTouchEnd={() => setIsHoldingCompare(false)}
                        className={cn(
                          "px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all select-none border cursor-pointer",
                          isHoldingCompare
                            ? "bg-amber-600 border-amber-500 text-white ring-2 ring-amber-400/40"
                            : "bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300 hover:text-white"
                        )}
                        title="Nhấn giữ để so sánh với ảnh gốc trên canvas"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{isHoldingCompare ? "Đang xem gốc" : "Giữ xem ảnh gốc"}</span>
                        <span className="sm:hidden">{isHoldingCompare ? "Xem gốc" : "Giữ xem"}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Primary Action Buttons: "Xóa watermark", "Chèn logo" and "Chèn chữ" */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 pt-1">
                  {/* Button 1: Xóa watermark */}
                  <button
                    type="button"
                    onClick={() => setShowWatermarkModal(true)}
                    className={cn(
                      "p-3 sm:p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 text-left cursor-pointer group shadow-xs min-w-0",
                      hasWatermarkRect
                        ? "border-blue-500 bg-blue-50/70 hover:bg-blue-50 text-blue-950 ring-2 ring-blue-500/20"
                        : "border-gray-200 hover:border-blue-400 bg-white hover:bg-gray-50 text-gray-900"
                    )}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className={cn(
                        "p-2.5 rounded-xl transition-colors shrink-0",
                        hasWatermarkRect ? "bg-blue-600 text-white shadow-xs" : "bg-blue-50 text-blue-600 group-hover:bg-blue-100"
                      )}>
                        <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold flex items-center gap-1.5 flex-wrap">
                          <span>Xóa watermark</span>
                          {hasWatermarkRect ? (
                            <span className="text-[10px] bg-blue-600 text-white font-semibold px-2 py-0.5 rounded-full shrink-0">
                              Đã chọn vùng
                            </span>
                          ) : (
                            <span className="text-[10px] bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full shrink-0">
                              Không xóa vùng
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {hasWatermarkRect
                            ? `${Math.round(rect!.width)} × ${Math.round(rect!.height)}px • ${blendMode === 'smooth' ? 'Hòa trộn mịn' : blendMode === 'blur' ? 'Làm mờ' : 'Delogo'}`
                            : 'Bấm để khoanh vùng & tùy chỉnh'}
                        </p>
                      </div>
                    </div>
                    <Sliders className="w-4 h-4 text-gray-400 group-hover:text-blue-600 shrink-0" />
                  </button>

                  {/* Button 2: Chèn logo */}
                  <button
                    type="button"
                    onClick={() => setShowLogoModal(true)}
                    className={cn(
                      "p-3 sm:p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 text-left cursor-pointer group shadow-xs min-w-0",
                      hasLogos
                        ? "border-indigo-500 bg-indigo-50/70 hover:bg-indigo-50 text-indigo-950 ring-2 ring-indigo-500/20"
                        : "border-gray-200 hover:border-indigo-400 bg-white hover:bg-gray-50 text-gray-900"
                    )}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className={cn(
                        "p-2.5 rounded-xl transition-colors shrink-0",
                        hasLogos ? "bg-indigo-600 text-white shadow-xs" : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100"
                      )}>
                        <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold flex items-center gap-1.5 flex-wrap">
                          <span>Chèn logo</span>
                          {hasLogos && (
                            <span className="text-[10px] bg-indigo-600 text-white font-semibold px-2 py-0.5 rounded-full shrink-0">
                              {logos.length} logo
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {hasLogos
                            ? `${logos.length} logo • Kéo thả & thu phóng`
                            : 'Chèn nhiều logo tự do'}
                        </p>
                      </div>
                    </div>
                    <Sliders className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 shrink-0" />
                  </button>

                  {/* Button 3: Chèn chữ */}
                  <button
                    type="button"
                    onClick={() => setShowTextModal(true)}
                    className={cn(
                      "p-3 sm:p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 text-left cursor-pointer group shadow-xs min-w-0 sm:col-span-2 lg:col-span-1",
                      hasTexts
                        ? "border-purple-500 bg-purple-50/70 hover:bg-purple-50 text-purple-950 ring-2 ring-purple-500/20"
                        : "border-gray-200 hover:border-purple-400 bg-white hover:bg-gray-50 text-gray-900"
                    )}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className={cn(
                        "p-2.5 rounded-xl transition-colors shrink-0",
                        hasTexts ? "bg-purple-600 text-white shadow-xs" : "bg-purple-50 text-purple-600 group-hover:bg-purple-100"
                      )}>
                        <Type className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold flex items-center gap-1.5 flex-wrap">
                          <span>Chèn chữ</span>
                          {hasTexts && (
                            <span className="text-[10px] bg-purple-600 text-white font-semibold px-2 py-0.5 rounded-full shrink-0">
                              {texts.length} chữ
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {hasTexts
                            ? `${texts.length} đoạn chữ • Kéo thả & sửa kiểu`
                            : 'Font chữ, nền, in đậm & nghiêng'}
                        </p>
                      </div>
                    </div>
                    <Sliders className="w-4 h-4 text-gray-400 group-hover:text-purple-600 shrink-0" />
                  </button>
                </div>

                {/* Main Processing CTA Button */}
                <button
                  onClick={handleProcess}
                  disabled={!canProcess()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 sm:py-4 rounded-2xl font-bold text-sm sm:text-base text-white shadow-md transition-all bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {getActionButtonText()}
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      {getActionButtonText()}
                    </>
                  )}
                </button>

                {/* Progress Bar during Processing */}
                {isProcessing && (
                  <div className="space-y-1.5 pt-1 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between text-xs font-medium text-gray-600">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                        {mediaType === 'image' ? 'Đang tinh chỉnh từng điểm ảnh...' : 'Đang render từng khung hình video...'}
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
            ) : (
              /* After Processing: Side-by-side Comparison Screen */
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {mediaType === 'image' ? (
                  /* Single Processed Image Result (No comparison) */
                  <div className="space-y-2 max-w-4xl mx-auto">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold text-green-700 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        {hasWatermarkRect && hasLogos
                          ? 'Ảnh Đã Xử Lý & Chèn Logo'
                          : hasLogos
                            ? 'Ảnh Đã Chèn Logo'
                            : 'Ảnh Đã Xử Lý Sạch Watermark'}
                      </span>
                      <span className="text-[11px] font-semibold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200 shadow-2xs">
                        Hoàn tất 100%
                      </span>
                    </div>
                    <div className="relative rounded-2xl overflow-hidden bg-black shadow-lg border-2 border-green-500/50 aspect-video flex items-center justify-center">
                      <img
                        src={outputUrl}
                        alt="Cleaned Result"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  </div>
                ) : (
                  /* Side-by-side Comparison for Video */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-7 items-start">
                    {/* Original Media */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-gray-400" />
                          Video Gốc (Ban đầu)
                        </span>
                      </div>
                      <div className="relative rounded-2xl overflow-hidden bg-black shadow-md border border-gray-200 aspect-video flex items-center justify-center">
                        <video
                          src={mediaUrl || undefined}
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
                          {hasWatermarkRect && hasLogos
                            ? 'Video Đã Xử Lý & Chèn Logo'
                            : hasLogos
                              ? 'Video Đã Chèn Logo'
                              : 'Video Đã Xử Lý Sạch Watermark'}
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
                )}

                {/* Download and Next Action Bar */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
                  <div className="text-center lg:text-left w-full lg:w-auto">
                    <h3 className="font-bold text-gray-950 text-base sm:text-lg">
                      {mediaType === 'image' ? 'Hình ảnh của bạn đã sẵn sàng!' : 'Video của bạn đã sẵn sàng!'}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                      Đã hoàn tất xử lý thành công với chất lượng cao. Bấm nút bên dưới để tải tệp về thiết bị.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
                    <a
                      href={outputUrl}
                      download={`output_${file?.name || (mediaType === 'image' ? 'image.png' : 'video.mp4')}`}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      {mediaType === 'image'
                        ? `Tải Ảnh Về Máy (${file?.type === 'image/png' ? '.PNG' : '.JPG'})`
                        : 'Tải Video Về Máy (.MP4)'}
                    </a>
                    <div className="grid grid-cols-3 sm:flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setShowPreviewModal(true)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-blue-600 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                        title="Mở modal xem trước"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="truncate">Xem trước</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOutputUrl(null)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
                        title="Chỉnh sửa tiếp"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span className="truncate">Sửa tiếp</span>
                      </button>
                      <button
                        type="button"
                        onClick={startOver}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
                        title="Chọn file khác"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="truncate">{mediaType === 'image' ? 'Ảnh khác' : 'Video khác'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* SUB-MODAL 1: Thiết lập Xóa Watermark */}
      {showWatermarkModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl border border-gray-100 flex flex-col gap-4 sm:gap-5 max-h-[92vh] sm:max-h-[88vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                    Thiết lập Xóa Watermark
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Chọn thuật toán hòa trộn và độ làm mịn vết xóa
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWatermarkModal(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status & Watermark Clear */}
            <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-blue-950">
                  {hasWatermarkRect
                    ? `Đang chọn vùng: ${Math.round(rect!.width)} × ${Math.round(rect!.height)} px`
                    : 'Chưa khoanh vùng xóa watermark'}
                </div>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  {hasWatermarkRect
                    ? 'Bạn có thể kéo vẽ vùng khác trên màn hình hoặc bấm Hủy vùng nếu chỉ muốn chèn logo.'
                    : 'Dùng chuột kéo khoanh vùng trên màn hình xem trước để xóa watermark.'}
                </p>
              </div>
              {hasWatermarkRect && (
                <button
                  type="button"
                  onClick={() => setRect(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-red-600 border border-red-200 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                >
                  Hủy vùng xóa
                </button>
              )}
            </div>

            {/* Independent Feature Guarantee Note */}
            <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200 text-gray-600 text-xs flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Tách rời độc lập:</strong> Nếu bạn không khoanh vùng watermark thì hệ thống <strong>CHỈ chèn logo</strong> và giữ nguyên 100% nội dung gốc của bạn.
              </span>
            </div>

            {/* Blend Mode Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Blend className="w-3.5 h-3.5 text-blue-600" />
                Phương pháp xử lý watermark
              </label>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setBlendMode('smooth')}
                  className={cn(
                    "p-3 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer",
                    blendMode === 'smooth'
                      ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20 shadow-2xs"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-xl shrink-0 mt-0.5",
                    blendMode === 'smooth' ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                  )}>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-gray-900 flex items-center gap-2">
                      <span>Làm mờ thông minh (Smooth Inpaint)</span>
                      <span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-sm">
                        Khuyên dùng
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Tự động trích xuất các điểm ảnh viền để che phủ watermark tự nhiên.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBlendMode('blur')}
                  className={cn(
                    "p-3 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer",
                    blendMode === 'blur'
                      ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20 shadow-2xs"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-xl shrink-0 mt-0.5",
                    blendMode === 'blur' ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                  )}>
                    <Blend className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-gray-900">
                      Làm mờ mềm (Soft BoxBlur)
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Làm nhòe nhẹ vùng watermark với độ chuyển tiếp tự nhiên.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBlendMode('delogo')}
                  className={cn(
                    "p-3 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer",
                    blendMode === 'delogo'
                      ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20 shadow-2xs"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-xl shrink-0 mt-0.5",
                    blendMode === 'delogo' ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                  )}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-gray-900">
                      Nội suy cơ bản (Delogo)
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Thuật toán Delogo lấy mẫu biên truyền thống.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Smooth Level */}
            {blendMode !== 'delogo' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-600" />
                    Độ làm mịn vết xóa
                  </label>
                  <span className="text-[11px] text-gray-500 font-medium">
                    {smoothLevel === 'low' ? 'Nhẹ' : smoothLevel === 'high' ? 'Mạnh' : 'Vừa (tự nhiên nhất)'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSmoothLevel(lvl)}
                      className={cn(
                        "py-2 px-2.5 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer",
                        smoothLevel === lvl
                          ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-600/20 shadow-2xs"
                          : "border-gray-200 hover:border-gray-300 text-gray-600 bg-white"
                      )}
                    >
                      {lvl === 'low' ? 'Nhẹ (ít mờ)' : lvl === 'medium' ? 'Vừa (tự nhiên)' : 'Mạnh (mờ sâu)'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quality Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Chất lượng xuất</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setQualityMode('high')}
                  className={cn(
                    "p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                    qualityMode === 'high' ? "border-blue-600 bg-blue-50/70 text-blue-900 font-semibold" : "border-gray-200 bg-white text-gray-600"
                  )}
                >
                  <div className="text-xs">Chất lượng gốc 100%</div>
                  <div className="text-[10px] text-gray-400">Độ nét cao nhất</div>
                </button>
                <button
                  type="button"
                  onClick={() => setQualityMode('fast')}
                  className={cn(
                    "p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                    qualityMode === 'fast' ? "border-blue-600 bg-blue-50/70 text-blue-900 font-semibold" : "border-gray-200 bg-white text-gray-600"
                  )}
                >
                  <div className="text-xs">Tối ưu dung lượng</div>
                  <div className="text-[10px] text-gray-400">Xử lý nhanh, tệp nhẹ</div>
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowWatermarkModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
              >
                Hoàn tất thiết lập
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 2: Thiết lập & Quản lý Danh Sách Logo (Hỗ trợ chèn nhiều logo) */}
      {showLogoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl border border-gray-100 flex flex-col gap-4 sm:gap-5 max-h-[92vh] sm:max-h-[88vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                    Quản lý & Chèn Logo Thương Hiệu
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Chèn nhiều logo liên tục, kéo thả, thu phóng & xóa dễ dàng
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLogoModal(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hidden multi-file logo input */}
            <input
              type="file"
              ref={logoInputRef}
              onChange={handleLogoUpload}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              multiple
              className="hidden"
            />

            {/* Upload Area / Add More Button */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-indigo-300 hover:border-indigo-500 rounded-2xl bg-indigo-50/30 hover:bg-indigo-50/60 text-indigo-700 transition-all cursor-pointer font-bold text-xs sm:text-sm shadow-2xs"
              >
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>+ Tải lên thêm Logo (Có thể chọn nhiều tệp PNG/JPG)</span>
              </button>
              <p className="text-[11px] text-gray-400 text-center">
                Khuyên dùng ảnh PNG nền trong suốt để có hiển thị đẹp và chuyên nghiệp nhất.
              </p>
            </div>

            {/* List of currently added Logos */}
            {logos.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700">
                    Danh sách logo đã chèn ({logos.length}):
                  </label>
                  {logos.length > 1 && (
                    <button
                      type="button"
                      onClick={clearAllLogos}
                      className="text-[11px] text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                    >
                      Xóa tất cả logo
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {logos.map((logo, idx) => (
                    <div
                      key={logo.id}
                      onClick={() => setSelectedLogoId(logo.id)}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer",
                        selectedLogoId === logo.id
                          ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20"
                          : "border-gray-200 hover:border-indigo-300 bg-white"
                      )}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <img
                          src={logo.url}
                          alt={logo.name}
                          className="w-9 h-9 object-contain bg-white rounded-xl p-1 border border-indigo-200 shrink-0"
                        />
                        <div className="truncate">
                          <div className="text-xs font-bold text-gray-900 truncate">
                            #{idx + 1} • {logo.name}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {Math.round(logo.width)}×{Math.round(logo.height)}px • Độ rõ {logo.opacity}%
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {selectedLogoId === logo.id && (
                          <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                            Đang chọn
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteLogo(logo.id);
                          }}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa logo này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Logo Tuning Panel */}
            {selectedLogo ? (
              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                    Chỉnh sửa Logo: {selectedLogo.name}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteLogo(selectedLogo.id)}
                    className="text-[11px] text-red-600 hover:text-red-700 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Xóa logo này
                  </button>
                </div>

                {/* Sliders: Logo Size & Logo Opacity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                        <ZoomIn className="w-3 h-3 text-indigo-600" />
                        Thu phóng:
                      </label>
                      <span className="text-xs font-bold text-indigo-600">
                        {Math.round((selectedLogo.width / (canvasRef.current?.width || 1920)) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={3}
                      max={60}
                      step={1}
                      value={Math.round((selectedLogo.width / (canvasRef.current?.width || 1920)) * 100)}
                      onChange={(e) => updateSelectedLogoScale(parseInt(e.target.value, 10))}
                      className="w-full accent-indigo-600 cursor-pointer h-2 bg-gray-200 rounded-lg"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700">
                        Độ rõ nét:
                      </label>
                      <span className="text-xs font-bold text-indigo-600">{selectedLogo.opacity}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={5}
                      value={selectedLogo.opacity}
                      onChange={(e) => updateSelectedLogoOpacity(parseInt(e.target.value, 10))}
                      className="w-full accent-indigo-600 cursor-pointer h-2 bg-gray-200 rounded-lg"
                    />
                  </div>
                </div>

                {/* Quick Placement Presets */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <Crosshair className="w-3.5 h-3.5 text-indigo-600" />
                    Đặt nhanh vị trí logo đang chọn:
                  </label>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLogoPositionPreset(selectedLogo.id, 'top-left')}
                      className="px-2 py-2 rounded-xl border border-gray-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 text-[11px] font-medium text-gray-700 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      title="Góc trên - trái"
                    >
                      <CornerUpLeft className="w-3 h-3 text-indigo-600" />
                      <span>Trên-Trái</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoPositionPreset(selectedLogo.id, 'top-right')}
                      className="px-2 py-2 rounded-xl border border-gray-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 text-[11px] font-medium text-gray-700 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      title="Góc trên - phải"
                    >
                      <CornerUpRight className="w-3 h-3 text-indigo-600" />
                      <span>Trên-Phải</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoPositionPreset(selectedLogo.id, 'bottom-left')}
                      className="px-2 py-2 rounded-xl border border-gray-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 text-[11px] font-medium text-gray-700 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      title="Góc dưới - trái"
                    >
                      <CornerDownLeft className="w-3 h-3 text-indigo-600" />
                      <span>Dưới-Trái</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoPositionPreset(selectedLogo.id, 'bottom-right')}
                      className="px-2 py-2 rounded-xl border border-gray-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 text-[11px] font-medium text-gray-700 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      title="Góc dưới - phải"
                    >
                      <CornerDownRight className="w-3 h-3 text-indigo-600" />
                      <span>Dưới-Phải</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoPositionPreset(selectedLogo.id, 'center')}
                      className="px-2 py-2 rounded-xl border border-gray-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 text-[11px] font-medium text-gray-700 flex items-center justify-center gap-1 cursor-pointer transition-colors col-span-2 sm:col-span-1"
                      title="Chính giữa khung hình"
                    >
                      <span>Chính giữa</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              logos.length > 0 && (
                <p className="text-xs text-indigo-600 text-center font-medium bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100">
                  👆 Bấm vào một logo trong danh sách trên hoặc click trực tiếp lên ảnh để chỉnh sửa.
                </p>
              )
            )}

            {/* Interactive Canvas Tips */}
            <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs flex flex-col gap-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Move className="w-4 h-4 text-indigo-600" />
                <span>Thao tác trực tiếp trên màn hình:</span>
              </div>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 text-indigo-800">
                <li><strong>Click vào logo:</strong> Chọn logo để hiển thị khung điều khiển.</li>
                <li><strong>Kéo thả:</strong> Bấm giữ và di chuyển logo đến bất kỳ vị trí nào tùy thích.</li>
                <li><strong>Thu phóng:</strong> Kéo núm vuông ở góc dưới-phải của logo để phóng to/thu nhỏ.</li>
                <li><strong>Xóa logo:</strong> Click vào nút tròn màu đỏ (✕) ở góc trên-phải logo hoặc phím Delete.</li>
              </ul>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLogoModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
              >
                Hoàn tất thiết lập
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Users Management Modal */}
      {currentUser.role === 'admin' && (
        <AdminUsersModal
          isOpen={showAdminModal}
          onClose={() => setShowAdminModal(false)}
          currentUser={currentUser}
        />
      )}

      {/* Sub-Modal 3: Text Overlay Modal */}
      <TextOverlayModal
        isOpen={showTextModal}
        onClose={() => setShowTextModal(false)}
        texts={texts}
        onAddText={handleAddText}
        onUpdateText={handleUpdateText}
        onDeleteText={handleDeleteText}
        selectedTextId={selectedTextId}
        onSelectText={setSelectedTextId}
        canvasWidth={canvasRef.current?.width || 1920}
        canvasHeight={canvasRef.current?.height || 1080}
      />

      {/* Result Preview & Download Modal */}
      <PreviewResultModal
        isOpen={showPreviewModal}
        onClose={handleClosePreviewModal}
        mediaType={mediaType}
        file={file}
        outputUrl={outputUrl}
        mediaUrl={mediaUrl}
        isProcessing={isProcessing}
        progress={progress}
        hasWatermarkRect={hasWatermarkRect}
        logosCount={logos.length}
        textsCount={texts.length}
        imageDimensions={imageDimensions}
        onReProcess={mediaType === 'image' ? processImage : (hasWatermarkRect || hasLogos ? processVideo : undefined)}
      />
    </div>
  );
}
