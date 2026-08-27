'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

interface FabricSwipeProps {
  images: { url: string; alt: string; kind?: string; colorKey?: string }[];
  selectedColor: string;
  productName: string;
}

export function FabricSwipe({ images, selectedColor, productName }: FabricSwipeProps) {
  const [direction, setDirection] = useState(0);
  const [prevColor, setPrevColor] = useState(selectedColor);

  if (selectedColor !== prevColor) {
    const prevIdx = images.findIndex(
      (img) => img.colorKey?.toLowerCase() === prevColor.toLowerCase()
    );
    const newIdx = images.findIndex(
      (img) => img.colorKey?.toLowerCase() === selectedColor.toLowerCase()
    );
    setDirection(newIdx >= prevIdx ? 1 : -1);
    setPrevColor(selectedColor);
  }

  const colorImage = images.find(
    (img) => img.colorKey?.toLowerCase() === selectedColor.toLowerCase()
  );
  const activeImage = colorImage || images[0];

  if (!activeImage) return null;

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0,
      scale: 0.95,
    }),
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Fabric drape overlay — CSS gradient sweep */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={`${activeImage.url}-${selectedColor}`}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: 'spring', stiffness: 300, damping: 30 },
            opacity: { duration: 0.3 },
            scale: { duration: 0.4 },
          }}
          className="absolute inset-0"
        >
          <Image
            src={activeImage.url}
            alt={activeImage.alt || productName}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            loading="lazy"
          />
        </motion.div>
      </AnimatePresence>

      {/* Fabric drape sweep effect */}
      <AnimatePresence>
        {selectedColor !== prevColor && (
          <motion.div
            initial={{ x: direction > 0 ? '100%' : '-100%' }}
            animate={{ x: direction > 0 ? '-100%' : '100%' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-10 pointer-events-none"
            style={{
              background: `linear-gradient(${direction > 0 ? '90deg' : '270deg'}, 
                transparent 0%, 
                rgba(0,0,0,0.08) 30%, 
                rgba(0,0,0,0.15) 50%, 
                rgba(0,0,0,0.08) 70%, 
                transparent 100%)`,
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
