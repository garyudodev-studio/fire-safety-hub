'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/app/lib/supabaseClient';

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4 6v6c0 4.4 3.2 7.7 8 9 4.8-1.3 8-4.6 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = getSupabaseClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();
      
      setLoading(false);
      
      if (profile?.role === 'inspector') {
        router.push('/dashboard/inspections');
      } else {
        router.push('/dashboard');
      }
    } else {
      setLoading(false);
    }
  };

  const handleGuestEntry = () => {
    router.push('/guest');
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="relative flex-1 flex items-center justify-center p-8 lg:p-16 overflow-hidden">
        <div
          className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(230,70,60,0.18), transparent 70%)' }}
        />
        <div className="relative max-w-md animate-rise">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-ember-600/15 text-ember-400 border border-ember-900/50 mb-8">
            <ShieldIcon />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500 mb-4">
            System Hub
          </p>
          <h1 className="text-4xl lg:text-5xl font-semibold leading-[1.1] text-ink-100 tracking-tight">
            Fire Safety
            <br />
            Control Room
          </h1>
          <p className="mt-5 text-ink-400 leading-relaxed max-w-sm">
            A single source of truth for your fire safety equipment — masterlists,
            inspections, and personnel, all in one place.
          </p>
          <div className="mt-8 flex items-center gap-6 text-xs text-ink-500">
            <span className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-ember-500" /> Masterlist</span>
            <span className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-ember-500" /> Inspections</span>
            <span className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-ember-500" /> Personnel</span>
          </div>
        </div>
      </div>

      {/* Auth panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-16 border-t lg:border-t-0 lg:border-l border-line bg-ink-900/40">
        <div className="w-full max-w-sm animate-rise">
          <div className="panel p-8">
            <h2 className="text-xl font-semibold text-ink-100">Welcome back Garyudo.</h2>
            <p className="text-sm text-ink-400 mt-1 mb-7">
              Sign in to manage equipment and inspections.
            </p>

            {error && (
              <div className="mb-5 rounded-xl border border-ember-900/60 bg-ember-950/50 px-4 py-3 text-sm text-ember-300">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="field-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div>
                <label className="field-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-ink-500">
              <span className="h-px flex-1 bg-line" />
              Or
              <span className="h-px flex-1 bg-line" />
            </div>

            <button
              onClick={handleGuestEntry}
              className="btn btn-ghost w-full"
            >
              Continue as guest
              <ArrowRight />
            </button>
          </div>

          <p className="text-center text-xs text-ink-500 mt-6">
            Protected area. Authorized personnel only.
          </p>
        </div>
      </div>
    </div>
  );
}
