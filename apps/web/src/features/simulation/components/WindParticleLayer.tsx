import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useWeatherData } from "@/shared/hooks/useWeatherData";
import { useAQIData } from "@/shared/hooks/useAQIData";

interface WindParticleLayerProps {
  map: MapboxMap;
}

function aqiToRGB(aqi: number): [number, number, number] {
  if (aqi <= 50) return [34, 197, 94];
  if (aqi <= 100) return [234, 179, 8];
  if (aqi <= 150) return [249, 115, 22];
  if (aqi <= 200) return [239, 68, 68];
  return [139, 92, 246];
}

// Draws an arrow: shaft + filled triangular head, angled by wind direction.
function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angleDeg: number, // 0 = North, clockwise
  length: number,
  headSize: number,
  r: number,
  g: number,
  b: number,
  alpha: number,
) {
  // Canvas: 0deg = East, clockwise. Wind: 0deg = North, clockwise. canvas = wind - 90.
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;

  const dx = Math.cos(angleRad);
  const dy = Math.sin(angleRad);

  const tailX = x - dx * length * 0.5;
  const tailY = y - dy * length * 0.5;
  const tipX = x + dx * length * 0.5;
  const tipY = y + dy * length * 0.5;

  const color = `rgba(${r},${g},${b},${alpha})`;

  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(tipX - dx * headSize, tipY - dy * headSize);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.stroke();

  const perpX = -dy;
  const perpY = dx;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - dx * headSize + perpX * headSize * 0.45, tipY - dy * headSize + perpY * headSize * 0.45);
  ctx.lineTo(tipX - dx * headSize - perpX * headSize * 0.45, tipY - dy * headSize - perpY * headSize * 0.45);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Decorative wind-direction field over the AQI map. Ported verbatim from Hackathon-FE. */
export function WindParticleLayer({ map }: WindParticleLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const { data: weather } = useWeatherData();
  const { data: aqi } = useAQIData();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !map) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const windSpeed = weather?.current?.windSpeed ?? 12; // km/h
    const windDirDeg = weather?.current?.windDirection ?? 220;
    const aqiVal = aqi?.aqi ?? 80;
    const [r, g, b] = aqiToRGB(aqiVal);

    const speedPx = Math.max(0.6, windSpeed / 20);

    const moveRad = ((windDirDeg - 90) * Math.PI) / 180;
    const vx = Math.cos(moveRad) * speedPx;
    const vy = Math.sin(moveRad) * speedPx;

    const arrowLen = 18 + windSpeed * 0.35;
    const headSize = 6 + windSpeed * 0.1;

    const COLS = 9;
    const ROWS = 6;
    const PARTICLE_COUNT = COLS * ROWS;

    type Particle = {
      x: number;
      y: number;
      life: number;
      maxLife: number;
      col: number;
      row: number;
    };

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      return {
        col,
        row,
        x: 0,
        y: 0,
        life: Math.floor(Math.random() * 120),
        maxLife: 90 + Math.random() * 60,
      };
    });

    const respawn = (p: Particle) => {
      const W = canvas.width || 800;
      const H = canvas.height || 600;
      const cellW = W / COLS;
      const cellH = H / ROWS;
      const jx = (Math.random() - 0.5) * cellW * 0.6;
      const jy = (Math.random() - 0.5) * cellH * 0.6;

      const spawnFromEdge = Math.random() < 0.3;
      if (spawnFromEdge) {
        p.x = vx >= 0 ? jx : W + jx;
        p.y = vy >= 0 ? jy : H + jy;
      } else {
        p.x = (p.col + 0.5) * cellW + jx;
        p.y = (p.row + 0.5) * cellH + jy;
      }

      p.life = 0;
      p.maxLife = 90 + Math.random() * 60;
    };

    particles.forEach((p) => respawn(p));

    const draw = () => {
      const W = canvas.width || 800;
      const H = canvas.height || 600;
      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        const progress = p.life / p.maxLife;
        const alpha =
          progress < 0.15
            ? (progress / 0.15) * 0.75
            : progress > 0.75
              ? ((1 - progress) / 0.25) * 0.75
              : 0.75;

        drawArrow(ctx, p.x, p.y, windDirDeg, arrowLen, headSize, r, g, b, alpha);

        p.x += vx;
        p.y += vy;
        p.life++;

        if (p.life > p.maxLife || p.x < -arrowLen || p.x > W + arrowLen || p.y < -arrowLen || p.y > H + arrowLen) {
          respawn(p);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [map, weather, aqi]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />;
}
