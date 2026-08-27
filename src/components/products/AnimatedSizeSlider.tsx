'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Ruler, Info, GripHorizontal } from 'lucide-react';

interface SizeChart {
  name: string;
  unit: string;
  columns: string[];
  rows: string[][];
  notes: string | null;
}

interface AnimatedSizeSliderProps {
  chart: SizeChart;
  productName: string;
}

export function AnimatedSizeSlider({ chart, productName }: AnimatedSizeSliderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const sizeColumn = useMemo(() => {
    return chart.columns.findIndex((col) =>
      ['size', 'tag', 'label'].includes(col.toLowerCase())
    );
  }, [chart.columns]);

  const sizeRows = chart.rows;
  const currentRow = sizeRows[sliderIndex];
  const currentSize = currentRow?.[sizeColumn] || '';

  // Map measurements to body zones for visual representation
  const bodyMeasurements = useMemo(() => {
    if (!currentRow) return {};
    const result: Record<string, number> = {};
    chart.columns.slice(1).forEach((col, i) => {
      const val = parseFloat(currentRow[i + 1]);
      if (!isNaN(val)) result[col.toLowerCase()] = val;
    });
    return result;
  }, [currentRow, chart.columns]);

  // Calculate visual body proportions based on measurements
  const bodyScale = useMemo(() => {
    const bust = bodyMeasurements.bust || bodyMeasurements.chest || 90;
    const waist = bodyMeasurements.waist || 72;
    const hip = bodyMeasurements.hip || 98;
    
    // Normalize to a 0-1 scale relative to the chart range
    const allBusts = sizeRows.map(r => parseFloat(r[chart.columns.indexOf('Bust') > -1 ? chart.columns.indexOf('Bust') : chart.columns.indexOf('Chest')] || '0')).filter(v => !isNaN(v) && v > 0);
    const minBust = Math.min(...allBusts);
    const maxBust = Math.max(...allBusts);
    const range = maxBust - minBust || 1;
    
    return {
      shoulder: 0.85 + ((bust - minBust) / range) * 0.3,
      torso: 0.8 + ((waist - minBust) / range) * 0.4,
      hip: 0.85 + ((hip - minBust) / range) * 0.3,
    };
  }, [bodyMeasurements, sizeRows, chart.columns]);

  const handleSliderChange = (value: number) => {
    const index = Math.round((value / 100) * (sizeRows.length - 1));
    setSliderIndex(Math.max(0, Math.min(sizeRows.length - 1, index)));
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm text-ink border border-line rounded-md hover:bg-ink hover:text-paper transition-all u-focus"
        aria-label={`View animated size guide for ${productName}`}
      >
        <Ruler className="w-4 h-4" aria-hidden="true" />
        Animated Size Guide
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-ink/95 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`Animated size guide for ${productName}`}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-paper rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-5 border-b border-line">
                <div>
                  <h2 className="u-display text-xl font-medium text-ink">Animated Size Guide</h2>
                  <p className="text-xs text-muted mt-1">Drag the slider to see how measurements change</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 rounded-full hover:bg-ink-2 flex items-center justify-center transition-colors u-focus"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-ink" aria-hidden="true" />
                </button>
              </div>

              <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-line">
                {/* Animated body silhouette */}
                <div className="relative p-8 bg-paper-2/30 flex flex-col items-center justify-center min-h-[500px]">
                  <div className="relative w-48 h-80">
                    <svg viewBox="0 0 200 400" className="w-full h-full" aria-hidden="true">
                      {/* Head */}
                      <ellipse cx="100" cy="35" rx="22" ry="28" fill="none" stroke="#d1d5db" strokeWidth="1.5" />
                      {/* Neck */}
                      <rect x="90" y="62" width="20" height="18" rx="4" fill="none" stroke="#d1d5db" strokeWidth="1.5" />
                      
                      {/* Animated body — scales with slider */}
                      <motion.path
                        d={`M${100 - 40 * bodyScale.shoulder} 80 
                            Q${100 - 20 * bodyScale.shoulder} 78 100 80 
                            Q${100 + 20 * bodyScale.shoulder} 78 ${100 + 40 * bodyScale.shoulder} 80`}
                        fill="none"
                        stroke="var(--color-accent)"
                        strokeWidth="2"
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                      />
                      
                      {/* Torso — animated */}
                      <motion.path
                        d={`M${100 - 40 * bodyScale.shoulder} 80 
                            L${100 - 45 * bodyScale.torso} 180 
                            Q${100 - 45 * bodyScale.torso} 200 ${100 - 30 * bodyScale.hip} 210 
                            L${100 - 30 * bodyScale.hip} 260`}
                        fill="none"
                        stroke="var(--color-accent)"
                        strokeWidth="2"
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                      />
                      <motion.path
                        d={`M${100 + 40 * bodyScale.shoulder} 80 
                            L${100 + 45 * bodyScale.torso} 180 
                            Q${100 + 45 * bodyScale.torso} 200 ${100 + 30 * bodyScale.hip} 210 
                            L${100 + 30 * bodyScale.hip} 260`}
                        fill="none"
                        stroke="var(--color-accent)"
                        strokeWidth="2"
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                      />
                      
                      {/* Arms */}
                      <path d={`M${100 - 40 * bodyScale.shoulder} 85 L35 170 L30 220`} fill="none" stroke="#d1d5db" strokeWidth="1.5" />
                      <path d={`M${100 + 40 * bodyScale.shoulder} 85 L165 170 L170 220`} fill="none" stroke="#d1d5db" strokeWidth="1.5" />
                      
                      {/* Legs */}
                      <path d="M70 260 L65 350 L60 380" fill="none" stroke="#d1d5db" strokeWidth="1.5" />
                      <path d="M130 260 L135 350 L140 380" fill="none" stroke="#d1d5db" strokeWidth="1.5" />

                      {/* Measurement labels */}
                      {bodyMeasurements.bust && (
                        <g>
                          <motion.line
                            x1="10" y1="120" x2="190" y2="120"
                            stroke="var(--color-accent)"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                          />
                          <text x="10" y="115" fill="var(--color-accent)" fontSize="10" fontWeight="600">
                            Bust: {bodyMeasurements.bust}{chart.unit === 'in' ? 'in' : 'cm'}
                          </text>
                        </g>
                      )}
                      {bodyMeasurements.waist && (
                        <g>
                          <motion.line
                            x1="10" y1="190" x2="190" y2="190"
                            stroke="var(--color-accent)"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                          />
                          <text x="10" y="185" fill="var(--color-accent)" fontSize="10" fontWeight="600">
                            Waist: {bodyMeasurements.waist}{chart.unit === 'in' ? 'in' : 'cm'}
                          </text>
                        </g>
                      )}
                      {bodyMeasurements.hip && (
                        <g>
                          <motion.line
                            x1="10" y1="240" x2="190" y2="240"
                            stroke="var(--color-accent)"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                          />
                          <text x="10" y="235" fill="var(--color-accent)" fontSize="10" fontWeight="600">
                            Hip: {bodyMeasurements.hip}{chart.unit === 'in' ? 'in' : 'cm'}
                          </text>
                        </g>
                      )}
                    </svg>
                  </div>

                  {/* Current size display */}
                  <motion.div
                    key={currentSize}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mt-6 text-center"
                  >
                    <span className="u-label text-xs text-muted">Current Size</span>
                    <p className="u-display text-4xl text-ink mt-1">{currentSize}</p>
                  </motion.div>
                </div>

                {/* Slider + Size list */}
                <div className="p-6 flex flex-col">
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="u-label text-xs text-muted">
                        {chart.unit === 'in' ? 'Inches' : 'Centimetres'}
                      </span>
                      <span className="text-sm font-medium text-ink">{currentSize}</span>
                    </div>
                    
                    {/* Slider */}
                    <div className="relative py-4">
                      <div className="relative h-2 bg-paper-2 rounded-full">
                        <motion.div
                          className="absolute h-full bg-accent rounded-full"
                          style={{ width: `${(sliderIndex / Math.max(sizeRows.length - 1, 1)) * 100}%` }}
                          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        />
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={sizeRows.length - 1}
                        value={sliderIndex}
                        onChange={(e) => setSliderIndex(parseInt(e.target.value))}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer"
                        aria-label="Select size"
                      />
                      {/* Thumb indicator */}
                      <motion.div
                        className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-accent rounded-full shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing"
                        style={{ left: `calc(${(sliderIndex / Math.max(sizeRows.length - 1, 1)) * 100}% - 12px)` }}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <GripHorizontal className="w-3 h-3 text-paper" />
                      </motion.div>
                    </div>

                    {/* Size labels */}
                    <div className="flex justify-between mt-1">
                      {sizeRows.map((row, i) => (
                        <button
                          key={i}
                          onClick={() => setSliderIndex(i)}
                          className={`text-[10px] font-medium transition-all ${
                            i === sliderIndex ? 'text-accent scale-110' : 'text-muted hover:text-ink'
                          }`}
                        >
                          {row[sizeColumn]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Measurement breakdown */}
                  <div className="flex-1 overflow-auto">
                    <h3 className="u-label text-xs text-muted mb-3">Measurements for {currentSize}</h3>
                    <div className="space-y-3">
                      {chart.columns.slice(1).map((col, i) => {
                        const val = currentRow?.[i + 1];
                        return (
                          <div key={col} className="flex items-center gap-3">
                            <span className="text-xs text-muted w-16 shrink-0">{col}</span>
                            <div className="flex-1 h-1.5 bg-paper-2 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-accent/60 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: val ? `${(parseFloat(val) / 150) * 100}%` : '0%' }}
                                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                              />
                            </div>
                            <span className="text-xs font-mono text-ink w-12 text-right">
                              {val || '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {chart.notes && (
                    <div className="mt-4 flex gap-2 text-xs text-muted pt-4 border-t border-line">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <p className="leading-relaxed">{chart.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
