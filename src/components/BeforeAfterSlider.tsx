import React, { useState } from "react";

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export default function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "Before",
  afterLabel = "Resolved"
}: BeforeAfterSliderProps) {
  const [sliderPos, setSliderPos] = useState<number>(50);

  return (
    <div 
      className="relative w-full h-48 sm:h-56 rounded-xl overflow-hidden select-none border border-slate-200 dark:border-slate-800"
      id="before-after-slider-container"
    >
      {/* Before Image (Background) */}
      <img
        src={beforeUrl}
        alt="Before"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        referrerPolicy="no-referrer"
      />
      <div className="absolute top-2 left-2 bg-rose-600/90 backdrop-blur-xs text-white text-[9px] font-black font-mono tracking-wider px-1.5 py-0.5 rounded-md uppercase">
        {beforeLabel}
      </div>

      {/* After Image (Foreground with Clip-Path) */}
      <div 
        className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
        style={{
          clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`
        }}
      >
        <img
          src={afterUrl}
          alt="Resolved"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ width: "100%", height: "100%" }}
          referrerPolicy="no-referrer"
        />
      </div>
      <div 
        className="absolute top-2 right-2 bg-emerald-600/90 backdrop-blur-xs text-white text-[9px] font-black font-mono tracking-wider px-1.5 py-0.5 rounded-md uppercase pointer-events-none"
        style={{ opacity: sliderPos < 90 ? 1 : 0 }}
      >
        {afterLabel}
      </div>

      {/* Vertical Slider Line indicator */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize flex items-center justify-center shadow-lg pointer-events-none"
        style={{ left: `${sliderPos}%` }}
      >
        <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-2 border-blue-500 flex items-center justify-center shadow-md text-[10px] text-blue-500 font-bold shrink-0">
          ↔
        </div>
      </div>

      {/* Invisible Interactive Drag Input Overlay */}
      <input
        type="range"
        min="0"
        max="100"
        value={sliderPos}
        onChange={(e) => setSliderPos(Number(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
        id="slider-range-input"
      />
    </div>
  );
}
