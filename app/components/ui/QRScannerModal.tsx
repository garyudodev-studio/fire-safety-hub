'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

interface QRScannerModalProps {
  onScan: (data: string) => void;
  onClose: () => void;
  title?: string;
}

export default function QRScannerModal({ onScan, onClose, title = 'Scan Equipment QR Code' }: QRScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const scanningRef = useRef(true);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [usingCamera, setUsingCamera] = useState(true);
  const [found, setFound] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const handleDecoded = (value: string) => {
    if (!scanningRef.current) return;
    scanningRef.current = false;
    stopCamera();
    setFound(value);
    setIsScanning(false);
    onScan(value);
  };

  const scanLoop = () => {
    if (!scanningRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
    if (code && code.data) {
      handleDecoded(code.data);
      return;
    }
    rafRef.current = requestAnimationFrame(scanLoop);
  };

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setFound(null);
    scanningRef.current = true;
    setIsScanning(true);
    setUsingCamera(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setCameraError(null);
      scanLoop();
    } catch {
      setCameraError('Camera is not available or permission was denied. Use the "Upload QR Photo" option instead.');
      stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopCamera]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target.value) e.target.value = '';
    if (!file) return;
    setUsingCamera(false);
    setIsScanning(true);
    setCameraError(null);
    setFound(null);

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
        if (code && code.data) {
          handleDecoded(code.data);
        } else {
          setCameraError('No QR code detected in the uploaded image. Please try a clearer photo.');
          setIsScanning(false);
        }
      } catch {
        setCameraError('Failed to read the image. Please try again.');
        setIsScanning(false);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setCameraError('Failed to load the image. Please try again.');
      setIsScanning(false);
    };
    img.src = objectUrl;
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto p-4 md:p-6 bg-ink-950/80 backdrop-blur-md flex items-center justify-center animate-fade">
      <div className="relative w-full max-w-md bg-ink-900 border border-line rounded-3xl shadow-2xl p-6">
        <div className="flex items-center justify-between border-b border-line pb-4 mb-5">
          <h3 className="text-lg font-bold text-ink-100 flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
              <path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
            </svg>
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-ink-100 text-sm font-medium"
          >
            ✕ Close
          </button>
        </div>

        {/* Video preview */}
        {usingCamera ? (
          <div className="relative rounded-2xl overflow-hidden border border-line bg-black aspect-square flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Scan frame overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-3/5 aspect-square border-2 border-ember-400/80 rounded-xl" />
            </div>
            {isScanning && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs text-ink-200 bg-ink-950/70 backdrop-blur px-3 py-1.5 rounded-full">
                <span className="h-2 w-2 rounded-full bg-ember-500 animate-pulse" />
                Scanning… point the camera at the QR code
              </div>
            )}
            {found && (
              <div className="absolute inset-0 bg-emerald-950/60 flex items-center justify-center">
                <span className="text-emerald-400 font-bold text-sm">QR Code detected!</span>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-ink-950/60 p-6 text-center text-sm text-ink-300">
            Decoding uploaded QR image…
          </div>
        )}

        {cameraError && (
          <div className="mt-4 rounded-xl border p-3 text-xs leading-relaxed tone-rose">
            {cameraError}
          </div>
        )}

        {/* Controls */}
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-soft text-xs flex-1 py-2.5"
          >
            Upload QR Photo
          </button>
          {!usingCamera && (
            <button
              type="button"
              onClick={startCamera}
              className="btn btn-ghost text-xs flex-1 py-2.5"
            >
              Use Camera
            </button>
          )}
        </div>
        <p className="mt-3 text-[11px] text-ink-500 text-center">
          The QR code on the equipment ID tag points to its unique record. Scan it to auto-select the equipment.
        </p>

        {/* Hidden file input for QR image upload fallback */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Hidden canvas used for decoding */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
