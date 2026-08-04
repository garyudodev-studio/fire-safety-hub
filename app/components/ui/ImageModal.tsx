'use client';

import React, { useEffect } from 'react';

interface ImageModalProps {
  imageUrl: string | null;
  title?: string;
  onClose: () => void;
}

export default function ImageModal({ imageUrl, title = 'Image Preview', onClose }: ImageModalProps) {
  useEffect(() => {
    if (!imageUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [imageUrl, onClose]);

  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-ink-950/90 backdrop-blur-md animate-fade"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full bg-ink-900 border border-line rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-ink-950/60 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-ember-500" />
            <h3 className="text-sm font-semibold text-ink-100">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-ink-400 hover:text-ink-100 hover:bg-ink-800 transition-colors"
            title="Close preview"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Protected Image Area */}
        <div
          className="flex-1 p-6 overflow-hidden flex items-center justify-center bg-black/80 relative select-none"
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={title}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl pointer-events-auto"
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-line bg-ink-950/60 flex items-center justify-between text-xs text-ink-500 shrink-0">
          <span>Protected Image Preview</span>
          <button onClick={onClose} className="btn btn-ghost text-xs py-1 px-4">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
