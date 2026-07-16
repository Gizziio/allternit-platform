'use client';

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { MatrixLogo } from '@/components/ai-elements/MatrixLogo';

/**
 * Compatibility landing page for old Desktop “Web Access” links.
 * Runtime traffic now uses the account-bound outbound relay; tunnel URLs and
 * bearer tokens are intentionally ignored and never written to localStorage.
 */
export default function ConnectPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => navigate('/shell', { replace: true }), 900);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-[#faf9f7] text-[#1a1916]">
      <section className="w-full max-w-[420px] rounded-2xl border border-[#e1e5eb] bg-[#fffefc] p-9 text-center shadow-[0_24px_70px_rgba(28,27,26,0.09)]">
        <div className="flex justify-center mb-6"><MatrixLogo state="idle" size={42} /></div>
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-full bg-[#e8f7ee] text-[#1f7a3a]">
          <ShieldCheck size={26} />
        </div>
        <h1 className="m-0 mb-2 font-serif text-2xl font-bold">Secure runtime access is ready</h1>
        <p className="m-0 text-sm leading-relaxed text-[#74716b]">
          Allternit now connects through your account-bound desktop or VPS runtime. No public localhost tunnel or URL token is needed.
        </p>
        <p className="mt-5 text-xs text-[#989590]">Opening your workspace…</p>
      </section>
    </main>
  );
}
