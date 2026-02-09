'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageZoomProps {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  className?: string;
}

export function ImageZoom({
  src,
  alt,
  caption,
  width = 800,
  height = 450,
  className,
}: ImageZoomProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Thumbnail */}
      <figure className={cn('my-6', className)}>
        <button
          onClick={() => setIsOpen(true)}
          className="relative group w-full cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg overflow-hidden"
          aria-label={`Zoom image: ${alt}`}
        >
          <div className="relative rounded-lg overflow-hidden border border-border bg-muted">
            {src.startsWith('http') ? (
              // External image - using img for external URLs
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt}
                className="w-full h-auto object-cover"
              />
            ) : (
              // Local image with Next.js Image
              <Image
                src={src}
                alt={alt}
                width={width}
                height={height}
                className="w-full h-auto object-cover"
              />
            )}
            
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white rounded-full p-2">
                <ZoomIn className="h-5 w-5" />
              </div>
            </div>
          </div>
        </button>
        
        {caption && (
          <figcaption className="mt-2 text-center text-sm text-muted-foreground">
            {caption}
          </figcaption>
        )}
      </figure>

      {/* Lightbox */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Zoomed image: ${alt}`}
        >
          {/* Close button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Image */}
          <div 
            className="max-w-[90vw] max-h-[90vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {src.startsWith('http') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt}
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
            ) : (
              <Image
                src={src}
                alt={alt}
                width={1600}
                height={900}
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
            )}
            
            {caption && (
              <p className="text-center text-white/80 text-sm mt-4">
                {caption}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}


