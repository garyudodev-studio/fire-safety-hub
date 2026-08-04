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
  description = 'Photo must be taken live on-site with your device camera to ensure authenticity and prevent fraud.',
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
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
    if (isCameraActive) {
      setTimeout(() => startCamera(), 200);
    }
  };

  const setVideoRef = (node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch((err) => console.error('Video play error:', err));
    }
  };

  useEffect(() => {
    if (!photoUrl && !isCameraActive && !cameraError) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUrl]);

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

        {/* Captured photo — 1:1 */}
        {photoUrl ? (
          <div className="relative group rounded-2xl overflow-hidden border border-line bg-black aspect-square max-w-sm mx-auto flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt="Captured equipment"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                type="button"
                onClick={startCamera}
                className="btn btn-primary text-xs flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Retake Photo
              </button>
            </div>
          </div>
        ) : isCameraActive ? (
          /* ── Mobile-first fullscreen camera overlay ── */
          <div className="fixed inset-0 z-[9999] bg-black flex flex-col md:relative md:inset-auto md:z-auto md:rounded-2xl md:overflow-hidden md:border md:border-ember-500/40 md:aspect-square md:max-w-sm md:mx-auto">

            {/* Top bar (mobile) */}
            <div className="md:hidden flex items-center justify-between px-5 pt-safe-top pt-10 pb-3 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
              {/* LIVE badge */}
              <div className="flex items-center gap-1.5 bg-rose-600/90 backdrop-blur px-3 py-1 rounded-full text-white text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                LIVE
              </div>
              {/* Flip camera */}
              <button
                type="button"
                onClick={switchCamera}
                className="p-2.5 rounded-full bg-black/50 backdrop-blur text-white border border-white/10"
                title="Flip Camera"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 4v6h6" /><path d="M23 20v-6h-6" />
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
                </svg>
              </button>
            </div>

            {/* Video — fills screen on mobile, square on desktop */}
            <div className="relative flex-1 md:flex-none md:aspect-square overflow-hidden">
              <video
                ref={setVideoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover"
              />

              {/* Corner frame guides */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-4/5 aspect-square max-w-xs">
                  {/* TL */}
                  <span className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/70 rounded-tl-lg" />
                  {/* TR */}
                  <span className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/70 rounded-tr-lg" />
                  {/* BL */}
                  <span className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/70 rounded-bl-lg" />
                  {/* BR */}
                  <span className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/70 rounded-br-lg" />
                </div>
              </div>

              {/* Snap flash animation */}
              {isSnapping && (
                <div className="absolute inset-0 bg-white/80 animate-ping pointer-events-none" />
              )}

              {/* Desktop LIVE badge */}
              <div className="hidden md:flex absolute top-3 left-3 items-center gap-1.5 bg-rose-600/90 backdrop-blur px-2.5 py-1 rounded-full text-white text-xs font-bold z-10">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                LIVE
              </div>
            </div>

            {/* Bottom action bar */}
            <div className="
              absolute bottom-0 left-0 right-0
              pb-safe-bottom
              bg-gradient-to-t from-black/90 via-black/50 to-transparent
              pt-16 pb-10 px-6
              flex items-center justify-between
              md:static md:bg-black/80 md:pt-3 md:pb-3 md:px-4
            ">
              {/* Desktop flip button */}
              <button
                type="button"
                onClick={switchCamera}
                className="hidden md:flex p-2.5 rounded-full bg-ink-900/80 hover:bg-ink-800 text-ink-200 border border-line backdrop-blur-md transition-all"
                title="Flip Camera"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 4v6h6" /><path d="M23 20v-6h-6" />
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
                </svg>
              </button>

              {/* Cancel button (left on mobile, right-ish on desktop) */}
              <button
                type="button"
                onClick={stopCamera}
                className="flex items-center justify-center w-12 h-12 rounded-full bg-black/60 backdrop-blur text-rose-400 border border-rose-900/50 transition-all active:scale-95 md:w-10 md:h-10"
                title="Cancel Camera"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              {/* Shutter button — center on mobile */}
              <button
                type="button"
                onClick={takeSnapshot}
                disabled={isSnapping}
                className="
                  flex items-center justify-center
                  w-20 h-20 rounded-full
                  bg-white
                  border-4 border-white/30
                  shadow-2xl shadow-black/60
                  active:scale-90 transition-transform duration-100
                  disabled:opacity-60
                  md:w-14 md:h-14
                "
                title="Take Photo"
              >
                <span className="w-14 h-14 rounded-full bg-white border-4 border-black/10 md:w-10 md:h-10" />
              </button>

              {/* Spacer (mirrors cancel for symmetry on mobile) */}
              <div className="w-12 h-12 md:hidden" />
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="rounded-2xl border-2 border-dashed border-line bg-ink-900/30 p-8 text-center flex flex-col items-center justify-center gap-4 hover:border-ink-600 transition-colors aspect-square max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-ember-600/10 border border-ember-900/40 text-ember-400 flex items-center justify-center">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </div>

            <div>
              <p className="text-sm font-semibold text-ink-200">Live Camera Photo Required</p>
              <p className="text-xs text-ink-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
                Take a live 1:1 square photo of the equipment using your device camera.
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
              className="btn btn-primary text-sm flex items-center gap-2 px-6 py-2.5 shadow-lg shadow-ember-950/40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Open Camera
            </button>
          </div>
        )}
      </div>
    </>
  );
}
