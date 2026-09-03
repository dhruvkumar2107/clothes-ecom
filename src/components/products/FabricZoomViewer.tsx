'use client';

import { useState, useRef, useCallback } from 'react';
import { SmartImage } from '@/components/ui/SmartImage';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, RotateCcw, Eye } from 'lucide-react';

interface FabricZoomViewerProps {
  images: { url: string; alt: string; kind: string; colorKey: string | null }[];
  selectedColor: string;
  productName: string;
}

export function FabricZoomViewer({ images, selectedColor, productName }: FabricZoomViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const colorImages = images.filter(
    (img) => img.kind === 'gallery' && (!img.colorKey || img.colorKey.toLowerCase() === selectedColor.toLowerCase())
  );
  const displayImages = colorImages.length > 0 ? colorImages : images.filter((img) => img.kind === 'gallery');
  const activeImage = displayImages[0];

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev - 0.5, 1));
    if (zoomLevel <= 1.5) setPosition({ x: 0, y: 0 });
  }, [zoomLevel]);

  const handleReset = useCallback(() => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoomLevel > 1) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      }
    },
    [zoomLevel, position]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && zoomLevel > 1) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart, zoomLevel]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.2 : 0.2;
      setZoomLevel((prev) => {
        const next = Math.max(1, Math.min(4, prev + delta));
        if (next <= 1) setPosition({ x: 0, y: 0 });
        return next;
      });
    },
    []
  );

  if (!activeImage) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm text-ink border border-line rounded-md hover:bg-ink hover:text-paper transition-all u-focus"
        aria-label="View fabric close-up"
      >
        <ZoomIn className="w-4 h-4" aria-hidden="true" />
        Fabric Close-up
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] bg-ink/95 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Fabric texture viewer"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div>
                <h3 className="text-paper font-medium">{productName}</h3>
                <p className="text-white/50 text-xs mt-0.5">
                  Fabric close-up — scroll to zoom, drag to pan
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 1}
                  className="w-9 h-9 rounded-md bg-white/10 flex items-center justify-center text-paper hover:bg-white/20 transition-colors disabled:opacity-30"
                  aria-label="Zoom out"
                >
                  −
                </button>
                <span className="text-paper text-sm font-mono w-16 text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 4}
                  className="w-9 h-9 rounded-md bg-white/10 flex items-center justify-center text-paper hover:bg-white/20 transition-colors disabled:opacity-30"
                  aria-label="Zoom in"
                >
                  +
                </button>
                <button
                  onClick={handleReset}
                  className="w-9 h-9 rounded-md bg-white/10 flex items-center justify-center text-paper hover:bg-white/20 transition-colors ml-2"
                  aria-label="Reset zoom"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    handleReset();
                  }}
                  className="w-9 h-9 rounded-md bg-white/10 flex items-center justify-center text-paper hover:bg-white/20 transition-colors ml-2"
                  aria-label="Close viewer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div
              ref={containerRef}
              className="flex-1 overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            >
              <motion.div
                animate={{
                  scale: zoomLevel,
                  x: position.x,
                  y: position.y,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="relative"
                style={{ transformOrigin: 'center center' }}
              >
                <SmartImage
                  src={activeImage.url}
                  alt={activeImage.alt || `${productName} fabric detail`}
                  width={1200}
                  height={1600}
                  className="max-h-[80vh] w-auto object-contain select-none"
                  draggable={false}
                  priority
                />
              </motion.div>
            </div>

            <div className="p-4 border-t border-white/10 flex items-center justify-center gap-4">
              <div className="flex items-center gap-2 text-white/40 text-xs">
                <Eye className="w-4 h-4" aria-hidden="true" />
                <span>Zoom: {Math.round(zoomLevel * 100)}%</span>
              </div>
              {zoomLevel > 1 && (
                <p className="text-white/40 text-xs">
                  Drag to pan around the fabric detail
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
