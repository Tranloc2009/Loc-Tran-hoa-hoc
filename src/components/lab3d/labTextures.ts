import * as THREE from 'three';

function createCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not acquire 2D canvas context for procedural texture');
  }
  return [canvas, ctx];
}

function hash2d(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise2d(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2d(xi, yi);
  const b = hash2d(xi + 1, yi);
  const c = hash2d(xi, yi + 1);
  const d = hash2d(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm2d(x: number, y: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise2d(x * freq, y * freq) * amp;
    freq *= 2.02;
    amp *= 0.5;
  }
  return sum;
}

export interface PbrTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

/**
 * High-resolution 1024x1024 American Walnut PBR texture suite (albedo + bump + satin lacquer roughness).
 * Features warm dark-amber cathedral grain, plank joints, and fine open wood pores.
 */
export function createWalnutWoodTextures(maxAnisotropy: number): PbrTextureSet {
  const size = 1024;
  const [canvas, ctx] = createCanvas(size, size);
  const [bCanvas, bCtx] = createCanvas(512, 512);
  const [rCanvas, rCtx] = createCanvas(512, 512);

  // 4 horizontal walnut butcher-block planks with slightly varied warmth
  const plankCount = 4;
  const plankH = size / plankCount;
  const plankTones = [
    { r: 108, g: 64, b: 36 },
    { r: 94, g: 55, b: 31 },
    { r: 115, g: 69, b: 38 },
    { r: 88, g: 52, b: 29 },
  ];

  for (let p = 0; p < plankCount; p += 1) {
    const y0 = p * plankH;
    const tone = plankTones[p];
    const grad = ctx.createLinearGradient(0, y0, size, y0 + plankH);
    grad.addColorStop(0, `rgb(${tone.r},${tone.g},${tone.b})`);
    grad.addColorStop(0.5, `rgb(${tone.r + 12},${tone.g + 8},${tone.b + 4})`);
    grad.addColorStop(1, `rgb(${tone.r - 8},${tone.g - 5},${tone.b - 3})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, size, plankH);

    // Rich flowing walnut grain fibers + cathedral knots
    const knotX = (0.22 + hash2d(p, 9.1) * 0.58) * size;
    const knotY = y0 + (0.28 + hash2d(p, 4.7) * 0.44) * plankH;
    for (let i = 0; i < 86; i += 1) {
      const fy = y0 + (i / 86) * plankH;
      const isDark = i % 3 === 0;
      const alpha = isDark ? 0.24 + (i % 5) * 0.035 : 0.14;
      ctx.strokeStyle = isDark
        ? `rgba(28, 14, 6, ${alpha})`
        : `rgba(176, 114, 64, ${alpha})`;
      ctx.lineWidth = isDark ? 1.8 + (i % 3) * 0.7 : 1.2;
      ctx.beginPath();
      for (let x = 0; x <= size; x += 24) {
        const dx = (x - knotX) / 210;
        const dy = (fy - knotY) / 72;
        const distSq = dx * dx + dy * dy;
        const knotWarp = Math.exp(-distSq * 1.4) * (fy - knotY) * 0.55;
        const n = Math.sin(x * 0.011 + p * 2.1 + i * 0.18) * 6 + Math.cos(x * 0.027 + i) * 2.5;
        const py = Math.max(y0 + 1, Math.min(y0 + plankH - 1, fy + n + knotWarp));
        if (x === 0) ctx.moveTo(x, py);
        else ctx.lineTo(x, py);
      }
      ctx.stroke();
    }

    // Subtle dark heartwood bands
    for (let k = 0; k < 4; k += 1) {
      const cy = y0 + hash2d(p * 11, k * 7) * plankH;
      const bandGrad = ctx.createLinearGradient(0, cy - 26, 0, cy + 26);
      bandGrad.addColorStop(0, 'rgba(34, 17, 8, 0)');
      bandGrad.addColorStop(0.5, 'rgba(34, 17, 8, 0.22)');
      bandGrad.addColorStop(1, 'rgba(34, 17, 8, 0)');
      ctx.fillStyle = bandGrad;
      ctx.fillRect(0, Math.max(y0, cy - 26), size, 52);
    }

    // Fine longitudinal pores
    for (let s = 0; s < 260; s += 1) {
      const px = hash2d(p * 31 + s, 1.3) * size;
      const py = y0 + hash2d(p * 17 + s, 8.9) * plankH;
      const len = 8 + hash2d(s, p) * 24;
      ctx.fillStyle = 'rgba(22, 10, 4, 0.28)';
      ctx.fillRect(px, py, len, 1.4);
    }
  }

  // Plank bevel join seams
  for (let p = 1; p < plankCount; p += 1) {
    const sy = p * plankH;
    ctx.fillStyle = 'rgba(18, 9, 4, 0.55)';
    ctx.fillRect(0, sy - 1.5, size, 3);
    ctx.fillStyle = 'rgba(190, 128, 76, 0.16)';
    ctx.fillRect(0, sy + 1.5, size, 1.5);
  }

  // Matching 512x512 Bump + Roughness maps (satin hand-rubbed lacquer: roughness ~ 0.28 - 0.52)
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);
  rCtx.fillStyle = '#5c5c5c'; // ~0.36 satin wood lacquer base
  rCtx.fillRect(0, 0, 512, 512);

  for (let y = 0; y < 512; y += 2) {
    const plankIdx = Math.floor(y / 128);
    const wave = Math.sin(y * 0.18 + plankIdx * 1.4) * 16 + Math.cos(y * 0.49) * 10;
    const bv = Math.max(85, Math.min(175, Math.round(128 + wave)));
    bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bCtx.fillRect(0, y, 512, 2);

    const rv = Math.max(66, Math.min(148, Math.round(92 - wave * 0.9 + (plankIdx % 2) * 8)));
    rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
    rCtx.fillRect(0, y, 512, 2);
  }
  for (let s = 0; s < 520; s += 1) {
    const px = hash2d(s, 4.1) * 512;
    const py = hash2d(s, 7.3) * 512;
    const len = 6 + hash2d(s, 2.2) * 16;
    bCtx.fillStyle = 'rgba(40,40,40,0.45)';
    bCtx.fillRect(px, py, len, 1.5);
    rCtx.fillStyle = 'rgba(195,195,195,0.42)';
    rCtx.fillRect(px, py, len, 1.5);
  }
  for (const sy of [128, 256, 384]) {
    bCtx.fillStyle = '#383838';
    bCtx.fillRect(0, sy - 1, 512, 2);
    rCtx.fillStyle = '#c8c8c8';
    rCtx.fillRect(0, sy - 1, 512, 2);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAnisotropy;

  return { map, bumpMap, roughnessMap };
}

/**
 * 1024x1024 Polished Architectural Concrete Floor PBR suite (albedo + bump + gloss variation roughness).
 * Matches modern sunlit laboratory concrete slabs with subtle mineral mottling & expansion seams.
 */
export function createPolishedConcreteFloorTextures(maxAnisotropy: number): PbrTextureSet {
  const size = 1024;
  const [canvas, ctx] = createCanvas(size, size);
  const [bCanvas, bCtx] = createCanvas(512, 512);
  const [rCanvas, rCtx] = createCanvas(512, 512);

  // Base warm-cool architectural polished concrete tone
  ctx.fillStyle = '#4B5257';
  ctx.fillRect(0, 0, size, size);

  // 2x2 large-format concrete slabs with distinct mineral sheen
  const slabTones = [
    [76, 83, 88],
    [71, 78, 83],
    [73, 79, 85],
    [79, 86, 91],
  ];
  const half = size / 2;
  for (let sy = 0; sy < 2; sy += 1) {
    for (let sx = 0; sx < 2; sx += 1) {
      const [br, bg, bb] = slabTones[sy * 2 + sx];
      const ox = sx * half;
      const oy = sy * half;
      ctx.fillStyle = `rgb(${br},${bg},${bb})`;
      ctx.fillRect(ox + 2, oy + 2, half - 4, half - 4);
    }
  }

  // Organic trowel clouds & mineral aggregate mottling via FBM
  const step = 16;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const n = fbm2d(x * 0.0085, y * 0.0085, 4);
      const delta = (n - 0.5) * 34;
      const warmTint = (fbm2d(x * 0.004 + 12, y * 0.004 + 5, 3) - 0.5) * 14;
      const r = Math.max(46, Math.min(126, Math.round(78 + delta + warmTint)));
      const g = Math.max(50, Math.min(130, Math.round(83 + delta + warmTint * 0.6)));
      const b = Math.max(54, Math.min(134, Math.round(87 + delta)));
      ctx.fillStyle = `rgba(${r},${g},${b},0.65)`;
      ctx.fillRect(x, y, step + 1, step + 1);
    }
  }

  // Subtle dark & light terrazzo / silica flecks
  for (let i = 0; i < 1600; i += 1) {
    const fx = hash2d(i, 1.7) * size;
    const fy = hash2d(i, 6.3) * size;
    const w = 1.5 + hash2d(i, 3.9) * 3.5;
    const light = i % 3 === 0;
    ctx.fillStyle = light ? 'rgba(218, 224, 226, 0.14)' : 'rgba(22, 26, 29, 0.19)';
    ctx.fillRect(fx, fy, w, w * 0.8);
  }

  // Hairline architectural expansion joints
  ctx.strokeStyle = 'rgba(26, 31, 35, 0.72)';
  ctx.lineWidth = 4;
  ctx.strokeRect(1, 1, size - 2, size - 2);
  ctx.beginPath();
  ctx.moveTo(half, 0);
  ctx.lineTo(half, size);
  ctx.moveTo(0, half);
  ctx.lineTo(size, half);
  ctx.stroke();

  // Soft chamfer highlight beside expansion joint
  ctx.strokeStyle = 'rgba(182, 194, 198, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(half + 3, 0);
  ctx.lineTo(half + 3, size);
  ctx.moveTo(0, half + 3);
  ctx.lineTo(size, half + 3);
  ctx.stroke();

  // Bump & Roughness maps (polished sealed concrete: glossy patches ~0.28, worn zones ~0.58)
  for (let y = 0; y < 512; y += 8) {
    for (let x = 0; x < 512; x += 8) {
      const n = fbm2d(x * 0.017, y * 0.017, 4);
      const bv = Math.max(96, Math.min(164, Math.round(128 + (n - 0.5) * 60)));
      bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bCtx.fillRect(x, y, 9, 9);

      const rv = Math.max(62, Math.min(168, Math.round(112 + (0.5 - n) * 95)));
      rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rCtx.fillRect(x, y, 9, 9);
    }
  }
  bCtx.strokeStyle = '#323232';
  bCtx.lineWidth = 3;
  bCtx.strokeRect(0, 0, 512, 512);
  bCtx.beginPath();
  bCtx.moveTo(256, 0);
  bCtx.lineTo(256, 512);
  bCtx.moveTo(0, 256);
  bCtx.lineTo(512, 256);
  bCtx.stroke();

  rCtx.strokeStyle = '#d8d8d8';
  rCtx.lineWidth = 3;
  rCtx.strokeRect(0, 0, 512, 512);
  rCtx.beginPath();
  rCtx.moveTo(256, 0);
  rCtx.lineTo(256, 512);
  rCtx.moveTo(0, 256);
  rCtx.lineTo(512, 256);
  rCtx.stroke();

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(5, 4.5);
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(5, 4.5);
  bumpMap.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(5, 4.5);
  roughnessMap.anisotropy = maxAnisotropy;

  return { map, bumpMap, roughnessMap };
}

export function createSlateFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const { map, bumpMap, roughnessMap } = createPolishedConcreteFloorTextures(maxAnisotropy);
  bumpMap.dispose();
  roughnessMap.dispose();
  return map;
}

/**
 * 1024x1024 Architectural Micro-Cement Slate-Teal Wall PBR suite.
 * Eliminates flat plastic solid walls with organic trowel clouds & micro plaster grain.
 */
export function createMicroCementWallTextures(maxAnisotropy: number): PbrTextureSet {
  const size = 512;
  const [canvas, ctx] = createCanvas(size, size);
  const [bCanvas, bCtx] = createCanvas(size, size);
  const [rCanvas, rCtx] = createCanvas(size, size);

  ctx.fillStyle = '#33464E';
  ctx.fillRect(0, 0, size, size);

  const step = 8;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const n = fbm2d(x * 0.014, y * 0.014, 4);
      const streak = fbm2d(x * 0.006 + 7, y * 0.025 + 3, 3);
      const v = (n - 0.5) * 28 + (streak - 0.5) * 14;
      const r = Math.max(32, Math.min(82, Math.round(52 + v * 0.85)));
      const g = Math.max(46, Math.min(102, Math.round(71 + v * 0.95)));
      const b = Math.max(54, Math.min(112, Math.round(79 + v)));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, step + 1, step + 1);

      const bv = Math.max(96, Math.min(164, Math.round(128 + v * 1.4)));
      bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bCtx.fillRect(x, y, step + 1, step + 1);

      const rv = Math.max(150, Math.min(225, Math.round(192 - v * 1.2)));
      rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rCtx.fillRect(x, y, step + 1, step + 1);
    }
  }

  // Subtle architectural panel shadow lines
  ctx.strokeStyle = 'rgba(18, 27, 32, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(256, 0);
  ctx.lineTo(256, 512);
  ctx.stroke();

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4, 2.5);
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(4, 2.5);
  bumpMap.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(4, 2.5);
  roughnessMap.anisotropy = maxAnisotropy;

  return { map, bumpMap, roughnessMap };
}

/**
 * 512x512 Directional Brushed Metal bump & roughness maps for Copper, Zinc, Brass & Aluminum.
 */
export function createBrushedMetalTextures(maxAnisotropy: number): {
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const [bCanvas, bCtx] = createCanvas(256, 256);
  const [rCanvas, rCtx] = createCanvas(256, 256);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  rCtx.fillStyle = '#525252';
  rCtx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 1) {
    const baseN = hash2d(y, 13.7);
    const bv = Math.round(108 + baseN * 42);
    const rv = Math.round(56 + baseN * 54);
    bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bCtx.fillRect(0, y, 256, 1);
    rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
    rCtx.fillRect(0, y, 256, 1);
  }

  for (let i = 0; i < 240; i += 1) {
    const x = hash2d(i, 2.1) * 256;
    const y = hash2d(i, 9.4) * 256;
    const len = 18 + hash2d(i, 5.5) * 70;
    bCtx.fillStyle = i % 2 === 0 ? 'rgba(220,220,220,0.22)' : 'rgba(40,40,40,0.22)';
    bCtx.fillRect(x, y, len, 1);
    rCtx.fillStyle = i % 2 === 0 ? 'rgba(130,130,130,0.28)' : 'rgba(35,35,35,0.28)';
    rCtx.fillRect(x, y, len, 1);
  }

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAnisotropy;

  return { bumpMap, roughnessMap };
}

/**
 * 1024x1024 Golden-Hour Exterior Campus & Sunlit Foliage Backdrop rendered outside right-wall windows.
 */
export function createSunlitWindowBackdropTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(1024, 768);

  // Warm golden-hour sky gradient (pale azure zenith -> warm peach -> radiant gold horizon)
  const sky = ctx.createLinearGradient(0, 0, 0, 768);
  sky.addColorStop(0, '#89B9D8');
  sky.addColorStop(0.28, '#D7DFD8');
  sky.addColorStop(0.55, '#FBE2B0');
  sky.addColorStop(0.8, '#FFD38A');
  sky.addColorStop(1, '#C5A978');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1024, 768);

  // Radiant golden sun disc & atmospheric halo
  const sunX = 560;
  const sunY = 260;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 16, sunX, sunY, 420);
  sunGlow.addColorStop(0, 'rgba(255, 253, 236, 1)');
  sunGlow.addColorStop(0.18, 'rgba(255, 238, 182, 0.92)');
  sunGlow.addColorStop(0.45, 'rgba(255, 206, 128, 0.45)');
  sunGlow.addColorStop(1, 'rgba(255, 195, 110, 0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, 1024, 768);

  // Distant sunlit campus building silhouette (warm atmospheric perspective)
  ctx.fillStyle = 'rgba(184, 152, 124, 0.55)';
  ctx.fillRect(360, 465, 340, 210);
  ctx.fillStyle = 'rgba(245, 224, 186, 0.55)';
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      ctx.fillRect(382 + col * 38, 490 + row * 38, 22, 24);
    }
  }

  // Soft-focus backlit golden-green campus trees framing left & right of window view
  const treeClusters = [
    { cx: 140, cy: 360, r: 230, c1: '#4E7234', c2: '#B5C85E' },
    { cx: 290, cy: 240, r: 190, c1: '#5C7E3B', c2: '#D9DF78' },
    { cx: 880, cy: 310, r: 250, c1: '#44682E', c2: '#A8BF54' },
    { cx: 740, cy: 480, r: 185, c1: '#507234', c2: '#D2CE6A' },
    { cx: 180, cy: 590, r: 210, c1: '#3B5C29', c2: '#89A447' },
  ];

  for (const tc of treeClusters) {
    for (let i = 0; i < 65; i += 1) {
      const ang = hash2d(tc.cx + i, tc.cy) * Math.PI * 2;
      const dist = Math.pow(hash2d(i, tc.cx * 0.1), 0.65) * tc.r;
      const lx = tc.cx + Math.cos(ang) * dist;
      const ly = tc.cy + Math.sin(ang) * dist * 0.85;
      const lr = 16 + hash2d(i, 7.2) * 34;
      const litBySun = Math.hypot(lx - sunX, ly - sunY) < 340;
      ctx.fillStyle = litBySun
        ? i % 2 === 0
          ? 'rgba(232, 225, 118, 0.62)'
          : 'rgba(154, 186, 76, 0.64)'
        : i % 2 === 0
          ? tc.c1
          : tc.c2;
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Sunlit tree trunks & branches subtly visible through foliage
  ctx.strokeStyle = 'rgba(72, 54, 38, 0.42)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(120, 768);
  ctx.quadraticCurveTo(160, 560, 210, 340);
  ctx.moveTo(860, 768);
  ctx.quadraticCurveTo(830, 550, 790, 320);
  ctx.stroke();

  // Soft warm bloom veil over entire window exterior
  const bloom = ctx.createRadialGradient(sunX, sunY, 40, sunX, sunY, 540);
  bloom.addColorStop(0, 'rgba(255, 249, 220, 0.55)');
  bloom.addColorStop(0.5, 'rgba(255, 224, 155, 0.22)');
  bloom.addColorStop(1, 'rgba(255, 210, 140, 0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, 1024, 768);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * 512x512 Warm Golden Window-Mullion Sunlight Patch Cookie (for projected sunlight on floor & walnut benches).
 */
export function createSunPatchCookieTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 512);
  ctx.clearRect(0, 0, 512, 512);

  // Soft golden rectangular panes arranged in a 3x2 window mullion grid with feathered edges
  const cols = 3;
  const rows = 2;
  const pad = 26;
  const gap = 22;
  const cellW = (512 - pad * 2 - gap * (cols - 1)) / cols;
  const cellH = (512 - pad * 2 - gap * (rows - 1)) / rows;

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = pad + c * (cellW + gap);
      const y = pad + r * (cellH + gap);
      // Fade gently toward the left (farther from window)
      const colStrength = 0.55 + (c / (cols - 1)) * 0.45;
      const grad = ctx.createLinearGradient(x, y, x + cellW, y + cellH);
      grad.addColorStop(0, `rgba(255, 214, 138, ${0.42 * colStrength})`);
      grad.addColorStop(0.5, `rgba(255, 232, 168, ${0.82 * colStrength})`);
      grad.addColorStop(1, `rgba(255, 240, 192, ${0.95 * colStrength})`);

      ctx.save();
      ctx.filter = 'blur(8px)';
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, cellW, cellH);
      ctx.restore();
    }
  }

  // Soft outer fade vignette so edges never look clipped
  ctx.globalCompositeOperation = 'destination-in';
  const mask = ctx.createRadialGradient(275, 256, 60, 256, 256, 252);
  mask.addColorStop(0, 'rgba(255,255,255,1)');
  mask.addColorStop(0.76, 'rgba(255,255,255,0.85)');
  mask.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, 512, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface LiveWallClockTexture {
  texture: THREE.CanvasTexture;
  update: (date: Date) => void;
}

/**
 * Crisp dark-bezel real-time laboratory wall clock showing actual system time
 * (strictly independent of simulation clock).
 */
export function createWallClockTexture(maxAnisotropy: number): LiveWallClockTexture {
  const [canvas, ctx] = createCanvas(256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  let lastSec = -1;

  const update = (date: Date) => {
    const sec = date.getSeconds();
    if (sec === lastSec) return;
    lastSec = sec;

    const min = date.getMinutes();
    const hr = date.getHours() % 12;

    ctx.clearRect(0, 0, 256, 256);
    // Outer metallic slate bezel
    ctx.fillStyle = '#182428';
    ctx.beginPath();
    ctx.arc(128, 128, 124, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#C78A55';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Inner dial
    ctx.fillStyle = '#101B1F';
    ctx.beginPath();
    ctx.arc(128, 128, 110, 0, Math.PI * 2);
    ctx.fill();

    // Hour ticks
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const major = i % 3 === 0;
      const r1 = major ? 84 : 92;
      const r2 = 102;
      ctx.strokeStyle = major ? '#78D4C4' : '#7E989B';
      ctx.lineWidth = major ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1);
      ctx.lineTo(128 + Math.cos(a) * r2, 128 + Math.sin(a) * r2);
      ctx.stroke();
    }

    // Subtle "LAB TIME" text
    ctx.fillStyle = '#7E999B';
    ctx.font = '600 13px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LAB 12', 128, 86);

    // Hour hand
    const hAngle = ((hr + min / 60) / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = '#EDF4F1';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.lineTo(128 + Math.cos(hAngle) * 52, 128 + Math.sin(hAngle) * 52);
    ctx.stroke();

    // Minute hand
    const mAngle = ((min + sec / 60) / 60) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = '#D3EAE7';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.lineTo(128 + Math.cos(mAngle) * 76, 128 + Math.sin(mAngle) * 76);
    ctx.stroke();

    // Second hand (copper-gold)
    const sAngle = (sec / 60) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = '#E6A063';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(128 - Math.cos(sAngle) * 16, 128 - Math.sin(sAngle) * 16);
    ctx.lineTo(128 + Math.cos(sAngle) * 84, 128 + Math.sin(sAngle) * 84);
    ctx.stroke();

    // Center cap
    ctx.fillStyle = '#E6A063';
    ctx.beginPath();
    ctx.arc(128, 128, 6, 0, Math.PI * 2);
    ctx.fill();

    texture.needsUpdate = true;
  };

  update(new Date());
  return { texture, update };
}

export function createBeakerGraduationTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 256);
  ctx.clearRect(0, 0, 512, 256);

  const centerX = 256;
  ctx.strokeStyle = 'rgba(242, 250, 252, 0.85)';
  ctx.fillStyle = 'rgba(244, 252, 254, 0.92)';
  ctx.lineWidth = 2.2;
  ctx.font = '600 18px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const marks = [
    { y: 48, label: '250 mL', len: 30 },
    { y: 88, label: '200', len: 22 },
    { y: 128, label: '150', len: 26 },
    { y: 168, label: '100', len: 22 },
    { y: 208, label: '50', len: 20 },
  ];

  // Vertical spine + intermediate half-ticks
  ctx.beginPath();
  ctx.moveTo(centerX - 32, 44);
  ctx.lineTo(centerX - 32, 218);
  ctx.stroke();

  for (let y = 68; y <= 188; y += 40) {
    ctx.beginPath();
    ctx.moveTo(centerX - 32, y);
    ctx.lineTo(centerX - 20, y);
    ctx.stroke();
  }

  for (const m of marks) {
    ctx.beginPath();
    ctx.moveTo(centerX - 32, m.y);
    ctx.lineTo(centerX - 32 + m.len, m.y);
    ctx.stroke();
    ctx.fillText(m.label, centerX + 4, m.y);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createLabWallSignTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(1024, 220);
  ctx.clearRect(0, 0, 1024, 220);

  ctx.fillStyle = '#152529';
  ctx.beginPath();
  ctx.moveTo(64, 18);
  ctx.lineTo(960, 18);
  ctx.lineTo(1006, 110);
  ctx.lineTo(960, 202);
  ctx.lineTo(64, 202);
  ctx.lineTo(18, 110);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#C77B4C';
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.strokeStyle = '#78D4C4';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(78, 110);
  ctx.lineTo(138, 110);
  ctx.moveTo(886, 110);
  ctx.lineTo(946, 110);
  ctx.stroke();

  ctx.fillStyle = '#EDF4F1';
  ctx.font = '700 66px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Phòng thí nghiệm', 512, 112);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createWallDiagramTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 360);
  ctx.fillStyle = '#101B1E';
  ctx.fillRect(0, 0, 512, 360);

  ctx.strokeStyle = '#C77B4C';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 350);

  ctx.strokeStyle = '#78D4C4';
  ctx.lineWidth = 4;
  ctx.strokeRect(72, 165, 130, 135);
  ctx.strokeRect(310, 165, 130, 135);
  ctx.fillStyle = 'rgba(120, 212, 196, 0.14)';
  ctx.fillRect(74, 215, 126, 83);
  ctx.fillRect(312, 215, 126, 83);
  ctx.strokeRect(102, 130, 22, 145);
  ctx.strokeRect(388, 130, 22, 145);
  ctx.beginPath();
  ctx.moveTo(165, 250);
  ctx.lineTo(165, 178);
  ctx.quadraticCurveTo(165, 145, 200, 145);
  ctx.lineTo(312, 145);
  ctx.quadraticCurveTo(347, 145, 347, 178);
  ctx.lineTo(347, 250);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(113, 130);
  ctx.lineTo(113, 72);
  ctx.lineTo(222, 72);
  ctx.moveTo(290, 72);
  ctx.lineTo(399, 72);
  ctx.lineTo(399, 130);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(256, 72, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#78D4C4';
  ctx.font = '700 32px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('V', 256, 74);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createStationPlaqueTexture(
  code: string,
  maxAnisotropy: number,
  warmGoldAccent = false
): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(640, 148);
  const bg = ctx.createLinearGradient(0, 0, 0, 148);
  bg.addColorStop(0, warmGoldAccent ? '#241B15' : '#132227');
  bg.addColorStop(1, warmGoldAccent ? '#16110D' : '#0B1519');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 640, 148);

  const border = warmGoldAccent ? '#DFAA6D' : '#65C9BA';
  ctx.strokeStyle = border;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 624, 132);

  // Subtle corner rivets matching brass lab nameplates in reference render
  ctx.fillStyle = warmGoldAccent ? '#E6B87A' : '#78D4C4';
  for (const [rx, ry] of [
    [26, 26],
    [614, 26],
    [26, 122],
    [614, 122],
  ]) {
    ctx.beginPath();
    ctx.arc(rx, ry, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = warmGoldAccent ? '#FCE4C2' : '#EBF6F4';
  ctx.font = '700 40px "Be Vietnam Pro", "IBM Plex Mono", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(code, 320, 76);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.52)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.2)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface LiveDisplayTexture {
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  lastKey: string;
  draw: (primary: string, secondary?: string, accentColor?: string) => void;
}

export function createLiveDisplayTexture(maxAnisotropy: number): LiveDisplayTexture {
  const [canvas, ctx] = createCanvas(384, 192);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;

  const handle: LiveDisplayTexture = {
    texture,
    canvas,
    ctx,
    lastKey: '',
    draw(primary: string, secondary = '', accentColor = '#78D4C4') {
      const key = `${primary}|${secondary}|${accentColor}`;
      if (key === handle.lastKey) return;
      handle.lastKey = key;

      const bg = ctx.createLinearGradient(0, 0, 0, 192);
      bg.addColorStop(0, '#071114');
      bg.addColorStop(1, '#0E1C21');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 384, 192);

      // Glass reflection streak across OLED readout
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(250, 0);
      ctx.lineTo(130, 192);
      ctx.lineTo(0, 192);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#2B4B52';
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, 368, 176);

      ctx.fillStyle = accentColor;
      ctx.font = '700 66px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(primary, 192, secondary ? 78 : 98);

      if (secondary) {
        ctx.fillStyle = '#C4D9DC';
        ctx.font = '600 26px "IBM Plex Mono", monospace';
        ctx.fillText(secondary, 192, 144);
      }

      texture.needsUpdate = true;
    },
  };

  handle.draw('1,103 V', 'E°pin');
  return handle;
}

export function createSmartBoardIdleTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(1024, 576);

  const bg = ctx.createLinearGradient(0, 0, 1024, 576);
  bg.addColorStop(0, '#0D1C21');
  bg.addColorStop(1, '#142930');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 576);

  ctx.strokeStyle = 'rgba(120, 212, 196, 0.07)';
  ctx.lineWidth = 1;
  for (let x = 48; x < 1024; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 576);
    ctx.stroke();
  }
  for (let y = 48; y < 576; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#78D4C4';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, 988, 540);

  ctx.fillStyle = '#78D4C4';
  ctx.font = '600 22px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('CHƯƠNG 5 · PIN ĐIỆN & ĐIỆN PHÂN', 56, 72);

  ctx.fillStyle = '#EDF4F1';
  ctx.font = '700 54px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText('HÓA HỌC 12 — ĐIỆN HÓA', 56, 140);

  ctx.fillStyle = '#D98E54';
  ctx.fillRect(56, 182, 240, 5);

  ctx.fillStyle = '#D2E8E5';
  ctx.font = '600 24px "IBM Plex Mono", monospace';
  ctx.fillText('• Pin Zn–Cu: Zn + Cu²⁺ → Zn²⁺ + Cu (E° = 1,103 V)', 56, 248);
  ctx.fillText('• Điện phân: Anode (+) oxi hóa · Cathode (−) khử', 56, 304);
  ctx.fillText('• Faraday:   m = (A · I · t) / (n · F)', 56, 360);

  ctx.strokeStyle = '#78D4C4';
  ctx.lineWidth = 3;
  ctx.strokeRect(776, 226, 74, 88);
  ctx.strokeRect(888, 226, 74, 88);
  ctx.fillStyle = 'rgba(20, 128, 245, 0.42)';
  ctx.fillRect(892, 256, 66, 54);
  ctx.beginPath();
  ctx.moveTo(834, 272);
  ctx.lineTo(834, 206);
  ctx.lineTo(904, 206);
  ctx.lineTo(904, 272);
  ctx.stroke();

  ctx.fillStyle = 'rgba(120, 212, 196, 0.16)';
  ctx.fillRect(56, 444, 520, 74);
  ctx.strokeStyle = '#78D4C4';
  ctx.lineWidth = 3;
  ctx.strokeRect(56, 444, 520, 74);

  ctx.fillStyle = '#78D4C4';
  ctx.font = '700 30px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText('Chạm để bắt đầu bài học  →', 84, 482);

  ctx.fillStyle = '#A8C0BF';
  ctx.font = '500 22px "IBM Plex Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText('10 bài giảng · Tương tác 3D', 964, 482);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createPracticeCoverSheetTexture(
  maxAnisotropy: number,
  standardCount = 36,
  visual3DCount = 6
): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 680);

  const bg = ctx.createLinearGradient(0, 0, 512, 680);
  bg.addColorStop(0, '#FDF9F0');
  bg.addColorStop(1, '#F2EAD8');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 680);

  // Subtle folded top-right dog-ear
  ctx.fillStyle = '#E4DAC3';
  ctx.beginPath();
  ctx.moveTo(446, 0);
  ctx.lineTo(512, 66);
  ctx.lineTo(446, 66);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#CFC5AE';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 472, 640);

  ctx.fillStyle = '#15272C';
  ctx.fillRect(36, 42, 440, 146);
  ctx.fillStyle = '#78D4C4';
  ctx.font = '600 19px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HÓA HỌC 12 · CHƯƠNG 5', 256, 76);

  ctx.fillStyle = '#F2F7F5';
  ctx.font = '700 40px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText('LUYỆN TẬP', 256, 124);

  ctx.fillStyle = '#EBB982';
  ctx.font = '600 18px "IBM Plex Mono", monospace';
  ctx.fillText(`${standardCount} câu + ${visual3DCount} câu tương tác 3D`, 256, 162);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#1E2D32';
  ctx.font = '700 22px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText('Bộ đề điện hóa tương tác', 46, 232);

  ctx.strokeStyle = '#C77B4C';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(46, 252);
  ctx.lineTo(256, 252);
  ctx.stroke();

  const rows = [
    '1. Cặp oxi hóa – khử & E°pin',
    '2. Pin Galvani Zn–Cu & cầu muối',
    '3. Điện phân CuSO₄ & NaCl',
    '4. Định luật Faraday (m, V khí)',
    '5. Chọn trực tiếp trên mô hình 3D',
  ];
  rows.forEach((line, idx) => {
    const y = 296 + idx * 42;
    ctx.strokeStyle = '#2B7A6F';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(48, y - 11, 20, 20);
    if (idx < 2) {
      ctx.beginPath();
      ctx.moveTo(52, y - 1);
      ctx.lineTo(57, y + 5);
      ctx.lineTo(65, y - 7);
      ctx.stroke();
    }
    ctx.fillStyle = '#384A50';
    ctx.font = '500 19px "IBM Plex Mono", monospace';
    ctx.fillText(line, 80, y);
  });

  ctx.strokeStyle = 'rgba(199, 123, 76, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(432, 514, 30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(199, 123, 76, 0.72)';
  ctx.font = '700 32px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('?', 432, 516);

  ctx.strokeStyle = '#E1DAC4';
  ctx.lineWidth = 2;
  for (let y = 502; y <= 550; y += 24) {
    ctx.beginPath();
    ctx.moveTo(46, y);
    ctx.lineTo(382, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#15272C';
  ctx.fillRect(46, 578, 420, 56);
  ctx.strokeStyle = '#78D4C4';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(46, 578, 420, 56);
  ctx.fillStyle = '#78D4C4';
  ctx.font = '700 22px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Làm bài ngay  →', 256, 608);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createStickyNoteTexture(
  line1: string,
  line2: string,
  bgHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(256, 256);
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = 'rgba(20, 24, 26, 0.08)';
  ctx.fillRect(0, 0, 256, 38);

  ctx.strokeStyle = 'rgba(20, 24, 26, 0.14)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 252);

  ctx.fillStyle = '#1D292D';
  ctx.font = '700 26px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(line1, 128, 112);

  ctx.fillStyle = '#31444A';
  ctx.font = '600 22px "IBM Plex Mono", monospace';
  ctx.fillText(line2, 128, 162);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createNotebookSpreadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 384);
  ctx.fillStyle = '#FBF7EC';
  ctx.fillRect(0, 0, 512, 384);

  const spineGrad = ctx.createLinearGradient(236, 0, 276, 0);
  spineGrad.addColorStop(0, 'rgba(30,25,18,0)');
  spineGrad.addColorStop(0.5, 'rgba(30,25,18,0.22)');
  spineGrad.addColorStop(1, 'rgba(30,25,18,0)');
  ctx.fillStyle = spineGrad;
  ctx.fillRect(236, 0, 40, 384);

  ctx.strokeStyle = 'rgba(130, 160, 170, 0.28)';
  ctx.lineWidth = 1.5;
  for (let y = 52; y < 360; y += 26) {
    ctx.beginPath();
    ctx.moveTo(22, y);
    ctx.lineTo(240, y);
    ctx.moveTo(272, y);
    ctx.lineTo(490, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#19353B';
  ctx.font = '700 20px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Pin Zn – Cu', 26, 36);

  ctx.fillStyle = '#B25C30';
  ctx.font = '600 16px "IBM Plex Mono", monospace';
  ctx.fillText('Anode: Zn → Zn²⁺ + 2e⁻', 26, 92);
  ctx.fillStyle = '#2B4248';
  ctx.fillText('Cathode: Cu²⁺ + 2e⁻ → Cu', 26, 126);
  ctx.fillText('E°pin = +1,103 V', 26, 178);
  ctx.fillText('Q = I · t = nₑ · F', 26, 256);
  ctx.fillText('F = 96 500 C/mol', 26, 282);

  ctx.fillStyle = '#19353B';
  ctx.font = '700 18px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText('Sơ đồ nhanh', 284, 36);

  ctx.strokeStyle = '#1D6B61';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(292, 92, 68, 84);
  ctx.strokeRect(400, 92, 68, 84);
  ctx.fillStyle = 'rgba(26, 134, 224, 0.25)';
  ctx.fillRect(402, 126, 64, 48);
  ctx.beginPath();
  ctx.moveTo(342, 134);
  ctx.lineTo(342, 74);
  ctx.lineTo(420, 74);
  ctx.lineTo(420, 134);
  ctx.stroke();

  ctx.fillStyle = '#B25C30';
  ctx.font = '700 15px "IBM Plex Mono", monospace';
  ctx.fillText('e⁻ →', 362, 66);
  ctx.fillStyle = '#2B4248';
  ctx.fillText('Zn(−)      Cu(+)', 294, 206);
  ctx.fillText('✓ Cầu muối KNO₃', 284, 260);
  ctx.fillText('✓ 24,79 L/mol (đkc)', 284, 294);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createLabReadyPlaqueTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(384, 96);
  ctx.fillStyle = '#132125';
  ctx.fillRect(0, 0, 384, 96);
  ctx.strokeStyle = '#C77B4C';
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, 376, 88);

  ctx.fillStyle = '#78D4C4';
  ctx.beginPath();
  ctx.arc(38, 48, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#EDF4F1';
  ctx.font = '700 28px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('LAB READY', 64, 49);

  ctx.fillStyle = '#8FA7A7';
  ctx.font = '600 18px "IBM Plex Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText('CH.5', 356, 49);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createRedoxWallChartTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 360);
  ctx.fillStyle = '#111D21';
  ctx.fillRect(0, 0, 512, 360);
  ctx.strokeStyle = '#3B5C63';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 500, 348);

  ctx.fillStyle = '#78D4C4';
  ctx.font = '700 22px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('DÃY THẾ ĐIỆN CỰC CHUẨN E° (V)', 28, 48);

  ctx.fillStyle = '#C77B4C';
  ctx.fillRect(28, 64, 180, 4);

  const pairs = [
    ['K⁺/K', '−2,931', 0.14],
    ['Na⁺/Na', '−2,713', 0.2],
    ['Zn²⁺/Zn', '−0,763', 0.42],
    ['Fe²⁺/Fe', '−0,440', 0.5],
    ['2H⁺/H₂', ' 0,000', 0.58],
    ['Cu²⁺/Cu', '+0,340', 0.72],
    ['Ag⁺/Ag', '+0,799', 0.88],
  ] as const;

  pairs.forEach(([label, val, ratio], idx) => {
    const y = 104 + idx * 34;
    ctx.fillStyle = '#D7E7E5';
    ctx.font = '600 18px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(label, 28, y);

    ctx.fillStyle = '#1D3137';
    ctx.fillRect(142, y - 12, 230, 14);
    ctx.fillStyle = idx >= 5 ? '#C77B4C' : idx === 4 ? '#EDF4F1' : '#78D4C4';
    ctx.fillRect(142, y - 12, Math.round(230 * ratio), 14);

    ctx.fillStyle = '#9BB8B5';
    ctx.textAlign = 'right';
    ctx.fillText(`${val} V`, 480, y);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createSafetyPlaqueTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(384, 240);
  ctx.fillStyle = '#152226';
  ctx.fillRect(0, 0, 384, 240);
  ctx.strokeStyle = '#C77B4C';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 368, 224);

  ctx.strokeStyle = '#E6B27D';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(62, 42);
  ctx.lineTo(94, 96);
  ctx.lineTo(30, 96);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = '#E6B27D';
  ctx.font = '700 32px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('!', 62, 86);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#EDF4F1';
  ctx.font = '700 22px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText('AN TOÀN PHÒNG LAB', 114, 62);
  ctx.fillStyle = '#78D4C4';
  ctx.font = '600 15px "IBM Plex Mono", monospace';
  ctx.fillText('ELECTROCHEMISTRY SAFETY', 114, 88);

  ctx.fillStyle = '#B8CECD';
  ctx.font = '500 16px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText('• Kiểm tra cực (+) / (−) trước khi đóng mạch', 28, 138);
  ctx.fillText('• Thu khí Cl₂ trong hệ điện phân có màng', 28, 170);
  ctx.fillText('• Không để dây dẫn chạm dung dịch điện li', 28, 202);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createDeskStickerTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(160, 160);
  ctx.clearRect(0, 0, 160, 160);

  ctx.fillStyle = '#183036';
  ctx.beginPath();
  ctx.arc(80, 80, 68, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#78D4C4';
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.strokeStyle = '#E8B17E';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(68, 36);
  ctx.lineTo(92, 36);
  ctx.moveTo(72, 36);
  ctx.lineTo(72, 62);
  ctx.lineTo(48, 108);
  ctx.lineTo(112, 108);
  ctx.lineTo(88, 62);
  ctx.lineTo(88, 36);
  ctx.stroke();

  ctx.fillStyle = '#78D4C4';
  ctx.font = '700 22px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('e⁻', 80, 98);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}
