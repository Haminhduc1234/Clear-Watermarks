import React from 'react';
import {
  Type,
  Bold,
  Italic,
  Underline,
  Plus,
  Trash2,
  X,
  Check,
  Sparkles,
  Layers,
  Palette,
  Sliders,
  ShieldAlert
} from 'lucide-react';
import { cn } from '../lib/utils';

export interface TextItem {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bgColor: string;
  bgPadding: number;
  bgRadius: number;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  opacity: number; // 10 to 100
  strokeColor: string; // 'transparent' | '#000000' | '#ffffff'
  strokeWidth: number;
  shadowColor: string; // 'transparent' | 'rgba(0,0,0,0.8)'
  width?: number;
  height?: number;
}

interface TextOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  texts: TextItem[];
  onAddText: (text: TextItem) => void;
  onUpdateText: (id: string, updates: Partial<TextItem>) => void;
  onDeleteText: (id: string) => void;
  selectedTextId: string | null;
  onSelectText: (id: string | null) => void;
  canvasWidth: number;
  canvasHeight: number;
}

const FONT_FAMILIES = [
  { label: 'Không chân (Sans-Serif)', value: 'sans-serif' },
  { label: 'Arial (Rõ nét)', value: 'Arial' },
  { label: 'Impact (Đậm đà)', value: 'Impact' },
  { label: 'Có chân (Times New Roman)', value: 'Times New Roman' },
  { label: 'Máy đánh chữ (Courier New)', value: 'Courier New' },
  { label: 'Georgia (Thanh lịch)', value: 'Georgia' },
  { label: 'Chữ viết tay (Cursive)', value: 'cursive' }
];

const PRESET_COLORS = [
  '#ffffff',
  '#000000',
  '#facc15',
  '#ef4444',
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#f97316'
];

const BG_PRESETS = [
  { label: 'Trong suốt', value: 'transparent' },
  { label: 'Đen mờ', value: 'rgba(0, 0, 0, 0.6)' },
  { label: 'Đen tuyền', value: '#000000' },
  { label: 'Trắng mờ', value: 'rgba(255, 255, 255, 0.75)' },
  { label: 'Trắng tinh', value: '#ffffff' },
  { label: 'Xanh dương', value: '#1e40af' },
  { label: 'Đỏ nổi bật', value: '#b91c1c' }
];

const QUICK_TEXT_TEMPLATES = [
  '© Bản quyền hình ảnh',
  'Hotline: 0988.xxx.xxx',
  'Tên Thương Hiệu',
  'Hàng Chính Hãng 100%',
  'Đã Kiểm Duyệt'
];

