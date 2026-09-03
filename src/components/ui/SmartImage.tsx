'use client';

import Image, { ImageProps } from 'next/image';

/**
 * Smart image component that auto-detects local vs remote images.
 * Local images (starting with /) are served unoptimized directly from public/.
 * Remote images go through Next.js optimization pipeline.
 */
export function SmartImage(props: ImageProps) {
  const isLocal = typeof props.src === 'string' && props.src.startsWith('/');

  return (
    <Image
      {...props}
      unoptimized={isLocal || props.unoptimized}
    />
  );
}
