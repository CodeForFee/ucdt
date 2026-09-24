import { useEffect, useRef } from "react";

interface RainOverlayProps {
  /** 0-3, 1 = normal rainfall. */
  intensity: number;
}

type Drop = { x: number; y: number; len: number; speed: number; opacity: number };

function spawn(width: number, height: number, intensity: number, y = Math.random() * height): Drop {
  return {
    x: Math.random() * width,
    y,
    len: 10 + Math.random() * 20 * intensity,
    speed: 8 + Math.random() * 10 * intensity,
    opacity: 0.2 + Math.random() * 0.4,
  };
}

/**
 * Pure canvas decoration, no data dependency (ported from Hackathon-FE).
 *
 * The canvas, its ResizeObserver and the animation loop are created ONCE; `intensity`
 * only moves a ref that the loop reads each frame, growing or trimming the drop set in
 * place. The legacy version re-ran its whole effect on every intensity change — a new
 * canvas setup and a fresh random drop field per slider tick — so dragging the rainfall
 * slider made the overlay visibly restart instead of thickening.
 */
export function RainOverlay({ intensity }: RainOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intensityRef = useRef(intensity);

  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

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

    const drops: Drop[] = [];
    let raf = 0;

    const draw = () => {
      const level = Math.min(intensityRef.current, 3);
      const target = Math.floor(120 * level);
      while (drops.length < target) drops.push(spawn(canvas.width, canvas.height, level));
      if (drops.length > target) drops.length = target;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#93c5fd";
      ctx.lineWidth = 1;

      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        ctx.globalAlpha = d.opacity;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.len * 0.15, d.y + d.len);
        ctx.stroke();

        d.y += d.speed;
        d.x += d.speed * 0.15;
        // Respawn at the top with the CURRENT intensity, so length/speed follow the slider.
        if (d.y > canvas.height) drops[i] = spawn(canvas.width, canvas.height, level, -d.len);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // Always rendered: the one-time effect needs the canvas at mount. At intensity 0 the
  // loop simply draws zero drops.
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />;
}
