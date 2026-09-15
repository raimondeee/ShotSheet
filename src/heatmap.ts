import type { ShotEvent } from './types';

/**
 * Simple Gaussian density heatmap drawn to canvas.
 * Callers must pass shots already mapped into the same view space as markers
 * (wrap-normalized coords from `rinkToView`).
 */
export function drawHeatmap(
  canvas: HTMLCanvasElement,
  shots: ShotEvent[],
  opts?: { radius?: number; maxAlpha?: number },
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const placed = shots.filter(
    (s) => typeof s.x === 'number' && typeof s.y === 'number' && s.x >= 0 && s.y >= 0,
  );
  if (placed.length === 0) return;

  const radius = opts?.radius ?? Math.max(24, Math.min(w, h) * 0.06);
  const maxAlpha = opts?.maxAlpha ?? 0.72;

  // Accumulate intensity offscreen
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const octx = off.getContext('2d');
  if (!octx) return;

  for (const s of placed) {
    const px = (s.x as number) * w;
    const py = (s.y as number) * h;
    const g = octx.createRadialGradient(px, py, 0, px, py, radius);
    g.addColorStop(0, 'rgba(0,0,0,0.35)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    octx.fillStyle = g;
    octx.beginPath();
    octx.arc(px, py, radius, 0, Math.PI * 2);
    octx.fill();
  }

  const img = octx.getImageData(0, 0, w, h);
  const data = img.data;
  let maxV = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > maxV) maxV = data[i];
  }
  if (maxV === 0) return;

  const colored = ctx.createImageData(w, h);
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i + 3] / maxV;
    if (v <= 0.02) continue;
    const { r, g, b } = heatColor(v);
    colored.data[i] = r;
    colored.data[i + 1] = g;
    colored.data[i + 2] = b;
    colored.data[i + 3] = Math.floor(maxAlpha * Math.min(1, v * 1.15) * 255);
  }
  ctx.putImageData(colored, 0, 0);
}

/** Blue → cyan → green → yellow → red */
function heatColor(t: number): { r: number; g: number; b: number } {
  const x = Math.max(0, Math.min(1, t));
  if (x < 0.25) {
    const u = x / 0.25;
    return { r: 0, g: Math.floor(80 + 100 * u), b: Math.floor(180 + 50 * u) };
  }
  if (x < 0.5) {
    const u = (x - 0.25) / 0.25;
    return { r: Math.floor(40 * u), g: Math.floor(180 + 50 * u), b: Math.floor(230 - 180 * u) };
  }
  if (x < 0.75) {
    const u = (x - 0.5) / 0.25;
    return { r: Math.floor(40 + 215 * u), g: Math.floor(230 - 30 * u), b: Math.floor(50 * (1 - u)) };
  }
  const u = (x - 0.75) / 0.25;
  return { r: 255, g: Math.floor(200 * (1 - u)), b: 0 };
}
