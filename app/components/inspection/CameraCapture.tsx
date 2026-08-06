'use client';

import React, { useRef, useState } from 'react';

interface CameraCaptureProps {
  photoUrl: string | null;
  onPhotoCaptured: (dataUrl: string) => void;
  onPhotoCleared: () => void;
  title?: string;
  description?: string;
}

export default function CameraCapture({
  photoUrl,
  onPhotoCaptured,
  onPhotoCleared,
  title = 'Equipment Photo Verification (Live Camera Only)',
  description = 'Photo must be taken live on-site with your device camera to ensure authenticity.',
}: CameraCaptureProps) {
  const [isReading, setIsReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const openCamera = () => {
    setReadError(null);
    fileInputRef.current?.click();
  };

  const MAX_PHOTO_BYTES = 50 * 1024; // 50 KB target per captured photo
  const BASE_DIM = 1280;
  const BASE_QUALITY = 0.75;
  const MIN_QUALITY = 0.45;

  // Draw onto the canvas (with timestamp overlay) and encode as JPEG.
  const encodeWithTimestamp = (
    img: HTMLImageElement,
    canvas: HTMLCanvasElement,
    w: number,
    h: number,
    quality: number
  ): string => {
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.drawImage(img, 0, 0, w, h);

    // Timestamp overlay
    const timestamp = new Date().toLocaleString();
    const fontSize = Math.max(10, Math.round(h * 0.03));
    ctx.font = `bold ${fontSize}px sans-serif`;
    const tw = ctx.measureText(timestamp).width;
    const boxH = fontSize + 20;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(12, h - boxH - 12, tw + 24, boxH);
    ctx.fillStyle = 'white';
    ctx.fillText(timestamp, 24, h - 18);

    return canvas.toDataURL('image/jpeg', quality);
  };

  // Draw the captured photo onto a canvas, stamp a date/time overlay, and
  // export a JPEG data URL no larger than 50KB while keeping quality usable.
  const processWithTimestamp = (file: File) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const scale = Math.min(1, BASE_DIM / Math.max(img.width, img.height));
        let w = Math.max(1, Math.round(img.width * scale));
        let h = Math.max(1, Math.round(img.height * scale));
        let quality = BASE_QUALITY;
        let dataUrl = '';

        for (let attempt = 0; attempt < 12; attempt++) {
          dataUrl = encodeWithTimestamp(img, canvas, w, h, quality);
          // Estimate byte size from base64 string length (≈3 bytes per 4 chars)
          if (dataUrl.length * 0.75 <= MAX_PHOTO_BYTES) break;

          if (quality > MIN_QUALITY) {
            quality -= 0.05; // reduce compression quality before shrinking
          } else {
            // still over budget — downscale the image itself
            w = Math.max(320, Math.round(w * 0.8));
            h = Math.max(240, Math.round(h * 0.8));
            quality = BASE_QUALITY;
          }
        }

        if (dataUrl) onPhotoCaptured(dataUrl);
      } catch {
        setReadError('Failed to process the captured photo. Please try again.');
      } finally {
        URL.revokeObjectURL(objectUrl);
        setIsReading(false);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setReadError('Failed to read the captured photo. Please try again.');
      setIsReading(false);
    };

    img.src = objectUrl;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input so the same file can be selected again for retake
    if (e.target.value) e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setReadError('Please choose an image file.');
      return;
    }
    setIsReading(true);
    setReadError(null);
    processWithTimestamp(file);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Hidden canvas used to stamp the date/time onto the captured photo */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="space-y-3">
        {/* Label row */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <label className="field-label text-ink-200 text-sm font-semibold flex items-center gap-2">
              {title}
              <span className="text-xs font-normal text-rose-400 bg-rose-950/60 border border-rose-900/60 px-2.5 py-0.5 rounded-full">
                Live Capture Required
              </span>
            </label>
            <p className="text-xs text-ink-400">{description}</p>
          </div>
          {photoUrl && (
            <button
              type="button"
              onClick={onPhotoCleared}
              className="shrink-0 text-xs text-rose-400 hover:text-rose-300 underline underline-offset-4 transition-colors mt-0.5"
            >
              Retake
            </button>
          )}
        </div>

        {/* Captured photo — 1:1 preview card */}
        {photoUrl ? (
          <div className="relative group rounded-2xl overflow-hidden border border-line bg-black aspect-square max-w-sm mx-auto flex items-center justify-center shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt="Captured equipment photo"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-ink-950/75 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                type="button"
                onClick={openCamera}
                className="btn btn-primary text-xs flex items-center gap-2 px-5 py-2.5 shadow-lg"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Retake Photo
              </button>
            </div>
          </div>
        ) : (
          /* Empty state card in form */
          <div className="rounded-2xl border-2 border-dashed border-line bg-ink-900/30 p-6 text-center flex flex-col items-center justify-center gap-4 hover:border-ember-500/50 transition-colors aspect-square max-w-sm mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-ember-600/10 border border-ember-900/40 text-ember-400 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </div>

            <div>
                  <p className="text-sm font-semibold text-ink-200">{title}</p>
                  <p className="text-xs text-ink-400 mt-1 max-w-[220px] mx-auto leading-relaxed">
                    Click button below to launch your camera and capture a photo.
                  </p>
                </div>

                {readError && (
                  <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 px-3 py-2 rounded-lg text-left leading-relaxed">
                    {readError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={openCamera}
                  disabled={isReading}
                  className="btn btn-primary text-xs flex items-center gap-2 px-5 py-2.5 shadow-lg shadow-ember-950/40"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  {isReading ? 'Processing…' : 'Take Live Photo'}
                </button>
              </div>
          )}
      </div>
    </>
  );
}