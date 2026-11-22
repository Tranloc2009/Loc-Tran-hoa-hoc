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

export function createWalnutWoodTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const [canvas, ctx] = createCanvas(512, 512);
  ctx.fillStyle = '#4E3323';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle horizontal walnut grain streaks
  for (let y = 0; y < 512; y += 2) {
    const wave = Math.sin(y * 0.06) * 8 + Math.sin(y * 0.19) * 4;
    const tone = Math.floor(14 * Math.sin(y * 0.09) + (y % 7) * 1.5);
    const r = Math.min(110, Math.max(48, 78 + tone));
    const g = Math.min(76, Math.max(32, 50 + Math.floor(tone * 0.65)));
    const b = Math.min(54, Math.max(20, 34 + Math.floor(tone * 0.45)));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, y, 512, 2);

    if (y % 18 === 0) {
      ctx.strokeStyle = 'rgba(26, 15, 9, 0.24)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(170, y + wave, 340, y - wave, 512, y);
      ctx.stroke();
    }
  }

  // Plank seams
  ctx.strokeStyle = 'rgba(20, 11, 6, 0.35)';
  ctx.lineWidth = 2;
  for (const py of [128, 256, 384]) {
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(512, py);
    ctx.stroke();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAnisotropy;

  // Matching subtle grayscale bump texture
  const [bCanvas, bCtx] = createCanvas(256, 256);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    const v = 128 + Math.floor(Math.sin(y * 0.22) * 18 + Math.cos(y * 0.53) * 10);
    bCtx.fillStyle = `rgb(${v},${v},${v})`;
    bCtx.fillRect(0, y, 256, 2);
  }
  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

