'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ShoppingBag, Camera, X, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface UGCPhoto {
  id: string;
  imageUrl: string;
  userName: string;
  userAvatar?: string;
  productName: string;
  productSlug: string;
  productPrice: number;
  productId: string;
  likes: number;
  caption?: string;
}

interface UGCWallProps {
  photos: UGCPhoto[];
  title?: string;
}

export function UGCWall({ photos, title = 'Styled by You' }: UGCWallProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<UGCPhoto | null>(null);
  const [hoveredPhoto, setHoveredPhoto] = useState<string | null>(null);

  if (photos.length === 0) return null;

  return (
    <section className="py-16 md:py-24" aria-labelledby="ugc-title">
      <div className="u-container">
        <div className="flex items-end justify-between gap-6 mb-12">
          <div>
            <span className="u-label text-accent mb-3 block flex items-center gap-2">
              <Camera className="w-4 h-4" aria-hidden="true" />
              Community
            </span>
            <h2 id="ugc-title" className="u-display text-3xl md:text-4xl">
              {title}
            </h2>
            <p className="text-sm text-muted mt-2">
              Real customers wearing LUMEN&CO. Tap to shop the look.
            </p>
          </div>
        </div>

        {/* Masonry-style grid */}
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
          {photos.map((photo, i) => (
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="break-inside-avoid"
            >
              <div
                className="relative group cursor-pointer rounded-lg overflow-hidden bg-paper-2"
                onMouseEnter={() => setHoveredPhoto(photo.id)}
                onMouseLeave={() => setHoveredPhoto(null)}
                onClick={() => setSelectedPhoto(photo)}
              >
                <div className="relative aspect-[3/4]">
                  <Image
                    src={photo.imageUrl}
                    alt={`${photo.userName}'s photo wearing ${photo.productName}`}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    loading="lazy"
                  />

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* User info */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <div className="flex items-center gap-2 mb-2">
                      {photo.userAvatar ? (
                        <Image
                          src={photo.userAvatar}
                          alt=""
                          width={24}
                          height={24}
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-accent">
                            {photo.userName.charAt(0)}
                          </span>
                        </div>
                      )}
                      <span className="text-paper text-xs font-medium">{photo.userName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-paper text-xs line-clamp-1">{photo.productName}</p>
                        <p className="text-paper/60 text-xs">{formatCurrency(photo.productPrice)}</p>
                      </div>
                      <Link
                        href={`/products/${photo.productSlug}`}
                        className="w-8 h-8 rounded-full bg-paper flex items-center justify-center hover:bg-paper/90 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Shop ${photo.productName}`}
                      >
                        <ShoppingBag className="w-4 h-4 text-ink" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>

                  {/* Like count */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-ink/50 backdrop-blur-sm rounded-full px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Heart className="w-3 h-3 text-paper fill-paper" aria-hidden="true" />
                    <span className="text-paper text-[10px] font-medium">{photo.likes}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Expanded photo modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-ink/95 flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-paper rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl grid md:grid-cols-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative aspect-[3/4] md:aspect-auto">
                <Image
                  src={selectedPhoto.imageUrl}
                  alt={`${selectedPhoto.userName}'s photo`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>

              <div className="p-6 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    {selectedPhoto.userAvatar ? (
                      <Image
                        src={selectedPhoto.userAvatar}
                        alt=""
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-accent">
                          {selectedPhoto.userName.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-ink">{selectedPhoto.userName}</p>
                      <p className="text-xs text-muted flex items-center gap-1">
                        <Heart className="w-3 h-3 fill-current" aria-hidden="true" />
                        {selectedPhoto.likes} likes
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPhoto(null)}
                    className="w-10 h-10 rounded-full hover:bg-ink-2 flex items-center justify-center transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 text-ink" aria-hidden="true" />
                  </button>
                </div>

                {selectedPhoto.caption && (
                  <p className="text-sm text-ink/80 mb-4">{selectedPhoto.caption}</p>
                )}

                <div className="mt-auto p-4 bg-paper-2 rounded-lg">
                  <p className="text-xs text-muted mb-2">Wearing</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-ink">{selectedPhoto.productName}</p>
                      <p className="text-sm text-accent font-semibold">{formatCurrency(selectedPhoto.productPrice)}</p>
                    </div>
                    <Link
                      href={`/products/${selectedPhoto.productSlug}`}
                      className="flex items-center gap-2 px-4 py-2 bg-ink text-paper rounded-md text-sm font-medium hover:bg-ink-2 transition-colors"
                    >
                      Shop now
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
