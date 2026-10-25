/** Image-derived prototype for upright, orthogonal, double-line/hatch floor plans.
 * All coordinates are image pixels; no example-specific wall coordinates are used.
 * This is geometric image processing, not a trained semantic recognition model.
 */
export function detectPlan({ data, width, height }, options = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 16 || height < 16 || data.length !== width * height * 4) throw new Error('La imagen no es válida.');
  const threshold = options.threshold ?? 145;
  const minLength = options.minLength ?? Math.max(18, Math.round(width * .025));
  const maxThickness = Math.max(7, Math.round(width * .014));
  const minThickness = Math.max(3, Math.round(width * .005));
  const mask = new Uint8Array(width * height), darkness = new Float32Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    const p = i * 4;
    const alpha = data[p + 3] / 255;
    const gray = (.299 * data[p] + .587 * data[p + 1] + .114 * data[p + 2]) * alpha + 255 * (1 - alpha);
    mask[i] = gray < threshold ? 1 : 0;
    darkness[i] = (255 - gray) / 255;
  }
  const walls = [];
  for (const axis of ['h', 'v']) {
    const along = axis === 'h' ? width : height;
    const across = axis === 'h' ? height : width;
    const at = (u, c) => axis === 'h' ? mask[c * width + u] : mask[u * width + c];
    const fillAt = (u, c) => axis === 'h' ? darkness[c * width + u] : darkness[u * width + c];
    const lines = [];
    for (let c = 1; c < across - 1; c++) {
      let start = -1, last = -1, count = 0;
      const flush = () => { if (start >= 0 && last - start + 1 >= minLength && count / (last - start + 1) > .78) lines.push({ c, from: start, to: last }); start = -1; count = 0; };
      for (let u = 1; u < along - 1; u++) {
        if (at(u, c)) { if (start < 0) start = u; last = u; count++; }
        else if (start >= 0 && u - last > 2) flush();
      }
      flush();
    }
    const candidates = [];
    for (let i = 0; i < lines.length; i++) {
      const a = lines[i];
      for (let j = i + 1; j < lines.length; j++) {
        const b = lines[j], thickness = b.c - a.c;
        if (thickness > maxThickness) break;
        if (thickness < minThickness) continue;
        const from = Math.max(a.from, b.from), to = Math.min(a.to, b.to);
        if (to - from < minLength) continue;
        let inside = 0, darkInside = 0;
        for (let u = from; u <= to; u++) for (let c = a.c + 1; c < b.c; c++) { inside += fillAt(u, c); darkInside += at(u, c); }
        const density = inside / ((to - from + 1) * (thickness - 1));
        if (density < (options.minDensity ?? .14)) continue;
        if (options.contrastFallback === false && darkInside / ((to - from + 1) * (thickness - 1)) < .29) continue;
        const scoreSupport = options.contrastFallback === false ? darkInside / ((to - from + 1) * (thickness - 1)) * 1.8 : density * 3;
        candidates.push({ axis, c: (a.c + b.c) / 2, from, to, thickness, density, score: (to - from) * thickness * Math.min(1, scoreSupport) });
      }
    }
    // Keep the widest supported band rather than lifting each hatch/edge twice.
    candidates.sort((a, b) => b.score - a.score);
    const accepted = [];
    for (const candidate of candidates) {
      let fragments = [[candidate.from, candidate.to]];
      for (const other of accepted) {
        if (Math.abs(other.c - candidate.c) > (other.thickness + candidate.thickness) / 2 + 1) continue;
        const next = [];
        for (const [a, b] of fragments) {
          if (other.to < a || other.from > b) next.push([a, b]);
          else { if (other.from - a >= minLength) next.push([a, other.from]); if (b - other.to >= minLength) next.push([other.to, b]); }
        }
        fragments = next;
      }
      for (const [from, to] of fragments) accepted.push({ ...candidate, from, to });
    }
    // Merge near-collinear fragments, retaining meaningful gaps as opening candidates.
    accepted.sort((a, b) => a.c - b.c || a.from - b.from);
    for (const item of accepted) {
      const previous = walls.find(w => w.axis === axis && Math.abs(w.c - item.c) <= 2 && item.from <= w.to + 6 && item.to >= w.from - 6);
      if (previous) { previous.from = Math.min(previous.from, item.from); previous.to = Math.max(previous.to, item.to); }
      else walls.push({ ...item });
    }
  }
  // A second, softer contrast pass recovers faint bands only where the first pass
  // found no overlapping band. It must not bridge openings in stronger bands.
  if (options.contrastFallback !== false) {
    const fallback = detectPlan({ data, width, height }, { ...options, threshold: Math.min(230, threshold + 50), minLength: Math.max(minLength, Math.round(width * .037)), contrastFallback: false });
    const strongWalls = [...walls];
    for (const candidate of fallback.walls) {
      const overlap = strongWalls.some(w => w.axis === candidate.axis && Math.abs(w.c - candidate.c) <= Math.max(2, Math.min(w.thickness, candidate.thickness) / 2) && w.from < candidate.to && w.to > candidate.from);
      if (!overlap) walls.push({ ...candidate, density: candidate.support });
    }
  }
  // Reject short isolated double lines (frequently tables or sofas). This is a
  // topology heuristic, not semantic furniture recognition.
  const connected = walls.filter(w => {
    if (w.to - w.from >= width * .10) return true;
    return walls.some(other => {
      if (w === other) return false;
      if (w.axis === other.axis) {
        const gap = Math.max(other.from - w.to, w.from - other.to, 0);
        return Math.abs(w.c - other.c) <= 2 && gap < width * .09;
      }
      const tolerance = (w.thickness + other.thickness) / 2 + 4;
      return other.c >= w.from - tolerance && other.c <= w.to + tolerance && w.c >= other.from - tolerance && w.c <= other.to + tolerance;
    });
  });
  walls.splice(0, walls.length, ...connected);
  const openings = [];
  for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++) {
    const a = walls[i], b = walls[j];
    if (a.axis !== b.axis || Math.abs(a.c - b.c) > 4) continue;
    const left = a.from < b.from ? a : b, right = left === a ? b : a;
    const gap = right.from - left.to;
    if (gap < Math.max(10, width * .014) || gap > width * .075) continue;
    const c = (a.c + b.c) / 2;
    if (openings.some(o => o.axis === a.axis && Math.abs(o.c - c) < 5 && Math.abs(o.from - left.to) < 5)) continue;
    openings.push({ id: `o${openings.length + 1}`, axis: a.axis, c, from: left.to, to: right.from, type: 'unclassified', reviewRequired: true });
  }
  return {
    width, height,
    walls: walls.map((w, i) => ({ id: `w${i + 1}`, axis: w.axis, c: w.c, from: w.from, to: w.to, thickness: w.thickness, support: Number(w.density.toFixed(3)) })),
    openings,
    method: 'orthogonal-parallel-lines-v1',
    parameters: { threshold, fallbackThreshold: options.contrastFallback === false ? null : Math.min(230, threshold + 50), minLength, minThickness, maxThickness, minDensity: options.minDensity ?? .14 },
    warnings: ['Detección geométrica experimental; puede confundir mobiliario con muros.', 'Los huecos son candidatos sin clasificación de puerta o ventana.', 'Altura y escala son parámetros de reconstrucción, no medidas inferidas.']
  };
}