export function createSlateFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 512);
  ctx.fillStyle = '#2B3135';
  ctx.fillRect(0, 0, 512, 512);

  // 2x2 architectural matte stone tiles
  const tiles = [
    { x: 0, y: 0, fill: '#2D3438' },
    { x: 256, y: 0, fill: '#293034' },
    { x: 0, y: 256, fill: '#282F33' },
    { x: 256, y: 256, fill: '#2E3539' },
  ];
  for (const t of tiles) {
    ctx.fillStyle = t.fill;
    ctx.fillRect(t.x + 2, t.y + 2, 252, 252);
    // Gentle stone speckle
    for (let i = 0; i < 160; i++) {
      const sx = t.x + ((i * 53) % 248) + 2;
      const sy = t.y + ((i * 97) % 248) + 2;
      const alpha = (i % 5) * 0.012 + 0.015;
      ctx.fillStyle = i % 2 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha * 1.4})`;
      ctx.fillRect(sx, sy, 3, 2);
    }
  }

  // Grout lines
  ctx.strokeStyle = '#1B2124';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, 512, 512);
  ctx.beginPath();
  ctx.moveTo(256, 0);
  ctx.lineTo(256, 512);
  ctx.moveTo(0, 256);
  ctx.lineTo(512, 256);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(7, 5);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createBeakerGraduationTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 256);
  ctx.clearRect(0, 0, 512, 256);

  // Place crisp graduation marks along the front-facing quadrant of cylinder UV
  const centerX = 256;
  ctx.strokeStyle = 'rgba(235, 245, 244, 0.72)';
  ctx.fillStyle = 'rgba(235, 245, 244, 0.82)';
  ctx.lineWidth = 2;
  ctx.font = '600 18px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const marks = [
    { y: 52, label: '250 mL', len: 28 },
    { y: 92, label: '200', len: 22 },
    { y: 132, label: '150', len: 26 },
    { y: 172, label: '100', len: 22 },
    { y: 212, label: '50', len: 20 },
  ];

  // Vertical spine
  ctx.beginPath();
  ctx.moveTo(centerX - 30, 48);
  ctx.lineTo(centerX - 30, 218);
  ctx.stroke();

  for (const m of marks) {
    ctx.beginPath();
    ctx.moveTo(centerX - 30, m.y);
    ctx.lineTo(centerX - 30 + m.len, m.y);
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

  // Chamfered architectural dark-lab plaque matching Storyboard 01
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

  // Inner mint accents
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

  // Minimalist glowing teal galvanic cell blueprint matching Storyboard 01
  ctx.strokeStyle = '#78D4C4';
  ctx.lineWidth = 4;
  // Left beaker
  ctx.strokeRect(72, 165, 130, 135);
  // Right beaker
  ctx.strokeRect(310, 165, 130, 135);
  // Liquid surfaces
  ctx.fillStyle = 'rgba(120, 212, 196, 0.14)';
  ctx.fillRect(74, 215, 126, 83);
  ctx.fillRect(312, 215, 126, 83);
  // Electrodes
  ctx.strokeRect(102, 130, 22, 145);
  ctx.strokeRect(388, 130, 22, 145);
  // Salt bridge U
  ctx.beginPath();
  ctx.moveTo(165, 250);
  ctx.lineTo(165, 178);
  ctx.quadraticCurveTo(165, 145, 200, 145);
  ctx.lineTo(312, 145);
  ctx.quadraticCurveTo(347, 145, 347, 178);
  ctx.lineTo(347, 250);
  ctx.stroke();
  // Wire & voltmeter
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
  maxAnisotropy: number
): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 128);
  ctx.fillStyle = '#132226';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#365056';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 116);

  ctx.fillStyle = '#78D4C4';
  ctx.font = '600 36px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(code, 256, 66);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.22)');
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

      ctx.fillStyle = '#0B1417';
      ctx.fillRect(0, 0, 384, 192);

      // Subtle inner bezel line
      ctx.strokeStyle = '#253D43';
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, 368, 176);

      ctx.fillStyle = accentColor;
      ctx.font = '700 66px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(primary, 192, secondary ? 78 : 98);

      if (secondary) {
        ctx.fillStyle = '#B7CCD0';
        ctx.font = '600 28px "IBM Plex Mono", monospace';
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

  // Deep architectural classroom slate background
  const bg = ctx.createLinearGradient(0, 0, 1024, 576);
  bg.addColorStop(0, '#0E1B1F');
  bg.addColorStop(1, '#15272C');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 576);

  // Subtle geometric grid
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

  // Outer refined border
  ctx.strokeStyle = '#78D4C4';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, 988, 540);

  // Top badge
  ctx.fillStyle = '#78D4C4';
  ctx.font = '600 22px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('CHƯƠNG 5 · PIN ĐIỆN & ĐIỆN PHÂN', 56, 72);

  // Main title
  ctx.fillStyle = '#EDF4F1';
  ctx.font = '700 54px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText('HÓA HỌC 12 — ĐIỆN HÓA', 56, 140);

  // Copper rule accent
  ctx.fillStyle = '#C77B4C';
  ctx.fillRect(56, 182, 240, 5);

  // Key schematic formulas on left
  ctx.fillStyle = '#CBE3E0';
  ctx.font = '600 28px "IBM Plex Mono", monospace';
  ctx.fillText('• Pin Zn–Cu:   Zn + Cu²⁺ → Zn²⁺ + Cu   (E° = 1,103 V)', 56, 250);
  ctx.fillText('• Điện phân:   Anode (+) oxi hóa · Cathode (−) khử', 56, 308);
  ctx.fillText('• Faraday:     m = (A · I · t) / (n · F)', 56, 366);

  // Miniature schematic on right
  ctx.strokeStyle = '#78D4C4';
  ctx.lineWidth = 3;
  ctx.strokeRect(724, 224, 88, 96);
  ctx.strokeRect(862, 224, 88, 96);
  ctx.fillStyle = 'rgba(38, 146, 242, 0.25)';
  ctx.fillRect(866, 258, 80, 58);
  ctx.beginPath();
  ctx.moveTo(792, 276);
  ctx.lineTo(792, 206);
  ctx.lineTo(882, 206);
  ctx.lineTo(882, 276);
  ctx.stroke();

  // Interactive prompt button strip at bottom
  ctx.fillStyle = 'rgba(120, 212, 196, 0.16)';
  ctx.fillRect(56, 444, 520, 74);
  ctx.strokeStyle = '#78D4C4';
  ctx.lineWidth = 3;
  ctx.strokeRect(56, 444, 520, 74);

  ctx.fillStyle = '#78D4C4';
  ctx.font = '700 30px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText('Chạm để bắt đầu bài học  →', 84, 482);

  ctx.fillStyle = '#A2B6B5';
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

  // Warm cream examination paper with subtle linen tint
  const bg = ctx.createLinearGradient(0, 0, 512, 680);
  bg.addColorStop(0, '#FCF8EF');
  bg.addColorStop(1, '#F3ECDC');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 680);

  // Subtle folded top-right dog-ear visual shadow
  ctx.fillStyle = '#E5DCC6';
  ctx.beginPath();
  ctx.moveTo(446, 0);
  ctx.lineTo(512, 66);
  ctx.lineTo(446, 66);
  ctx.closePath();
  ctx.fill();

  // Crisp academic margin border
  ctx.strokeStyle = '#CFC5AE';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 472, 640);

  // Deep slate-teal header band
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

  ctx.fillStyle = '#E6B27D';
  ctx.font = '600 18px "IBM Plex Mono", monospace';
  ctx.fillText(`${standardCount} câu + ${visual3DCount} câu tương tác 3D`, 256, 162);

  // Section heading
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

  // Checklist rows with subtle check icons
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

  // Subtle question-mark emblem stamp on right
  ctx.strokeStyle = 'rgba(199, 123, 76, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(432, 514, 30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(199, 123, 76, 0.72)';
  ctx.font = '700 32px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('?', 432, 516);

  // Faint ruled writing lines
  ctx.strokeStyle = '#E1DAC4';
  ctx.lineWidth = 2;
  for (let y = 502; y <= 550; y += 24) {
    ctx.beginPath();
    ctx.moveTo(46, y);
    ctx.lineTo(382, y);
    ctx.stroke();
  }

  // Call-to-action bar
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

  // Subtle darker adhesive top strip
  ctx.fillStyle = 'rgba(20, 24, 26, 0.08)';
  ctx.fillRect(0, 0, 256, 38);

  // Gentle paper shadow edge
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

  // Center spine crease shadow
  const spineGrad = ctx.createLinearGradient(236, 0, 276, 0);
  spineGrad.addColorStop(0, 'rgba(30,25,18,0)');
  spineGrad.addColorStop(0.5, 'rgba(30,25,18,0.22)');
  spineGrad.addColorStop(1, 'rgba(30,25,18,0)');
  ctx.fillStyle = spineGrad;
  ctx.fillRect(236, 0, 40, 384);

  // Ruled lines across both pages
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

  // Left page notes: Redox & E°pin
  ctx.fillStyle = '#19353B';
  ctx.font = '700 20px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Ghi chú Điện hóa', 26, 36);

  ctx.fillStyle = '#B25C30';
  ctx.font = '600 16px "IBM Plex Mono", monospace';
  ctx.fillText('E°pin = E°cat − E°an', 26, 92);
  ctx.fillStyle = '#2B4248';
  ctx.fillText('Zn–Cu: +1,103 V', 26, 126);
  ctx.fillText('Anode: Oxi hóa', 26, 178);
  ctx.fillText('Cathode: Khử', 26, 204);
  ctx.fillText('Q = I · t = nₑ · F', 26, 256);
  ctx.fillText('F = 96 500 C/mol', 26, 282);

  // Right page mini schematic sketch
  ctx.fillStyle = '#19353B';
  ctx.font = '700 18px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText('Sơ đồ nhanh', 284, 36);

  ctx.strokeStyle = '#1D6B61';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(292, 92, 68, 84);
  ctx.strokeRect(400, 92, 68, 84);
  ctx.fillStyle = 'rgba(26, 134, 224, 0.22)';
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

  // Subtle green indicator dot (static, clean)
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

    // Mini bar scale
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

  // Subtle amber warning triangle
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

  // Circular muted teal-copper lab badge sticker
  ctx.fillStyle = '#183036';
  ctx.beginPath();
  ctx.arc(80, 80, 68, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#78D4C4';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Minimalist conical flask icon
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
