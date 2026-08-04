'use client';

import React, { useRef, useState, useEffect } from 'react';

interface CameraCaptureProps {
  photoUrl: string | null;
  onPhotoCaptured: (dataUrl: string) => void;
  onPhotoCleared: () => void;
  title?: string;
  description?: string;
}

export default function CameraCapture({ photoUrl, onPhotoCaptured, onPhotoCleared, title = 'Equipment Photo Verification (Live Camera Only)', description = 'Photo must be taken live on-site with your device camera to ensure authenticity and prevent fraud.' }: CameraCaptureProps) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  
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
          height: { ideal: 720 },
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
  }, [isCameraActive, facingMode]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const takeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    const MAX_DIM = 1280;
    let width = video.videoWidth || 640;
    let height = video.videoHeight || 480;

    if (width > MAX_DIM || height > MAX_DIM) {
      if (width > height) {
        height = Math.round((height * MAX_DIM) / width);
        width = MAX_DIM;
      } else {
        width = Math.round((width * MAX_DIM) / height);
        height = MAX_DIM;
      }
    }
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);

      // Add timestamp
      const timestamp = new Date().toLocaleString();
      ctx.font = '16px sans-serif';
      const textWidth = ctx.measureText(timestamp).width;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(10, height - 40, textWidth + 20, 30);
      ctx.fillStyle = 'white';
      ctx.fillText(timestamp, 20, height - 20);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      onPhotoCaptured(dataUrl);
      stopCamera();
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    if (isCameraActive) {
      setTimeout(() => {
        startCamera();
      }, 200);
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
    // Auto-start live camera feed when component is mounted without photo
    if (!photoUrl && !isCameraActive && !cameraError) {
      startCamera();
    }
  }, [photoUrl]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <label className="field-label text-ink-200 text-sm font-semibold flex items-center gap-2">
            {title}
            <span className="text-xs font-normal text-rose-400 bg-rose-950/60 border border-rose-900/60 px-2.5 py-0.5 rounded-full">
              Live Capture Required
            </span>
          </label>
          <p className="text-xs text-ink-400">
            {description}
          </p>
        </div>

        {photoUrl && (
          <button
            type="button"
            onClick={onPhotoCleared}
            className="text-xs text-rose-400 hover:text-rose-300 underline underline-offset-4 transition-colors"
          >
            Retake Live Photo
          </button>
        )}
      </div>

      {/* Canvas hidden for capturing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Captured Image Display */}
      {photoUrl ? (
        <div className="relative group rounded-2xl overflow-hidden border border-line bg-ink-900/60 aspect-video max-h-72 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="Captured equipment" className="w-full h-full object-contain" />
          <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={startCamera}
              className="btn btn-primary text-xs flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Retake Photo with Camera
            </button>
          </div>
        </div>
      ) : isCameraActive ? (
        /* Live Camera Feed */
        <div className="relative rounded-2xl overflow-hidden border border-ember-500/40 bg-black aspect-video max-h-80 flex items-center justify-center shadow-lg shadow-ember-950/20">
          <video ref={setVideoRef} playsInline autoPlay muted className="w-full h-full object-cover" />

          {/* Camera overlay controls */}
          <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4 px-4">
            <button
              type="button"
              onClick={switchCamera}
              className="p-3 rounded-full bg-ink-900/80 hover:bg-ink-800 text-ink-200 border border-line backdrop-blur-md transition-all"
              title="Flip Camera"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 10c0-4.418-3.582-8-8-8s-8 3.582-8 8e-8 8 3.582 8 8" />
                <path d="m4 6 4 4-4 4" />
                <path d="m20 18-4-4 4-4" />
              </svg>
            </button>

            <button
              type="button"
              onClick={takeSnapshot}
              className="px-6 py-3 rounded-full bg-ember-600 hover:bg-ember-500 text-white font-semibold text-sm border-2 border-white/20 shadow-xl flex items-center gap-2 transition-all scale-105 active:scale-95"
            >
              <span className="w-3 h-3 rounded-full bg-white animate-ping" />
              Snap Live Photo
            </button>

            <button
              type="button"
              onClick={stopCamera}
              className="p-3 rounded-full bg-ink-900/80 hover:bg-ink-800 text-rose-400 border border-line backdrop-blur-md transition-all"
              title="Cancel Camera"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-2xl border-2 border-dashed border-line bg-ink-900/30 p-8 text-center flex flex-col items-center justify-center gap-4 hover:border-ink-600 transition-colors">
          <div className="w-14 h-14 rounded-2xl bg-ember-600/10 border border-ember-900/40 text-ember-400 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          </div>

          <div>
            <p className="text-sm font-medium text-ink-200">Live Camera Photo Required</p>
            <p className="text-xs text-ink-400 mt-1 max-w-xs">
              File uploads are disabled. Take a live photo of the equipment using your device camera.
            </p>
          </div>

          {cameraError && (
            <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 px-3 py-1.5 rounded-lg">
              {cameraError}
            </p>
          )}

          <button
            type="button"
            onClick={startCamera}
            className="btn btn-primary text-xs flex items-center gap-2 px-6 py-2.5 shadow-lg shadow-ember-950/40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Open Live Camera
          </button>
        </div>
      )}
    </div>
  );
}
