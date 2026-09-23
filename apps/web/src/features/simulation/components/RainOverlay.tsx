import { useEffect, useRef } from "react";

interface RainOverlayProps {
  /** 0-3, 1 = normal rainfall. */
  intensity: number;
}

/** Ported verbatim from Hackathon-FE — pure canvas decoration, no data dependency. */
export function RainOverlay({ intensity }: RainOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const dropCount = Math.floor(120 * Math.min(intensity, 3));
    const drops: { x: number; y: number; len: number; speed: number; opacity: number }[] = [];

    for (let i = 0; i < dropCount; i++) {
      drops.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        len: 10 + Math.random() * 20 * intensity,
        speed: 8 + Math.random() * 10 * intensity,
        opacity: 0.2 + Math.random() * 0.4,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#93c5fd";
      ctx.lineWidth = 1;

      for (const d of drops) {
        ctx.globalAlpha = d.opacity;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.len * 0.15, d.y + d.len);
        ctx.stroke();

        d.y += d.speed;
        d.x += d.speed * 0.15;
        if (d.y > canvas.height) {
          d.y = -d.len;
          d.x = Math.random() * canvas.width;
        }
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [intensity]);

  if (intensity <= 0) return null;

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />;
}
