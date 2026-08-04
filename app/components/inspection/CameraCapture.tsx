'use client';

import React, { useRef, useState, useEffect } from 'react';

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
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSnapping, setIsSnapping] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
          aspectRatio: { ideal: 1 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setIsCameraActive(true);

      // Play video once node is mounted
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((e) => console.error('Play error:', e));
        }
      }, 100);
    } catch (err: unknown) {
      console.error('Camera access error:', err);
      const message = err instanceof Error ? err.message : 'Unable to access camera.';
      setCameraError(`${message}. Please check browser camera permissions.`);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (isCameraActive) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Center-crop to 1:1 square from the video frame
  const takeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsSnapping(true);

    setTimeout(() => {
      const video = videoRef.current!;
      const canvas = canvasRef.current!;

      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 640;

      // Center-crop square
      const size = Math.min(vw, vh);
      const sx = Math.floor((vw - size) / 2);
      const sy = Math.floor((vh - size) / 2);

      const OUTPUT = 1024;
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, sx, sy, size, size, 0, 0, OUTPUT, OUTPUT);

        // Timestamp overlay
        const timestamp = new Date().toLocaleString();
        ctx.font = 'bold 18px sans-serif';
        const tw = ctx.measureText(timestamp).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(12, OUTPUT - 44, tw + 24, 32);
        ctx.fillStyle = 'white';
        ctx.fillText(timestamp, 24, OUTPUT - 22);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        onPhotoCaptured(dataUrl);
        stopCamera();
      }
      setIsSnapping(false);
    }, 80);
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const setVideoRef = (node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch((err) => console.error('Video play error:', err));
    }
  };

  return (
    <>
      {/* Hidden canvas for capture */}
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
                onClick={startCamera}
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
                Click button below to launch live camera mode and capture photo.
              </p>
            </div>

            {cameraError && (
              <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 px-3 py-2 rounded-lg text-left leading-relaxed">
                {cameraError}
              </p>
            )}

            <button
              type="button"
              onClick={startCamera}
              className="btn btn-primary text-xs flex items-center gap-2 px-5 py-2.5 shadow-lg shadow-ember-950/40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Open Live Camera
            </button>
          </div>
        )}
      </div>

      {/* ─── FULLSCREEN MODAL OVERLAY FOR LIVE CAMERA MODE ─── */}
      {isCameraActive && (
        <div className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-between p-4 md:p-8 animate-fade">
          {/* Top Control Bar */}
          <div className="w-full max-w-lg flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 shrink-0 z-10">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-rose-600/90 backdrop-blur px-3 py-1 rounded-full text-white text-xs font-bold shadow-md">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                LIVE
              </div>
              <span className="text-xs font-medium text-ink-200 truncate max-w-[180px]">{title}</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Flip camera button */}
              <button
                type="button"
                onClick={switchCamera}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10"
                title="Flip Camera"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 4v6h6" /><path d="M23 20v-6h-6" />
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
                </svg>
              </button>

              {/* Close / Cancel button */}
              <button
                type="button"
                onClick={stopCamera}
                className="p-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 transition-colors border border-rose-900/60"
                title="Close Camera"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* 1:1 Square Viewfinder Area */}
          <div className="relative w-full max-w-md aspect-square my-auto rounded-3xl overflow-hidden border-2 border-ember-500/50 shadow-2xl bg-black flex items-center justify-center">
            <video
              ref={setVideoRef}
              playsInline
              autoPlay
              muted
              className="w-full h-full object-cover"
            />

            {/* Framing Guides Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
              <div className="relative w-full h-full border border-white/20 rounded-2xl">
                {/* TL */}
                <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-ember-400 rounded-tl-xl" />
                {/* TR */}
                <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-ember-400 rounded-tr-xl" />
                {/* BL */}
                <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-ember-400 rounded-bl-xl" />
                {/* BR */}
                <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-ember-400 rounded-br-xl" />
                {/* Center crosshair */}
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <div className="w-6 h-6 border border-white rounded-full" />
                </div>
              </div>
            </div>

            {/* Flash Effect when snapping */}
            {isSnapping && (
              <div className="absolute inset-0 bg-white animate-ping pointer-events-none" />
            )}
          </div>

          {/* Bottom Action Bar with Big Shutter */}
          <div className="w-full max-w-lg flex items-center justify-between px-6 py-4 bg-black/60 backdrop-blur-md rounded-3xl border border-white/10 shrink-0 z-10">
            <button
              type="button"
              onClick={stopCamera}
              className="btn btn-ghost text-xs text-ink-300 hover:text-white"
            >
              Cancel
            </button>

            {/* Large Shutter Button */}
            <button
              type="button"
              onClick={takeSnapshot}
              disabled={isSnapping}
              className="
                flex items-center justify-center
                w-18 h-18 sm:w-20 sm:h-20 rounded-full
                bg-white
                border-4 border-white/40
                shadow-2xl shadow-ember-950/80
                active:scale-90 transition-transform duration-150
                disabled:opacity-50
              "
              title="Take Photo"
            >
              <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white border-4 border-black/10" />
            </button>

            <button
              type="button"
              onClick={switchCamera}
              className="btn btn-ghost text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 4v6h6" /><path d="M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
              Flip
            </button>
          </div>
        </div>
      )}
    </>
  );
}
