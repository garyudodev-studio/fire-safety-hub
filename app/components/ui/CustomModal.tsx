'use client';

import React, { useEffect } from 'react';

// ─── Confirm Modal ────────────────────────────────────────────────────────────

export interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'warning';
  onConfirm: () => void;
  onCancel?: () => void;
}

export function ConfirmModal({ state, onClose }: { state: ConfirmState | null; onClose: () => void }) {
  useEffect(() => {
    if (!state?.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (state.onCancel) state.onCancel();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, onClose]);

  if (!state || !state.isOpen) return null;

  const isDanger = state.variant === 'danger' || !state.variant;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-md animate-fade">
      <div className="relative w-full max-w-sm bg-ink-900 border border-line rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            isDanger ? 'tone-rose' : 'tone-ember'
          }`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isDanger ? (
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
              ) : (
                <circle cx="12" cy="12" r="10" />
              )}
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-ink-100">{state.title}</h3>
          </div>
        </div>

        <p className="text-xs text-ink-300 leading-relaxed">{state.message}</p>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line">
          <button
            type="button"
            onClick={() => {
              if (state.onCancel) state.onCancel();
              onClose();
            }}
            className="btn btn-ghost text-xs py-2 px-4"
          >
            {state.cancelText || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
            className={`btn text-xs py-2 px-4 ${
              isDanger
                ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-rose-950/50'
                : 'btn-primary'
            }`}
          >
            {state.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Alert Modal ─────────────────────────────────────────────────────────────

export interface AlertState {
  isOpen: boolean;
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'info';
}

export function AlertModal({ state, onClose }: { state: AlertState | null; onClose: () => void }) {
  useEffect(() => {
    if (!state?.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, onClose]);

  if (!state || !state.isOpen) return null;

  const isError = state.type === 'error';
  const isSuccess = state.type === 'success';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-md animate-fade">
      <div className="relative w-full max-w-sm bg-ink-900 border border-line rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            isError
              ? 'tone-rose'
              : isSuccess
              ? 'tone-emerald'
              : 'tone-sky'
          }`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isError ? (
                <circle cx="12" cy="12" r="10" />
              ) : isSuccess ? (
                <polyline points="20 6 9 17 4 12" />
              ) : (
                <circle cx="12" cy="12" r="10" />
              )}
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-ink-100">
              {state.title || (isError ? 'Notice' : isSuccess ? 'Success' : 'Information')}
            </h3>
          </div>
        </div>

        <p className="text-xs text-ink-300 leading-relaxed">{state.message}</p>

        <div className="flex justify-end pt-3 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary text-xs py-2 px-5"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
