import { useState, useRef, useEffect, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { Upload, Download, Play, Trash2, Wand2, Loader2, RotateCcw, Video } from 'lucide-react';
import { cn } from './lib/utils';

// Import FFmpeg core and wasm (Single-threaded fallback)
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';

// Import FFmpeg core and wasm (Multi-threaded version)
import coreMTURL from '@ffmpeg/core-mt?url';
import wasmMTURL from '@ffmpeg/core-mt/wasm?url';
import workerMTURL from '@ffmpeg/core-mt/worker?url';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [isMultiThreaded, setIsMultiThreaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ffmpegRef = useRef(new FFmpeg());

  const [rect, setRect] = useState<Rect | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);

  // Load FFmpeg
  useEffect(() => {
    const ffmpeg = ffmpegRef.current;
    let isMounted = true;

    const load = async () => {
      try {
        ffmpeg.on('progress', ({ progress }) => {
          if (isMounted) setProgress(Math.round(progress * 100));
        });

        const useMT = typeof SharedArrayBuffer !== 'undefined';
        if (isMounted) setIsMultiThreaded(useMT);

        console.log(`Initializing ffmpeg (${useMT ? 'multi-threaded' : 'single-threaded'})...`);
        await ffmpeg.load({
          coreURL: useMT ? coreMTURL : coreURL,
          wasmURL: useMT ? wasmMTURL : wasmURL,
          ...(useMT ? { workerURL: workerMTURL } : {}),
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
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
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

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  // Render the rectangle on the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match canvas internal resolution to video native resolution
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (rect) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'; // Blue semi-transparent
      ctx.strokeStyle = '#3b82f6'; // Blue border
      ctx.lineWidth = Math.max(2, canvas.width / 300); // Scale line width
      
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      
      // Draw handles or corners if desired
    }
  }, [rect, videoUrl]);

  // Handle video loaded metadata to initialize canvas size
  const handleVideoLoaded = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (canvas && video) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
  };

  const processVideo = async () => {
    if (!file || !rect || !ffmpegLoaded) return;
    
    try {
      setIsProcessing(true);
      setProgress(0);
      const ffmpeg = ffmpegRef.current;
      
      // Write file to FFmpeg FS
      const inputName = 'input' + file.name.substring(file.name.lastIndexOf('.'));
      const outputName = 'output.mp4';
      
      await ffmpeg.writeFile(inputName, await fetchFile(file));
      
      // Ensure coordinates are integers and even (required by some codecs/filters)
      let x = Math.floor(rect.x);
      let y = Math.floor(rect.y);
      let w = Math.floor(rect.width);
      let h = Math.floor(rect.height);
      
      const video = videoRef.current;
      if (video) {
        x = Math.max(0, Math.min(x, video.videoWidth - 1));
        y = Math.max(0, Math.min(y, video.videoHeight - 1));
        w = Math.max(4, Math.min(w, video.videoWidth - x));
        h = Math.max(4, Math.min(h, video.videoHeight - y));
      }
      
      // Run FFmpeg command
      // delogo filter: x, y, w, h
      // -preset ultrafast: Speeds up encoding significantly
      const args = [
        '-i', inputName,
        '-vf', `delogo=x=${x}:y=${y}:w=${w}:h=${h}`,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
      ];
      
      if (isMultiThreaded) {
        args.push('-threads', '0');
      }
      
      args.push('-c:a', 'copy', outputName);

      await ffmpeg.exec(args);
      
      // Read output
      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      
      setOutputUrl(url);
    } catch (err) {
      console.error('Error processing video:', err);
      alert('An error occurred while processing the video.');
    } finally {
      // Cleanup FS to prevent memory leaks (runs even if processing fails)
      const ffmpeg = ffmpegRef.current;
      try {
        await ffmpeg.deleteFile('input' + file.name.substring(file.name.lastIndexOf('.')));
      } catch (e) {} // Ignore if file doesn't exist
      try {
        await ffmpeg.deleteFile('output.mp4');
      } catch (e) {} // Ignore if file doesn't exist
      
      setIsProcessing(false);
    }
  };

  const startOver = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setFile(null);
    setVideoUrl(null);
    setOutputUrl(null);
    setRect(null);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Wand2 className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">ClearMark</h1>
        </div>
        {ffmpegLoaded ? (
          <span className="text-xs font-medium px-2.5 py-1 bg-green-100 text-green-800 rounded-full">
            Engine Ready
          </span>
        ) : loadError ? (
          <span className="text-xs font-medium px-2.5 py-1 bg-red-100 text-red-800 rounded-full">
            Engine Error
          </span>
        ) : (
          <span className="text-xs font-medium px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-full flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading Engine...
          </span>
        )}
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {!videoUrl ? (
          <div className="mt-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Remove Video Watermarks Locally
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                100% private, browser-based processing. No files are uploaded to any server.
              </p>
            </div>

            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={cn(
                "mt-8 flex justify-center rounded-2xl border-2 border-dashed px-6 py-24 transition-colors duration-200 ease-in-out",
                isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white hover:border-gray-400"
              )}
            >
              <div className="text-center">
                <Video className="mx-auto h-12 w-12 text-gray-400" aria-hidden="true" />
                <div className="mt-4 flex text-sm leading-6 text-gray-600 justify-center">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer rounded-md bg-white font-semibold text-blue-600 focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 hover:text-blue-500"
                  >
                    <span>Upload a video</span>
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
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs leading-5 text-gray-500 mt-2">MP4, WebM, MOV up to 100MB recommended</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {outputUrl ? 'Result' : 'Select Watermark Area'}
              </h2>
              <button
                onClick={startOver}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Start Over
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: Original Video / Editor */}
              <div className="space-y-4">
                <div className="font-medium text-sm text-gray-500 uppercase tracking-wider">Original Video</div>
                <div 
                  ref={containerRef}
                  className="relative rounded-xl overflow-hidden bg-black shadow-lg border border-gray-200 aspect-video flex items-center justify-center"
                >
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="absolute max-w-full max-h-full object-contain"
                    onLoadedMetadata={handleVideoLoaded}
                    controls={!isDrawing && !rect && !outputUrl}
                    playsInline
                  />
                  
                  {!outputUrl && (
                    <canvas
                      ref={canvasRef}
                      className="absolute max-w-full max-h-full object-contain cursor-crosshair touch-none"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                  )}
                </div>

                {!outputUrl && (
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-sm text-gray-600 mb-4">
                      {rect && rect.width > 0 
                        ? "Area selected. You can redraw to change the selection." 
                        : "Click and drag on the video to draw a box around the watermark."}
                    </p>
                    
                    <button
                      onClick={processVideo}
                      disabled={!rect || rect.width === 0 || isProcessing || !ffmpegLoaded}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processing ({progress}%)
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-5 h-5" />
                          Remove Watermark
                        </>
                      )}
                    </button>

                    {isProcessing && (
                      <div className="mt-4 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Result Video */}
              {outputUrl && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="font-medium text-sm text-gray-500 uppercase tracking-wider">Cleaned Video</div>
                  <div className="relative rounded-xl overflow-hidden bg-black shadow-lg border border-gray-200 aspect-video flex items-center justify-center">
                    <video
                      src={outputUrl}
                      className="max-w-full max-h-full object-contain"
                      controls
                      playsInline
                      autoPlay
                    />
                  </div>
                  
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex gap-3">
                    <a
                      href={outputUrl}
                      download={`cleaned_${file?.name || 'video.mp4'}`}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors"
                    >
                      <Download className="w-5 h-5" />
                      Download Video
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
