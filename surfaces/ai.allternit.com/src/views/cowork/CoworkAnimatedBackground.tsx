'use client';
import { useEffect, useRef } from 'react';

/**
 * Cowork background — traveling dot-wave matrix.
 * Canvas renders a regular grid of small dots; two overlapping sine waves
 * give each dot a slowly shifting brightness creating a breathing field
 * that is alive but never distracting. Same base color in dark and light mode,
 * only the dot opacity and background tint change.
 */
export function CoworkAnimatedBackground(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SPACING = 22;
    const DOT_R   = 1.5;
    const SPEED   = 0.00035;
    const FREQ_X  = 0.018;
    const FREQ_Y  = 0.012;
    const FREQ_X2 = 0.009;
    const FREQ_Y2 = 0.022;

    let animId = 0;
    const startTime = performance.now();

    const isDark = () =>
      document.documentElement.getAttribute('data-theme') === 'dark';

    function resize() {
      canvas!.width  = canvas!.offsetWidth  || window.innerWidth;
      canvas!.height = canvas!.offsetHeight || window.innerHeight;
    }

    function draw(now: number) {
      if (!ctx || !canvas) return;
      const dark = isDark();
      const t = (now - startTime) * SPEED;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = dark ? '#100e0b' : '#faf9f7';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cols = Math.ceil(canvas.width  / SPACING) + 1;
      const rows = Math.ceil(canvas.height / SPACING) + 1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * SPACING;
          const y = r * SPACING;
          const wave1 = Math.sin(t + x * FREQ_X + y * FREQ_Y);
          const wave2 = Math.sin(t * 1.31 + x * FREQ_X2 - y * FREQ_Y2 + 1.4);
          const intensity = ((wave1 + wave2) / 2 + 1) / 2; // [0,1]
          const minOp = 0.04;
          const maxOp = dark ? 0.30 : 0.18;
          const alpha = minOp + intensity * (maxOp - minOp);

          ctx.beginPath();
          ctx.arc(x, y, DOT_R, 0, Math.PI * 2);
          ctx.fillStyle = dark
            ? `rgba(210,185,148,${alpha.toFixed(3)})`
            : `rgba(160,145,120,${alpha.toFixed(3)})`;
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
