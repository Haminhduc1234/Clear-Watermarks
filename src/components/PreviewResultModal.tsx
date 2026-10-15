import React, { useState } from 'react';
import {
  X,
  Download,
  Eye,
  Sparkles,
  Loader2,
  Wand2,
  FileImage,
  Video,
  Check,
  RotateCcw,
  Layers,
  SlidersHorizontal
} from 'lucide-react';
import { cn } from '../lib/utils';

interface PreviewResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaType: 'image' | 'video' | null;
  file: File | null;
  outputUrl: string | null;
  mediaUrl: string | null;
  isProcessing: boolean;
  progress: number;
  hasWatermarkRect: boolean;
  logosCount: number;
  textsCount?: number;
  imageDimensions: { width: number; height: number } | null;
  onReProcess?: () => void;
}

export default function PreviewResultModal({
  isOpen,
  onClose,
  mediaType,
  file,
  outputUrl,
  mediaUrl,
  isProcessing,
  progress,
  hasWatermarkRect,
  logosCount,
  textsCount = 0,
  imageDimensions,
  onReProcess
}: PreviewResultModalProps) {
  const [activeTab, setActiveTab] = useState<'result' | 'compare'>('result');

  if (!isOpen) return null;

  const isPng = file?.type === 'image/png' || file?.name?.toLowerCase().endsWith('.png');
  const isWebp = file?.type === 'image/webp' || file?.name?.toLowerCase().endsWith('.webp');
  const fileExt = mediaType === 'image' ? (isPng ? '.PNG' : isWebp ? '.WEBP' : '.JPG') : '.MP4';
  const downloadName = `output_${file?.name || (mediaType === 'image' ? 'image' + fileExt.toLowerCase() : 'video.mp4')}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-gray-950 border border-gray-800 text-white rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-gray-800/80 flex items-center justify-between gap-3 bg-gray-900/50">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/30 text-blue-400 shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="text-sm sm:text-lg font-bold text-white truncate">
                  Xem Trước Kết Quả {mediaType === 'image' ? 'Hình Ảnh' : 'Video'}
                </h3>
                {outputUrl && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Sẵn sàng tải về
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-gray-400 truncate mt-0.5">
                {file?.name || 'Tệp đa phương tiện'}
                {mediaType === 'image' && imageDimensions ? ` • ${imageDimensions.width} × ${imageDimensions.height} px` : ''}
                {` • Định dạng ${fileExt}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/80 transition-colors cursor-pointer"
              title="Đóng modal (Phím Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Switch Tab (only for video when outputUrl is available) */}
        {outputUrl && !isProcessing && mediaType === 'video' && (
          <div className="px-3 sm:px-5 py-2 sm:py-2.5 border-b border-gray-800/60 bg-gray-900/30 flex items-center justify-between gap-3 text-xs overflow-x-auto">
            <div className="flex items-center gap-1.5 bg-gray-900 p-1 rounded-xl border border-gray-800 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('result')}
                className={cn(
                  "px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 text-xs",
                  activeTab === 'result'
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/60"
                )}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Video kết quả</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('compare')}
                className={cn(
                  "px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 text-xs",
                  activeTab === 'compare'
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/60"
                )}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">So sánh với video gốc</span>
                <span className="xs:hidden">So sánh</span>
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2 text-gray-400 text-[11px] shrink-0">
              {hasWatermarkRect && (
                <span className="px-2 py-0.5 rounded-md bg-gray-800 border border-gray-700/60 text-gray-300">
                  Đã xóa watermark
                </span>
              )}
              {logosCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-950/60 border border-indigo-800/60 text-indigo-300">
                  {logosCount} logo chèn thêm
                </span>
              )}
            </div>
          </div>
        )}

        {/* Image Status Bar (No comparison) */}
        {outputUrl && !isProcessing && mediaType === 'image' && (
          <div className="px-3 sm:px-5 py-2 sm:py-2.5 border-b border-gray-800/60 bg-gray-900/30 flex items-center justify-between gap-2.5 text-xs flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 flex items-center gap-1.5 font-medium text-[11px] sm:text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Ảnh kết quả hoàn thiện
              </span>
              {imageDimensions && (
                <span className="px-2 py-0.5 rounded-md bg-gray-800 text-gray-300 font-mono text-[10px] sm:text-[11px] border border-gray-700/60">
                  {imageDimensions.width} × {imageDimensions.height} px
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-gray-400 text-[10px] sm:text-[11px] flex-wrap">
              {hasWatermarkRect && (
                <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-gray-800 border border-gray-700/60 text-gray-300">
                  Đã xóa watermark
                </span>
              )}
              {logosCount > 0 && (
                <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-indigo-950/60 border border-indigo-800/60 text-indigo-300">
                  {logosCount} logo
                </span>
              )}
              {textsCount > 0 && (
                <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-purple-950/60 border border-purple-800/60 text-purple-300">
                  {textsCount} chữ
                </span>
              )}
            </div>
          </div>
        )}

        {/* Modal Main Content */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto flex flex-col justify-center">
          {/* Loading state during processing */}
          {isProcessing ? (
            <div className="py-14 sm:py-20 flex flex-col items-center justify-center text-center gap-4 max-w-md mx-auto">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500"></span>
                </span>
              </div>

              <div>
                <h4 className="text-base font-bold text-white">
                  Đang xử lý kết xuất {mediaType === 'image' ? 'hình ảnh' : 'video'}...
                </h4>
                <p className="text-xs text-gray-400 mt-1">
                  {mediaType === 'image'
                    ? 'Đang áp dụng thuật toán inpainting & vẽ logo chất lượng gốc...'
                    : 'Đang render từng khung hình qua FFmpeg WASM... Vui lòng giữ tab này.'}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-xs font-mono text-gray-400">
                  <span>Tiến độ</span>
                  <span className="text-blue-400 font-bold">{progress}%</span>
                </div>
                <div className="w-full bg-gray-900 rounded-full h-2.5 overflow-hidden border border-gray-800">
                  <div
                    className="h-2.5 rounded-full transition-all duration-300 ease-out bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500"
                    style={{ width: `${Math.max(5, progress)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : !outputUrl ? (
            /* Empty state when video not yet rendered */
            <div className="py-12 sm:py-16 flex flex-col items-center justify-center text-center gap-4 max-w-md mx-auto">
              <div className="p-4 rounded-3xl bg-amber-950/40 border border-amber-800/40 text-amber-400">
                <Wand2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Chưa có kết quả để hiển thị</h4>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  {mediaType === 'video'
                    ? 'Vui lòng khoanh vùng watermark cần xóa hoặc chèn logo lên video, sau đó bấm Kết xuất để xem trước và tải về.'
                    : 'Bấm nút "Tạo kết quả" bên dưới để trích xuất ảnh đã chỉnh sửa.'}
                </p>
              </div>
              {onReProcess && (
                <button
                  type="button"
                  onClick={onReProcess}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Bắt đầu kết xuất ngay</span>
                </button>
              )}
            </div>
          ) : activeTab === 'result' || mediaType === 'image' ? (
            /* Single Large Cleaned Result Media */
            mediaType === 'image' ? (
              <div className="relative rounded-2xl overflow-hidden bg-gray-950/70 border border-gray-800/80 flex items-center justify-center shadow-inner max-h-[56vh] p-2">
                <img
                  src={outputUrl}
                  alt="Processed Result"
                  style={{
                    aspectRatio: imageDimensions ? `${imageDimensions.width} / ${imageDimensions.height}` : 'auto',
                  }}
                  className="max-w-full max-h-[50vh] sm:max-h-[54vh] w-auto h-auto object-contain rounded-xl shadow-lg"
                />
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden bg-black/80 border border-gray-800/90 aspect-video flex items-center justify-center shadow-inner">
                <video
                  src={outputUrl}
                  controls
                  playsInline
                  autoPlay
                  className="max-w-full max-h-[50vh] sm:max-h-[54vh] object-contain rounded-lg"
                />
              </div>
            )
          ) : (
            /* Side-by-side comparison */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
              {/* Original */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="font-semibold text-gray-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gray-500" />
                    Bản Gốc (Trước khi xử lý)
                  </span>
                </div>
                <div className="relative rounded-2xl overflow-hidden bg-black/80 border border-gray-800 aspect-video flex items-center justify-center">
                  <video
                    src={mediaUrl || undefined}
                    controls
                    playsInline
                    className="max-w-full max-h-[38vh] sm:max-h-[44vh] object-contain"
                  />
                </div>
              </div>

              {/* Cleaned Result */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Kết Quả Hoàn Thiện
                  </span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                    Sạch watermark
                  </span>
                </div>
                <div className="relative rounded-2xl overflow-hidden bg-black/80 border border-emerald-500/40 aspect-video flex items-center justify-center">
                  <video
                    src={outputUrl}
                    controls
                    playsInline
                    autoPlay
                    className="max-w-full max-h-[38vh] sm:max-h-[44vh] object-contain"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-5 border-t border-gray-800/80 bg-gray-900/60 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 w-full sm:w-auto text-xs text-gray-400">
            {outputUrl && (
              <span className="flex items-center gap-1.5 text-emerald-400 text-[11px] sm:text-xs">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Đã kết xuất thành công ở độ phân giải gốc</span>
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-gray-700 hover:bg-gray-800 text-gray-300 text-xs font-semibold transition-colors cursor-pointer text-center"
            >
              Tiếp tục chỉnh sửa
            </button>

            {outputUrl && !isProcessing && (
              <a
                href={outputUrl}
                download={downloadName}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer text-center"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Tải {mediaType === 'image' ? 'Ảnh' : 'Video'} Về Máy ({fileExt})</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
