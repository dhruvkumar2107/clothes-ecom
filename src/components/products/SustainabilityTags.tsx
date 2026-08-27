'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, Droplets, MapPin, Factory, Recycle, ChevronDown, Info } from 'lucide-react';

interface SustainabilityData {
  fabricOrigin?: string;
  fabricComposition?: string;
  certifications?: string[];
  waterUsage?: string;
  carbonFootprint?: string;
  ethicalFactory?: string;
  recyclable?: boolean;
  recycledContent?: number;
  organicContent?: number;
  biodegradable?: boolean;
}

interface SustainabilityTagsProps {
  data: SustainabilityData;
  compact?: boolean;
}

const CERTIFICATION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  'GOTS': { label: 'Global Organic Textile Standard', icon: '🌱', color: 'bg-green-500/10 text-green-700 border-green-500/20' },
  'OEKO-TEX': { label: 'OEKO-TEX Standard 100', icon: '✅', color: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  'Fair Trade': { label: 'Fair Trade Certified', icon: '🤝', color: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  'B Corp': { label: 'B Corporation', icon: '🅱️', color: 'bg-purple-500/10 text-purple-700 border-purple-500/20' },
  'Cradle to Cradle': { label: 'Cradle to Cradle Certified', icon: '♻️', color: 'bg-teal-500/10 text-teal-700 border-teal-500/20' },
  'Bluesign': { label: 'Bluesign Approved', icon: '🔵', color: 'bg-sky-500/10 text-sky-700 border-sky-500/20' },
};

export function SustainabilityTags({ data, compact = false }: SustainabilityTagsProps) {
  const [expanded, setExpanded] = useState(false);

  const hasData = data.fabricOrigin || data.certifications?.length || data.recyclable ||
    data.organicContent || data.recycledContent || data.ethicalFactory;

  if (!hasData) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {data.organicContent && data.organicContent > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-green-500/10 text-green-700 border border-green-500/20 rounded-full">
            <Leaf className="w-3 h-3" aria-hidden="true" />
            {data.organicContent}% Organic
          </span>
        )}
        {data.recycledContent && data.recycledContent > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-700 border border-blue-500/20 rounded-full">
            <Recycle className="w-3 h-3" aria-hidden="true" />
            {data.recycledContent}% Recycled
          </span>
        )}
        {data.certifications?.slice(0, 2).map((cert) => (
          <span
            key={cert}
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium border rounded-full ${CERTIFICATION_LABELS[cert]?.color || 'bg-gray-500/10 text-gray-700 border-gray-500/20'}`}
          >
            {CERTIFICATION_LABELS[cert]?.icon || '✓'} {cert}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="border border-line rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-paper-2/50 transition-colors u-focus"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
            <Leaf className="w-4 h-4 text-green-600" aria-hidden="true" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-medium text-ink">Sustainability & Transparency</h4>
            <p className="text-xs text-muted">Fabric origin, certifications & impact</p>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-4">
              {/* Certifications */}
              {data.certifications && data.certifications.length > 0 && (
                <div>
                  <p className="u-label text-xs text-muted mb-2">Certifications</p>
                  <div className="flex flex-wrap gap-2">
                    {data.certifications.map((cert) => {
                      const certData = CERTIFICATION_LABELS[cert];
                      return (
                        <div
                          key={cert}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg ${certData?.color || 'bg-gray-500/10 text-gray-700 border-gray-500/20'}`}
                        >
                          <span>{certData?.icon || '✓'}</span>
                          <span>{cert}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Origin & Production */}
              <div className="grid grid-cols-2 gap-4">
                {data.fabricOrigin && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted mt-0.5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-muted">Fabric Origin</p>
                      <p className="text-sm text-ink font-medium">{data.fabricOrigin}</p>
                    </div>
                  </div>
                )}
                {data.ethicalFactory && (
                  <div className="flex items-start gap-2">
                    <Factory className="w-4 h-4 text-muted mt-0.5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-muted">Manufacturing</p>
                      <p className="text-sm text-ink font-medium">{data.ethicalFactory}</p>
                    </div>
                  </div>
                )}
                {data.waterUsage && (
                  <div className="flex items-start gap-2">
                    <Droplets className="w-4 h-4 text-muted mt-0.5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-muted">Water Usage</p>
                      <p className="text-sm text-ink font-medium">{data.waterUsage}</p>
                    </div>
                  </div>
                )}
                {data.carbonFootprint && (
                  <div className="flex items-start gap-2">
                    <Leaf className="w-4 h-4 text-muted mt-0.5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-muted">Carbon Footprint</p>
                      <p className="text-sm text-ink font-medium">{data.carbonFootprint}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Composition bars */}
              {(data.organicContent || data.recycledContent) && (
                <div className="space-y-2">
                  <p className="u-label text-xs text-muted">Material Composition</p>
                  {data.organicContent && data.organicContent > 0 && (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-ink">Organic Content</span>
                        <span className="text-green-600 font-medium">{data.organicContent}%</span>
                      </div>
                      <div className="h-2 bg-paper-2 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${data.organicContent}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="h-full bg-green-500 rounded-full"
                        />
                      </div>
                    </div>
                  )}
                  {data.recycledContent && data.recycledContent > 0 && (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-ink">Recycled Content</span>
                        <span className="text-blue-600 font-medium">{data.recycledContent}%</span>
                      </div>
                      <div className="h-2 bg-paper-2 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${data.recycledContent}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="h-full bg-blue-500 rounded-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* End of life */}
              <div className="flex items-center gap-4 pt-2 border-t border-line">
                {data.recyclable && (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Recycle className="w-3.5 h-3.5" aria-hidden="true" />
                    Recyclable
                  </span>
                )}
                {data.biodegradable && (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Leaf className="w-3.5 h-3.5" aria-hidden="true" />
                    Biodegradable
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
