import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
// @ts-ignore
import jsQR from 'jsqr';

interface AutoCroppedImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function AutoCroppedImage({ src, alt, className = "w-full h-full object-contain" }: AutoCroppedImageProps) {
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'processed' | 'failed'>('loading');

  useEffect(() => {
    if (!src) {
      setProcessedUrl(null);
      setStatus('failed');
      return;
    }

    setStatus('loading');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    // Use proxy to completely bypass CORS issues with Telegram's domain
    img.src = `/api/proxy-image?url=${encodeURIComponent(src)}`;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setProcessedUrl(src);
          setStatus('failed');
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Detect QR code location
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code && code.location) {
          const { topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner } = code.location;
          
          // Calculate bounding box boundaries
          const minX = Math.min(topLeftCorner.x, bottomLeftCorner.x, topRightCorner.x, bottomRightCorner.x);
          const maxX = Math.max(topLeftCorner.x, bottomLeftCorner.x, topRightCorner.x, bottomRightCorner.x);
          const minY = Math.min(topLeftCorner.y, bottomLeftCorner.y, topRightCorner.y, bottomRightCorner.y);
          const maxY = Math.max(topLeftCorner.y, bottomLeftCorner.y, topRightCorner.y, bottomRightCorner.y);

          const width = maxX - minX;
          const height = maxY - minY;

          // Add a generous padding (15%) around the QR code to ensure readability
          const paddingX = width * 0.15;
          const paddingY = height * 0.15;

          const cropX = Math.max(0, minX - paddingX);
          const cropY = Math.max(0, minY - paddingY);
          const cropW = Math.min(img.width - cropX, width + 2 * paddingX);
          const cropH = Math.min(img.height - cropY, height + 2 * paddingY);

          // Draw the cropped area to a new canvas
          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = cropW;
          cropCanvas.height = cropH;
          const cropCtx = cropCanvas.getContext('2d');
          
          if (cropCtx) {
            cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            const croppedDataUrl = cropCanvas.toDataURL('image/png');
            setProcessedUrl(croppedDataUrl);
            setStatus('processed');
            return;
          }
        }

        // If no QR code detected, fallback to original image
        setProcessedUrl(src);
        setStatus('failed');
      } catch (err) {
        console.error("AutoCrop error:", err);
        setProcessedUrl(src);
        setStatus('failed');
      }
    };

    img.onerror = () => {
      setProcessedUrl(src);
      setStatus('failed');
    };
  }, [src]);

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl border border-gray-100" style={{ width: '180px', height: '180px' }}>
        <Loader2 className="w-8 h-8 text-green-500 animate-spin mb-2" />
        <span className="text-[10px] text-gray-500 font-medium">QR কোড সাইজ করা হচ্ছে...</span>
      </div>
    );
  }

  return (
    <img 
      src={processedUrl || src} 
      alt={alt} 
      className={className} 
      referrerPolicy="no-referrer"
    />
  );
}
