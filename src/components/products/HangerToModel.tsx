'use client';

import { useState } from 'react';
import { SmartImage } from '@/components/ui/SmartImage';
import { motion, AnimatePresence } from 'framer-motion';
import { Shirt } from 'lucide-react';

interface HangerToModelProps {
  imageUrl: string;
  alt: string;
  isHovered: boolean;
}

export function HangerToModel({ imageUrl, alt, isHovered }: HangerToModelProps) {
  return (
    <div className="absolute inset-0">
      {/* Hanger icon state — shown before hover */}
      <AnimatePresence>
        {!isHovered && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex items-center justify-center bg-paper-2"
          >
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="flex flex-col items-center gap-2 text-muted"
            >
              {/* Hanger SVG */}
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-line-2">
                <path d="M32 8 L32 16" />
                <path d="M28 8 Q32 4 36 8" />
                <path d="M12 28 L32 16 L52 28" />
                <path d="M12 28 L8 32 L56 32 L52 28" />
                <line x1="8" y1="32" x2="8" y2="56" />
                <line x1="56" y1="32" x2="56" y2="56" />
              </svg>
              <span className="text-[10px] uppercase tracking-wider">Hover to see on model</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Model image — appears on hover with fabric unfurl effect */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ 
              opacity: 0, 
              scale: 0.9,
              clipPath: 'polygon(50% 0%, 50% 0%, 50% 100%, 50% 100%)',
            }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
            }}
            exit={{ 
              opacity: 0, 
              scale: 0.95,
              clipPath: 'polygon(50% 0%, 50% 0%, 50% 100%, 50% 100%)',
            }}
            transition={{ 
              duration: 0.6, 
              ease: [0.16, 1, 0.3, 1],
              clipPath: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
            }}
            className="absolute inset-0"
          >
            <SmartImage
              src={imageUrl}
              alt={alt}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              loading="lazy"
            />
            {/* Fabric unfurl shimmer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
