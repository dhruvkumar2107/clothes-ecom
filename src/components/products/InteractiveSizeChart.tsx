'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Ruler, ChevronDown, Info } from 'lucide-react';

interface SizeChart {
  name: string;
  unit: string;
  columns: string[];
  rows: string[][];
  notes: string | null;
}

interface InteractiveSizeChartProps {
  chart: SizeChart;
  productName: string;
}

const BODY_ZONES: Record<string, { label: string; x: number; y: number; description: string }> = {
  bust: { label: 'Bust', x: 50, y: 32, description: 'Measure around the fullest part of your chest' },
  chest: { label: 'Chest', x: 50, y: 30, description: 'Measure around the fullest part of your chest' },
  waist: { label: 'Waist', x: 50, y: 48, description: 'Measure at your natural waistline' },
  hip: { label: 'Hip', x: 50, y: 62, description: 'Measure around the fullest part of your hips' },
  neck: { label: 'Neck', x: 50, y: 22, description: 'Measure around the base of your neck' },
  sleeve: { label: 'Sleeve', x: 28, y: 40, description: 'From centre back neck, over shoulder, to wrist' },
  length: { label: 'Length', x: 50, y: 55, description: 'From highest point to hem' },
};

export function InteractiveSizeChart({ chart, productName }: InteractiveSizeChartProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const sizeColumn = useMemo(() => {
    return chart.columns.findIndex((col) =>
      ['size', 'tag', 'label'].includes(col.toLowerCase())
    );
  }, [chart.columns]);

  const handleSizeSelect = (sizeName: string) => {
    setSelectedSize(selectedSize === sizeName ? null : sizeName);
  };

  const bodyZones = useMemo(() => {
    return chart.columns.slice(1).map((col) => {
      const key = col.toLowerCase();
      return BODY_ZONES[key] || { label: col, x: 50, y: 50, description: `Measure ${col}` };
    });
  }, [chart.columns]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm text-ink border border-line rounded-md hover:bg-ink hover:text-paper transition-all u-focus"
        aria-label={`View interactive size guide for ${productName}`}
      >
        <Ruler className="w-4 h-4" aria-hidden="true" />
        Interactive Size Guide
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
            aria-label={`Size guide for ${productName}`}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-paper rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-5 border-b border-line">
                <div>
                  <h2 className="u-display text-xl font-medium text-ink">Size Guide</h2>
                  <p className="text-xs text-muted mt-1">{productName}</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 rounded-full hover:bg-ink-2 flex items-center justify-center transition-colors u-focus"
                  aria-label="Close size guide"
                >
                  <X className="w-5 h-5 text-ink" aria-hidden="true" />
                </button>
              </div>

              <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-line max-h-[calc(90vh-80px)] overflow-auto">
                {/* Body Silhouette */}
                <div className="relative p-6 bg-paper-2/30 min-h-[500px] flex items-center justify-center">
                  <div className="relative w-48 h-80">
                    {/* SVG Body Silhouette */}
                    <svg viewBox="0 0 200 400" className="w-full h-full" aria-hidden="true">
                      {/* Head */}
                      <ellipse cx="100" cy="35" rx="22" ry="28" fill="none" stroke="#d1d5db" strokeWidth="1.5" />
                      {/* Neck */}
                      <rect x="90" y="62" width="20" height="18" rx="4" fill="none" stroke="#d1d5db" strokeWidth="1.5" />
                      {/* Shoulders */}
                      <path d="M60 80 Q80 78 100 80 Q120 78 140 80" fill="none" stroke="#d1d5db" strokeWidth="1.5" />
                      {/* Torso */}
                      <path d="M60 80 L55 180 Q55 200 70 210 L70 260" fill="none" stroke="#d1d5db" strokeWidth="1.5" />
                      <path d="M140 80 L145 180 Q145 200 130 210 L130 260" fill="none" stroke="#d1d5db" strokeWidth="1.5" />
                      {/* Arms */}
                      <path d="M60 85 L35 170 L30 220" fill="none" stroke="#d1d5db" strokeWidth="1.5" />
                      <path d="M140 85 L165 170 L170 220" fill="none" stroke="#d1d5db" strokeWidth="1.5" />
                      {/* Legs */}
                      <path d="M70 260 L65 350 L60 380" fill="none" stroke="#d1d5db" strokeWidth="1.5" />
                      <path d="M130 260 L135 350 L140 380" fill="none" stroke="#d1d5db" strokeWidth="1.5" />

                      {/* Measurement indicators */}
                      {hoveredColumn !== null && hoveredColumn > 0 && bodyZones[hoveredColumn - 1] && (
                        <>
                          <line
                            x1="20"
                            y1={bodyZones[hoveredColumn - 1].y * 4}
                            x2="180"
                            y2={bodyZones[hoveredColumn - 1].y * 4}
                            stroke="var(--color-accent)"
                            strokeWidth="2"
                            strokeDasharray="4 4"
                          />
                          <circle
                            cx="100"
                            cy={bodyZones[hoveredColumn - 1].y * 4}
                            r="6"
                            fill="var(--color-accent)"
                            className="animate-pulse"
                          />
                          <text
                            x="100"
                            y={bodyZones[hoveredColumn - 1].y * 4 - 12}
                            textAnchor="middle"
                            fill="var(--color-accent)"
                            fontSize="12"
                            fontWeight="600"
                          >
                            {bodyZones[hoveredColumn - 1].label}
                          </text>
                        </>
                      )}

                      {/* Size labels on body */}
                      {selectedSize && chart.rows.map((row, i) => {
                        if (row[sizeColumn] !== selectedSize) return null;
                        return chart.columns.slice(1).map((col, j) => {
                          const zone = bodyZones[j];
                          if (!zone) return null;
                          return (
                            <g key={`${i}-${j}`}>
                              <text
                                x={zone.x < 50 ? 15 : 185}
                                y={zone.y * 4}
                                textAnchor={zone.x < 50 ? 'start' : 'end'}
                                fill="var(--color-ink)"
                                fontSize="11"
                                fontWeight="500"
                              >
                                {row[j + 1]}
                              </text>
                              <line
                                x1={zone.x < 50 ? 35 : 165}
                                y1={zone.y * 4}
                                x2={zone.x < 50 ? 55 : 145}
                                y2={zone.y * 4}
                                stroke="var(--color-ink)"
                                strokeWidth="1"
                              />
                            </g>
                          );
                        });
                      })}
                    </svg>

                    {/* Zone labels */}
                    {bodyZones.map((zone, i) => (
                      <div
                        key={i}
                        className="absolute text-[10px] text-muted transition-colors"
                        style={{
                          left: `${zone.x}%`,
                          top: `${zone.y}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        {hoveredColumn === i + 1 && (
                          <span className="text-accent font-medium">{zone.label}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Size Table */}
                <div className="p-6">
                  <div className="mb-4">
                    <h3 className="u-label text-xs text-muted mb-1">
                      All measurements in {chart.unit === 'in' ? 'inches' : 'centimetres'}
                    </h3>
                    <p className="text-xs text-muted">
                      Click a row to see measurements on the body
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line">
                          {chart.columns.map((col, i) => (
                            <th
                              key={i}
                              className="u-label py-3 px-3 text-left whitespace-nowrap transition-colors cursor-pointer"
                              onMouseEnter={() => setHoveredColumn(i)}
                              onMouseLeave={() => setHoveredColumn(null)}
                              style={{
                                color: hoveredColumn === i ? 'var(--color-accent)' : undefined,
                                backgroundColor: hoveredColumn === i ? 'var(--color-paper-2)' : undefined,
                              }}
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {chart.rows.map((row, i) => {
                          const isSelected = selectedSize === row[sizeColumn];
                          return (
                            <tr
                              key={i}
                              className="border-b border-line/50 cursor-pointer transition-all"
                              onMouseEnter={() => setHoveredRow(i)}
                              onMouseLeave={() => setHoveredRow(null)}
                              onClick={() => sizeColumn >= 0 && handleSizeSelect(row[sizeColumn])}
                              style={{
                                backgroundColor: isSelected
                                  ? 'var(--color-accent)'
                                  : hoveredRow === i
                                  ? 'var(--color-paper-2)'
                                  : undefined,
                                color: isSelected ? 'white' : undefined,
                              }}
                            >
                              {row.map((cell, j) => (
                                <td
                                  key={j}
                                  className={`py-3 px-3 whitespace-nowrap transition-colors ${
                                    j === 0 ? 'font-semibold' : ''
                                  }`}
                                  style={{
                                    color: isSelected
                                      ? 'white'
                                      : hoveredColumn === j
                                      ? 'var(--color-accent)'
                                      : undefined,
                                  }}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {selectedSize && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-3 bg-accent/10 border border-accent/20 rounded-lg"
                    >
                      <p className="text-xs text-ink font-medium">
                        Selected: {selectedSize}
                      </p>
                      <p className="text-xs text-muted mt-1">
                        Measurements shown on the body silhouette →
                      </p>
                    </motion.div>
                  )}

                  {chart.notes && (
                    <div className="mt-4 flex gap-2 text-xs text-muted">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <p className="leading-relaxed">{chart.notes}</p>
                    </div>
                  )}

                  <div className="mt-6 p-4 bg-paper-2 rounded-lg">
                    <h4 className="text-xs font-semibold text-ink mb-2">How to measure</h4>
                    <div className="space-y-2 text-xs text-muted">
                      {bodyZones.slice(0, 3).map((zone, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="font-medium text-ink shrink-0">{zone.label}:</span>
                          <span>{zone.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