export default function TextOverlayModal({
  isOpen,
  onClose,
  texts,
  onAddText,
  onUpdateText,
  onDeleteText,
  selectedTextId,
  onSelectText,
  canvasWidth,
  canvasHeight
}: TextOverlayModalProps) {
  if (!isOpen) return null;

  const currentText = texts.find((t) => t.id === selectedTextId) || texts[0] || null;

  const handleAddNewText = () => {
    const initSize = Math.max(20, Math.min(80, Math.round(canvasWidth * 0.04)));
    const newText: TextItem = {
      id: 'text_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      text: 'Chữ Bản Quyền',
      x: Math.max(20, Math.round(canvasWidth * 0.1)),
      y: Math.max(20, Math.round(canvasHeight * 0.1) + texts.length * 50),
      fontSize: initSize,
      fontFamily: 'sans-serif',
      color: '#ffffff',
      bgColor: 'rgba(0, 0, 0, 0.6)',
      bgPadding: 10,
      bgRadius: 8,
      isBold: true,
      isItalic: false,
      isUnderline: false,
      opacity: 100,
      strokeColor: 'transparent',
      strokeWidth: 0,
      shadowColor: 'rgba(0, 0, 0, 0.7)'
    };
    onAddText(newText);
    onSelectText(newText.id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden text-gray-900">
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-gray-100 flex items-center justify-between gap-3 bg-gradient-to-r from-purple-50/50 to-indigo-50/50">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-purple-600 text-white shadow-sm shrink-0">
              <Type className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="text-sm sm:text-lg font-bold text-gray-900 leading-tight truncate">
                  Chèn Chữ & Watermark Văn Bản
                </h3>
                <span className="text-[10px] sm:text-[11px] font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full shrink-0">
                  {texts.length} chữ
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 hidden xs:block truncate">
                Tùy chỉnh kiểu font, màu sắc, nền thẻ, độ đậm nghiêng và vị trí
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
          {/* Top Bar: List of Texts & Add Button */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {texts.map((t, idx) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectText(t.id)}
                  className={cn(
                    "px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border shrink-0",
                    t.id === currentText?.id
                      ? "bg-purple-600 border-purple-600 text-white shadow-xs"
                      : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Type className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[100px] sm:max-w-[120px]">{t.text || `Đoạn ${idx + 1}`}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddNewText}
              className="px-3 sm:px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ml-auto"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Thêm đoạn chữ</span>
            </button>
          </div>

          {currentText ? (
            <>
              {/* Text Input & Quick Templates */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                  <span>Nội dung văn bản:</span>
                  <span className="text-[11px] font-normal text-gray-400">
                    Kéo thả vị trí trực tiếp trên ảnh
                  </span>
                </label>
                <input
                  type="text"
                  value={currentText.text}
                  onChange={(e) => onUpdateText(currentText.id, { text: e.target.value })}
                  placeholder="Nhập nội dung chữ muốn chèn..."
                  className="w-full px-3.5 sm:px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-medium"
                />

                {/* Quick Templates */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[11px] text-gray-400 font-medium">Mẫu nhanh:</span>
                  {QUICK_TEXT_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl}
                      type="button"
                      onClick={() => onUpdateText(currentText.id, { text: tmpl })}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 hover:bg-purple-50 hover:text-purple-700 text-gray-600 transition-colors cursor-pointer"
                    >
                      {tmpl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Typography Options: Font, Size, Styles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 bg-gray-50/60 p-3.5 sm:p-4 rounded-2xl border border-gray-100">
                {/* Font Family */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">Kiểu Font chữ:</label>
                  <select
                    value={currentText.fontFamily}
                    onChange={(e) => onUpdateText(currentText.id, { fontFamily: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white font-medium focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  >
                    {FONT_FAMILIES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Font Size */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-700">Cỡ chữ:</span>
                    <span className="font-mono text-purple-600 font-bold">{currentText.fontSize} px</span>
                  </div>
                  <input
                    type="range"
                    min="14"
                    max="140"
                    step="2"
                    value={currentText.fontSize}
                    onChange={(e) => onUpdateText(currentText.id, { fontSize: Number(e.target.value) })}
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>Nhỏ (16px)</span>
                    <span>Vừa (48px)</span>
                    <span>Lớn (96px)</span>
                  </div>
                </div>

                {/* Style Toggles: Bold, Italic, Underline */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-700">Định dạng kiểu dáng:</label>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateText(currentText.id, { isBold: !currentText.isBold })}
                      className={cn(
                        "px-2 sm:px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 sm:gap-1.5 border transition-all cursor-pointer justify-center",
                        currentText.isBold
                          ? "bg-purple-600 border-purple-600 text-white shadow-2xs"
                          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <Bold className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden xs:inline">Đậm (Bold)</span>
                      <span className="xs:hidden">Đậm</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onUpdateText(currentText.id, { isItalic: !currentText.isItalic })}
                      className={cn(
                        "px-2 sm:px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 sm:gap-1.5 border transition-all cursor-pointer justify-center",
                        currentText.isItalic
                          ? "bg-purple-600 border-purple-600 text-white shadow-2xs"
                          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <Italic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden xs:inline">Nghiêng (Italic)</span>
                      <span className="xs:hidden">Nghiêng</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onUpdateText(currentText.id, { isUnderline: !currentText.isUnderline })}
                      className={cn(
                        "px-2 sm:px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 sm:gap-1.5 border transition-all cursor-pointer justify-center",
                        currentText.isUnderline
                          ? "bg-purple-600 border-purple-600 text-white shadow-2xs"
                          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <Underline className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden xs:inline">Gạch chân</span>
                      <span className="xs:hidden">Gạch</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Text Color & Opacity */}
              <div className="space-y-3 bg-gray-50/60 p-4 rounded-2xl border border-gray-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Palette className="w-4 h-4 text-purple-600" />
                    <span>Màu chữ & Độ mờ đục:</span>
                  </label>
                  <span className="text-xs font-mono font-bold text-purple-600">
                    {currentText.opacity}%
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Native Color Picker */}
                  <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-2 py-1 bg-white">
                    <input
                      type="color"
                      value={currentText.color}
                      onChange={(e) => onUpdateText(currentText.id, { color: e.target.value })}
                      className="w-6 h-6 rounded-md cursor-pointer border-0 bg-transparent p-0"
                    />
                    <span className="text-xs font-mono text-gray-600 uppercase">
                      {currentText.color}
                    </span>
                  </div>

                  {/* Preset Swatches */}
                  <div className="flex items-center gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onUpdateText(currentText.id, { color: c })}
                        style={{ backgroundColor: c }}
                        className={cn(
                          "w-6 h-6 rounded-full border cursor-pointer transition-transform hover:scale-110",
                          currentText.color.toLowerCase() === c.toLowerCase()
                            ? "ring-2 ring-purple-600 ring-offset-2 scale-110 border-gray-400"
                            : "border-gray-300"
                        )}
                        title={c}
                      />
                    ))}
                  </div>
                </div>

                {/* Opacity slider */}
                <div className="pt-1">
                  <input
                    type="range"
                    min="15"
                    max="100"
                    step="5"
                    value={currentText.opacity}
                    onChange={(e) => onUpdateText(currentText.id, { opacity: Number(e.target.value) })}
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Background (Màu nền & Bo góc) */}
              <div className="space-y-3 bg-gray-50/60 p-4 rounded-2xl border border-gray-100">
                <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                  <span>Màu nền thẻ chữ (Background):</span>
                  <span className="text-[11px] text-gray-400 font-normal">
                    Tạo huy hiệu giúp chữ dễ đọc trên nền ảnh rối
                  </span>
                </label>

                {/* Background Preset buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BG_PRESETS.map((bg) => (
                    <button
                      key={bg.label}
                      type="button"
                      onClick={() => onUpdateText(currentText.id, { bgColor: bg.value })}
                      className={cn(
                        "px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                        currentText.bgColor === bg.value
                          ? "bg-purple-600 border-purple-600 text-white shadow-2xs"
                          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0"
                        style={{ backgroundColor: bg.value === 'transparent' ? 'transparent' : bg.value }}
                      />
                      <span className="truncate">{bg.label}</span>
                    </button>
                  ))}
                </div>

                {/* Background Padding & Corner Radius (Only if background is active) */}
                {currentText.bgColor !== 'transparent' && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-gray-600">Đệm viền (Padding):</span>
                      <div className="flex gap-1.5">
                        {[6, 10, 16].map((pad) => (
                          <button
                            key={pad}
                            type="button"
                            onClick={() => onUpdateText(currentText.id, { bgPadding: pad })}
                            className={cn(
                              "flex-1 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer",
                              currentText.bgPadding === pad
                                ? "bg-purple-100 border-purple-300 text-purple-700"
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                            )}
                          >
                            {pad}px
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-gray-600">Bo góc nền:</span>
                      <div className="flex gap-1.5">
                        {[
                          { label: 'Vuông', r: 0 },
                          { label: 'Bo nhẹ', r: 8 },
                          { label: 'Pill tròn', r: 999 }
                        ].map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => onUpdateText(currentText.id, { bgRadius: item.r })}
                            className={cn(
                              "flex-1 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer",
                              currentText.bgRadius === item.r
                                ? "bg-purple-100 border-purple-300 text-purple-700"
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                            )}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Stroke & Shadow (Contrast enhancements) */}
              <div className="flex items-center justify-between gap-3 bg-gray-50/60 p-3.5 rounded-2xl border border-gray-100">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-gray-800">Đổ bóng chữ (Drop Shadow):</span>
                  <p className="text-[11px] text-gray-400">Tăng độ nổi khối cho văn bản</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateText(currentText.id, {
                      shadowColor:
                        currentText.shadowColor === 'transparent' ? 'rgba(0,0,0,0.75)' : 'transparent'
                    })
                  }
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                    currentText.shadowColor !== 'transparent'
                      ? "bg-purple-600 border-purple-600 text-white"
                      : "bg-white border-gray-200 text-gray-600"
                  )}
                >
                  {currentText.shadowColor !== 'transparent' ? 'Đang bật bóng' : 'Tắt bóng'}
                </button>
              </div>

              {/* Live Preview Sample Box */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-gray-700">Xem trước diện mạo chữ:</span>
                <div className="relative rounded-2xl p-6 min-h-[90px] flex items-center justify-center overflow-hidden border border-gray-200 shadow-inner bg-gradient-to-r from-gray-900 via-gray-800 to-gray-950">
                  <div
                    style={{
                      fontFamily: currentText.fontFamily,
                      fontSize: Math.min(36, Math.max(16, currentText.fontSize * 0.55)),
                      fontWeight: currentText.isBold ? 'bold' : 'normal',
                      fontStyle: currentText.isItalic ? 'italic' : 'normal',
                      textDecoration: currentText.isUnderline ? 'underline' : 'none',
                      color: currentText.color,
                      backgroundColor: currentText.bgColor,
                      padding: currentText.bgColor !== 'transparent' ? `${currentText.bgPadding * 0.6}px ${currentText.bgPadding}px` : '0px',
                      borderRadius: `${Math.min(24, currentText.bgRadius)}px`,
                      opacity: currentText.opacity / 100,
                      textShadow: currentText.shadowColor !== 'transparent' ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none'
                    }}
                    className="select-none text-center transition-all"
                  >
                    {currentText.text || 'Chữ mẫu'}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
              <div className="p-4 rounded-2xl bg-purple-50 text-purple-600">
                <Type className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-gray-900">Chưa có đoạn chữ nào</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Bấm nút bên dưới để thêm văn bản hoặc watermark vào ảnh của bạn.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddNewText}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm đoạn chữ ngay</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-2.5">
          {currentText ? (
            <button
              type="button"
              onClick={() => onDeleteText(currentText.id)}
              className="px-3 sm:px-3.5 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 sm:px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Hoàn tất & Áp dụng</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
