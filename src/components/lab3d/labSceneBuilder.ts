import * as THREE from 'three';
import {
  LAB_BENCH_DIMENSIONS,
  LAB_OBJECTS,
  LAB_TABLES,
  Lab3DVisuals,
  LabExperimentId,
  LabObjectId,
  TABLE_POSITIONS,
  TABLE_TOP_Y,
} from '../../utils/lab3dState';
import {
  DEFAULT_MACRO_OPTIONS,
  MICRO_SPECIES_META,
  MICRO_ZONES,
  MacroDisplayOptions,
  MicroscopicFrameData,
  PRACTICE_BANK_STATS,
  WORLD_ANCHORS,
  WorldZone,
} from '../../utils/labWorldState';
import {
  LiveDisplayTexture,
  LiveWallClockTexture,
  createBeakerGraduationTexture,
  createBrushedMetalTextures,
  createContactShadowTexture,
  createDeskStickerTexture,
  createLabReadyPlaqueTexture,
  createLiveDisplayTexture,
  createMicroCementWallTextures,
  createNotebookSpreadTexture,
  createPolishedConcreteFloorTextures,
  createPracticeCoverSheetTexture,
  createRedoxWallChartTexture,
  createSafetyPlaqueTexture,
  createSmartBoardIdleTexture,
  createStationPlaqueTexture,
  createStickyNoteTexture,
  createSunPatchCookieTexture,
  createSunlitWindowBackdropTexture,
  createWallClockTexture,
  createWalnutWoodTextures,
} from './labTextures';

export interface SelectableHitTarget {
  mesh: THREE.Mesh;
  kind: 'table' | 'object' | 'zone';
  station?: LabExperimentId;
  objectId?: LabObjectId;
  zoneId?: 'BOARD' | 'PRACTICE';
}

export interface WorldVisualOptions {
  zone: WorldZone;
  hoveredZone: 'BOARD' | 'PRACTICE' | null;
  cutawayActive: boolean;
  microFrame: MicroscopicFrameData | null;
  microShowHydration: boolean;
  microShowReactionZone: boolean;
  microShowArrows: boolean;
  macroOptions?: MacroDisplayOptions;
  practiceFlipAngle: number; // 0 .. Math.PI
  practiceOpenLift: number; // 0 .. 1
  practiceLampOn?: boolean;
  sunShaftOpacity?: number;
  clockTimeMs?: number;
  visualQuizCandidates?: LabObjectId[] | null;
  visualQuizSelected?: LabObjectId | null;
}

export interface LabSceneRig {
  scene: THREE.Scene;
  // Lighting refs for Focus Reaction, Golden-Hour Sun & dynamic quality tiers
  hemiLight: THREE.HemisphereLight;
  keyLight: THREE.DirectionalLight;
  windowFill: THREE.DirectionalLight;
  rimLight: THREE.PointLight;
  practiceLampLight: THREE.PointLight;
  practiceLampBulbMat: THREE.MeshBasicMaterial;
  focusSpotLight: THREE.PointLight;
  // V4 Sunlight, volumetric shafts, dust motes, PBR glass & real-time wall clock
  sunShaftMaterials: THREE.ShaderMaterial[];
  sunPatchMaterials: THREE.MeshBasicMaterial[];
  sunDustPoints: THREE.Points;
  sunDustBasePositions: Float32Array;
  glassMaterials: THREE.MeshPhysicalMaterial[];
  wallClock: LiveWallClockTexture;
  zoneHitboxes: SelectableHitTarget[];
  tableHitboxes: SelectableHitTarget[];
  objectHitboxes: SelectableHitTarget[];
  occlusionMeshes: THREE.Object3D[];
  tableRimMaterials: Record<LabExperimentId, THREE.MeshStandardMaterial>;
  tableLedMaterials: Record<LabExperimentId, THREE.MeshStandardMaterial>;
  objectHighlightMaterials: Partial<Record<LabObjectId, THREE.MeshBasicMaterial>>;
  // Smart Teaching Board & Practice Desk refs
  boardBezelMat: THREE.MeshStandardMaterial;
  practiceRimMat: THREE.MeshStandardMaterial;
  practicePagePivot: THREE.Group;
  practiceStackTopGroup: THREE.Group;
  // Cutaway & Microscopic 3D Rig
  cutawayClipPlane: THREE.Plane;
  microGroup: THREE.Group;
  microRing: THREE.Mesh;
  microIonMesh: THREE.InstancedMesh;
  microHydrationMesh: THREE.InstancedMesh;
  microLatticeMesh: THREE.InstancedMesh;
  microArrows: THREE.Group[];
  // Macro Observation Rig (directional chevrons + reaction-zone halos)
  macroElectronArrows: THREE.Mesh[];
  macroIonArrows: THREE.Mesh[];
  macroReactionRings: THREE.Mesh[];
  // Station 1 dynamic refs
  znCuSwitchPivot: THREE.Group;
  znCuSwitchLedMat: THREE.MeshBasicMaterial;
  znCuVoltmeterDisplay: LiveDisplayTexture;
  znCuZnPlate: THREE.Mesh;
  znCuCuPlating: THREE.Group;
  znCuCuPlatingMat: THREE.MeshStandardMaterial;
  znCuCuSolutionMat: THREE.MeshPhysicalMaterial;
  znCuWireCurve: THREE.CatmullRomCurve3;
  znCuWireGlowMesh: THREE.Mesh;
  znCuElectrons: THREE.Mesh[];
  znCuKCurve: THREE.CatmullRomCurve3;
  znCuNO3Curve: THREE.CatmullRomCurve3;
  znCuKIons: THREE.Mesh[];
  znCuNO3Ions: THREE.Mesh[];
  // Station 2 dynamic refs
  cuso4Display: LiveDisplayTexture;
  cuso4SolutionMat: THREE.MeshPhysicalMaterial;
  cuso4CathodePlating: THREE.Group;
  cuso4CathodePlatingMat: THREE.MeshStandardMaterial;
  cuso4AnodeGraphite: THREE.Mesh;
  cuso4AnodeCopper: THREE.Mesh;
  cuso4WireCurve: THREE.CatmullRomCurve3;
  cuso4WireGlowMesh: THREE.Mesh;
  cuso4Electrons: THREE.Mesh[];
  cuso4O2Bubbles: THREE.Mesh[];
  cuso4H2Bubbles: THREE.Mesh[];
  // Station 3 dynamic refs
  naclDisplay: LiveDisplayTexture;
  naclBrineGroup: THREE.Group;
  naclMoltenGroup: THREE.Group;
  naclMembraneHitbox: THREE.Mesh;
  naclWireCurve: THREE.CatmullRomCurve3;
  naclWireGlowMesh: THREE.Mesh;
  naclElectrons: THREE.Mesh[];
  naclCl2Bubbles: THREE.Mesh[];
  naclH2Bubbles: THREE.Mesh[];
  naclNaDrops: THREE.Mesh[];
  naclNaIons: THREE.Mesh[];
  // Cleanup registry
  disposables: Array<{ dispose: () => void }>;
}

// Reusable scratch objects (zero per-frame heap allocations)
const _tmpVec3 = new THREE.Vector3();
const _tmpVec3B = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _tmpColor = new THREE.Color();
const _tmpDummy = new THREE.Object3D();
const _colorBlueRich = new THREE.Color('#0E7AE8');
const _colorBlueClear = new THREE.Color('#B5D6DE');
const _colorMint = new THREE.Color('#78D4C4');
const _colorCopper = new THREE.Color('#E3A678');
const _colorDimBorder = new THREE.Color('#2A4147');
const _colorDimParticle = new THREE.Color('#394D54');
const MICRO_MAX_PARTICLES = 64;
const MICRO_MAX_LATTICE = 36;

function seededFrac(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Creates a rounded-rectangle ExtrudeGeometry centered in X/Z with normalized planar UVs
 * so wood/metal textures wrap cleanly across beveled tabletops and instrument housings.
 */
function createRoundedSlabGeometry(
  width: number,
  depth: number,
  thickness: number,
  cornerRadius: number,
  bevelSize = 0.014,
  bevelThickness = 0.015
): THREE.ExtrudeGeometry {
  const hw = width / 2 - bevelSize;
  const hd = depth / 2 - bevelSize;
  const r = Math.min(cornerRadius, hw * 0.45, hd * 0.45);
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

  const extrudeDepth = Math.max(0.01, thickness - bevelThickness * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeDepth,
    bevelEnabled: true,
    bevelThickness,
    bevelSize,
    bevelSegments: 3,
    curveSegments: 8,
  });

  // Rotate from XY extrusion to horizontal XZ slab centered at y = 0
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -extrudeDepth / 2, 0);

  // Normalize UVs cleanly across X and Z so walnut grain renders at true architectural scale
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  if (pos && uv) {
    for (let i = 0; i < pos.count; i += 1) {
      const px = pos.getX(i);
      const pz = pos.getZ(i);
      uv.setXY(i, (px / width) + 0.5, (pz / depth) + 0.5);
    }
    uv.needsUpdate = true;
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a rounded-bevel vertical chassis (for voltmeter & DC power supplies).
 */
function createRoundedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  radius: number,
  bevel = 0.012
): THREE.ExtrudeGeometry {
  const hw = width / 2 - bevel;
  const hh = height / 2 - bevel;
  const r = Math.min(radius, hw * 0.4, hh * 0.4);
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const extrudeDepth = Math.max(0.01, depth - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeDepth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.translate(0, 0, -extrudeDepth / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Custom feathered volumetric sunlight shaft material (soft UV + angle fade, AdditiveBlending).
 */
function createSunShaftMaterial(baseOpacity: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color('#FFD996') },
      uOpacity: { value: baseOpacity },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        // Horizontal feathered beam edges
        float edgeX = smoothstep(0.0, 0.24, vUv.x) * smoothstep(1.0, 0.76, vUv.x);
        // Brightest near window (vUv.y = 1.0), softly dissipating into room air (vUv.y = 0.0)
        float fadeY = smoothstep(0.0, 0.45, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
        float streak = 0.78 + 0.22 * sin(vUv.x * 18.8495);
        float alpha = edgeX * fadeY * streak * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
}

function createSoftDotSpriteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255, 244, 212, 1)');
  grad.addColorStop(0.4, 'rgba(255, 224, 158, 0.55)');
  grad.addColorStop(1, 'rgba(255, 210, 130, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Multi-leaf curved botanical potted plant (replaces primitive low-poly dodecahedron blobs).
 */
function createLushPottedPlant(
  scale: number,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const g = new THREE.Group();

  // Tapered matte ceramic planter + soil disc
  const potProfile = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.115, 0),
    new THREE.Vector2(0.135, 0.04),
    new THREE.Vector2(0.165, 0.26),
    new THREE.Vector2(0.172, 0.28),
    new THREE.Vector2(0.152, 0.28),
    new THREE.Vector2(0.145, 0.23),
  ];
  const potGeo = new THREE.LatheGeometry(potProfile, 20);
  const potMat = new THREE.MeshStandardMaterial({
    color: 0xd6cfc2,
    roughness: 0.72,
    metalness: 0.04,
  });
  const pot = new THREE.Mesh(potGeo, potMat);
  pot.castShadow = true;
  pot.receiveShadow = true;
  g.add(pot);

  const soilGeo = new THREE.CylinderGeometry(0.145, 0.145, 0.03, 16);
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x30231b, roughness: 0.95 });
  const soil = new THREE.Mesh(soilGeo, soilMat);
  soil.position.y = 0.235;
  g.add(soil);

  // Sculpted organic curved leaf blade via ShapeGeometry with bent vertices
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.075, 0.08, 0.052, 0.22);
  leafShape.quadraticCurveTo(0.015, 0.3, 0, 0.34);
  leafShape.quadraticCurveTo(-0.015, 0.3, -0.052, 0.22);
  leafShape.quadraticCurveTo(-0.075, 0.08, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 6);
  const pos = leafGeo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const py = pos.getY(i);
    const px = pos.getX(i);
    // Natural outward arch + slight V-fold down central midrib
    const archZ = Math.sin((py / 0.34) * Math.PI) * 0.055 - (py * py) * 0.65;
    const midFold = Math.abs(px) * 0.16;
    pos.setZ(i, archZ + midFold);
  }
  leafGeo.computeVertexNormals();

  const leafDarkMat = new THREE.MeshStandardMaterial({
    color: 0x2f6435,
    roughness: 0.42,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const leafBrightMat = new THREE.MeshStandardMaterial({
    color: 0x4c8d45,
    roughness: 0.38,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const stemGeo = new THREE.CylinderGeometry(0.006, 0.008, 0.15, 6);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x2c5630, roughness: 0.65 });

  // Two concentric rings of arching foliage (14 lush blades)
  for (let i = 0; i < 14; i += 1) {
    const outer = i < 9;
    const ang = (i / (outer ? 9 : 5)) * Math.PI * 2 + (outer ? 0 : 0.38);
    const branch = new THREE.Group();
    branch.position.set(Math.cos(ang) * (outer ? 0.035 : 0.012), 0.24, Math.sin(ang) * (outer ? 0.035 : 0.012));
    branch.rotation.y = -ang + Math.PI / 2;
    branch.rotation.x = outer ? 0.56 + (i % 3) * 0.12 : 0.24 + (i % 2) * 0.1;

    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.06;
    branch.add(stem);

    const blade = new THREE.Mesh(leafGeo, i % 2 === 0 ? leafBrightMat : leafDarkMat);
    blade.position.y = 0.11;
    const ls = outer ? 0.9 + (i % 3) * 0.14 : 0.72 + (i % 2) * 0.12;
    blade.scale.set(ls, ls, ls);
    branch.add(blade);
    g.add(branch);
  }

  g.scale.setScalar(scale);
  disposables.push(potGeo, potMat, soilGeo, soilMat, leafGeo, leafDarkMat, leafBrightMat, stemGeo, stemMat);
  return g;
}

function addHighlightBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  disposables: Array<{ dispose: () => void }>
): THREE.MeshBasicMaterial {
  const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
  const mat = new THREE.MeshBasicMaterial({
    color: 0x78d4c4,
    transparent: true,
    opacity: 0,
    depthTest: true,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.position.set(x, y, z);
  lines.renderOrder = 15;
  parent.add(lines);
  disposables.push(geo, mat);
  return mat;
}

/**
 * Sculpted LatheGeometry borosilicate laboratory beaker with rounded base fillet,
 * flared pouring rim, depth-graded solution, meniscus highlight, and volumetric graduations.
 */
function createGlassBeakerGroup(
  radius: number,
  height: number,
  liquidColorHex: number,
  liquidOpacity: number,
  gradTex: THREE.CanvasTexture,
  isSoftwareGl: boolean,
  cutawayClipPlane: THREE.Plane,
  glassMaterials: THREE.MeshPhysicalMaterial[],
  disposables: Array<{ dispose: () => void }>
): {
  group: THREE.Group;
  liquidMat: THREE.MeshPhysicalMaterial;
} {
  const group = new THREE.Group();

  // Inner liquid volume with rounded bottom fillet
  const liqHeight = height * 0.72;
  const liqR = radius * 0.915;
  const liqProfile = [
    new THREE.Vector2(0.001, 0.014),
    new THREE.Vector2(liqR * 0.86, 0.014),
    new THREE.Vector2(liqR, 0.036),
    new THREE.Vector2(liqR, liqHeight + 0.014),
    new THREE.Vector2(0.001, liqHeight + 0.014),
  ];
  const liqGeo = new THREE.LatheGeometry(liqProfile, 32);
  const isBlueLiq = ((liquidColorHex >> 0) & 0xff) > 150 && ((liquidColorHex >> 16) & 0xff) < 90;
  const liquidMat = new THREE.MeshPhysicalMaterial({
    color: liquidColorHex,
    emissive: isBlueLiq ? 0x043d8a : 0x000000,
    emissiveIntensity: isBlueLiq ? 0.14 : 0,
    roughness: 0.08,
    metalness: 0.02,
    clearcoat: 0.55,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: isBlueLiq ? Math.min(0.42, liquidOpacity) : liquidOpacity,
    depthWrite: false,
    clippingPlanes: [cutawayClipPlane],
  });
  const liqMesh = new THREE.Mesh(liqGeo, liquidMat);
  liqMesh.renderOrder = 2;
  group.add(liqMesh);

  // Subtle deep-sapphire refracted base ring inside blue solutions (NormalBlending avoids white overexposure)
  if (isBlueLiq) {
    const causticGeo = new THREE.RingGeometry(liqR * 0.46, liqR * 0.94, 32);
    const causticMat = new THREE.MeshBasicMaterial({
      color: 0x0876f0,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const caustic = new THREE.Mesh(causticGeo, causticMat);
    caustic.rotation.x = -Math.PI / 2;
    caustic.position.y = 0.018;
    caustic.renderOrder = 3;
    group.add(caustic);
    disposables.push(causticGeo, causticMat);
  }

  // Crisp top meniscus highlight ring
  const menGeo = new THREE.RingGeometry(liqR * 0.78, liqR * 1.0, 32);
  const menMat = new THREE.MeshBasicMaterial({
    color: 0xe6f9ff,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide,
    depthWrite: false,
    clippingPlanes: [cutawayClipPlane],
  });
  const menMesh = new THREE.Mesh(menGeo, menMat);
  menMesh.rotation.x = -Math.PI / 2;
  menMesh.position.y = liqHeight + 0.016;
  menMesh.renderOrder = 3;
  group.add(menMesh);

  // Sculpted LatheGeometry borosilicate outer wall (pure alpha physical glass so GPU transmission pass never occludes inner liquid/electrodes)
  const glassProfile = [
    new THREE.Vector2(radius * 0.86, 0.0),
    new THREE.Vector2(radius * 0.97, 0.016),
    new THREE.Vector2(radius * 0.99, 0.045),
    new THREE.Vector2(radius, height * 0.93),
    new THREE.Vector2(radius * 1.045, height * 0.985),
    new THREE.Vector2(radius * 1.055, height),
    new THREE.Vector2(radius * 1.02, height + 0.006),
    new THREE.Vector2(radius * 0.97, height * 0.97),
  ];
  const glassGeo = new THREE.LatheGeometry(glassProfile, 36);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd4eef5,
    roughness: 0.06,
    metalness: 0.02,
    ior: 1.48,
    transmission: 0,
    transparent: true,
    opacity: 0.16,
    clearcoat: isSoftwareGl ? 0.72 : 0.95,
    clearcoatRoughness: 0.06,
    reflectivity: isSoftwareGl ? 0.65 : 0.85,
    side: THREE.FrontSide,
    depthWrite: false,
    clippingPlanes: [cutawayClipPlane],
  });
  glassMaterials.push(glassMat);
  const glassWall = new THREE.Mesh(glassGeo, glassMat);
  glassWall.renderOrder = 5;
  group.add(glassWall);

  // Clean flat glass bottom disc (zero radial triangle artifact)
  const baseDiscGeo = new THREE.CircleGeometry(radius * 0.87, 28);
  const baseDisc = new THREE.Mesh(baseDiscGeo, glassMat);
  baseDisc.rotation.x = -Math.PI / 2;
  baseDisc.position.y = 0.004;
  baseDisc.renderOrder = 4;
  group.add(baseDisc);
  disposables.push(baseDiscGeo);

  // Subtle glass rim specular accent torus
  const rimGeo = new THREE.TorusGeometry(radius * 1.038, 0.007, 10, 36);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xf4fcfe,
    roughness: 0.08,
    metalness: 0.16,
    transparent: true,
    opacity: 0.75,
    clippingPlanes: [cutawayClipPlane],
  });
  const rimMesh = new THREE.Mesh(rimGeo, rimMat);
  rimMesh.rotation.x = Math.PI / 2;
  rimMesh.position.y = height;
  rimMesh.renderOrder = 6;
  group.add(rimMesh);

  // Crisp volumetric graduation cylinder
  const gradGeo = new THREE.CylinderGeometry(radius * 1.008, radius * 0.996, height * 0.76, 32, 1, true);
  const gradMat = new THREE.MeshBasicMaterial({
    map: gradTex,
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
    clippingPlanes: [cutawayClipPlane],
  });
  const gradMesh = new THREE.Mesh(gradGeo, gradMat);
  gradMesh.position.y = height * 0.48;
  gradMesh.rotation.y = -Math.PI / 2;
  gradMesh.renderOrder = 7;
  group.add(gradMesh);

  disposables.push(liqGeo, liquidMat, menGeo, menMat, glassGeo, glassMat, rimGeo, rimMat, gradGeo, gradMat);
  return { group, liquidMat };
}

/**
 * Multi-part 3D insulated electrode alligator / thumbscrew clamp (replaces plain cube).
 */
function createElectrodeClampGroup(
  insulatorMat: THREE.Material,
  brassMat: THREE.Material,
  chromeMat: THREE.Material,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const g = new THREE.Group();

  const bodyGeo = createRoundedBoxGeometry(0.072, 0.068, 0.064, 0.01, 0.006);
  const body = new THREE.Mesh(bodyGeo, insulatorMat);
  g.add(body);

  // Brass jaw teeth gripping the electrode plate
  const jawGeo = new THREE.BoxGeometry(0.042, 0.045, 0.048);
  const jaw = new THREE.Mesh(jawGeo, brassMat);
  jaw.position.y = -0.042;
  g.add(jaw);

  // Knurled side thumbscrew knob
  const screwStemGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.055, 10);
  const screwStem = new THREE.Mesh(screwStemGeo, chromeMat);
  screwStem.rotation.z = Math.PI / 2;
  screwStem.position.set(0.052, 0, 0);
  g.add(screwStem);

  const screwKnobGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.018, 16);
  const screwKnob = new THREE.Mesh(screwKnobGeo, chromeMat);
  screwKnob.rotation.z = Math.PI / 2;
  screwKnob.position.set(0.08, 0, 0);
  g.add(screwKnob);

  // Top cable strain-relief boot
  const bootGeo = new THREE.CylinderGeometry(0.016, 0.022, 0.042, 12);
  const boot = new THREE.Mesh(bootGeo, insulatorMat);
  boot.position.y = 0.05;
  g.add(boot);

  disposables.push(bodyGeo, jawGeo, screwStemGeo, screwKnobGeo, bootGeo);
  return g;
}

/**
 * Chamfered multi-part laboratory DC Power Supply matching the modern studio reference renders:
 * beveled chassis, brushed anodized trim, dual-readout OLED, knurled aluminum dial,
 * illuminated red I/O rocker switch, shrouded banana binding posts, and side cooling louvers.
 */
function createDCPowerSupplyGroup(
  display: LiveDisplayTexture,
  brushedMetal: { bumpMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture },
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const group = new THREE.Group();

  const bodyGeo = createRoundedBoxGeometry(0.58, 0.35, 0.4, 0.028, 0.012);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x374348,
    roughness: 0.42,
    metalness: 0.48,
    bumpMap: brushedMetal.bumpMap,
    bumpScale: 0.003,
    roughnessMap: brushedMetal.roughnessMap,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.185;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Anodized brushed aluminum front perimeter collar
  const trimGeo = createRoundedBoxGeometry(0.56, 0.33, 0.032, 0.022, 0.006);
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x8d9aa0,
    roughness: 0.28,
    metalness: 0.82,
    roughnessMap: brushedMetal.roughnessMap,
  });
  const trim = new THREE.Mesh(trimGeo, trimMat);
  trim.position.set(0, 0.185, 0.19);
  group.add(trim);

  // Dark matte front faceplate recessed inside aluminum collar
  const faceGeo = new THREE.BoxGeometry(0.52, 0.29, 0.018);
  const faceMat = new THREE.MeshStandardMaterial({
    color: 0x182328,
    roughness: 0.52,
    metalness: 0.24,
  });
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.position.set(0, 0.185, 0.201);
  group.add(face);

  // Subtle glowing teal bottom accent slit
  const accentSlitGeo = new THREE.BoxGeometry(0.46, 0.008, 0.006);
  const accentSlitMat = new THREE.MeshBasicMaterial({ color: 0x62e2cf });
  const accentSlit = new THREE.Mesh(accentSlitGeo, accentSlitMat);
  accentSlit.position.set(0, 0.048, 0.211);
  group.add(accentSlit);

  // Crisp OLED display screen
  const screenGeo = new THREE.PlaneGeometry(0.31, 0.135);
  const screenMat = new THREE.MeshBasicMaterial({ map: display.texture });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(-0.08, 0.245, 0.212);
  group.add(screen);

  // Machined aluminum knurled rotary control knob
  const knobGeo = new THREE.CylinderGeometry(0.046, 0.05, 0.04, 24);
  const knobMat = new THREE.MeshStandardMaterial({
    color: 0x9aa6ab,
    roughness: 0.25,
    metalness: 0.88,
    bumpMap: brushedMetal.bumpMap,
    bumpScale: 0.004,
  });
  const knob = new THREE.Mesh(knobGeo, knobMat);
  knob.rotation.x = Math.PI / 2;
  knob.position.set(0.155, 0.23, 0.22);
  group.add(knob);

  const knobRingGeo = new THREE.TorusGeometry(0.049, 0.005, 8, 24);
  const knobRingMat = new THREE.MeshStandardMaterial({
    color: 0xd48b52,
    roughness: 0.24,
    metalness: 0.88,
  });
  const knobRing = new THREE.Mesh(knobRingGeo, knobRingMat);
  knobRing.position.set(0.155, 0.23, 0.236);
  group.add(knobRing);

  // Illuminated red rocker power switch (matching reference CuSO4 power supply!)
  const rockerFrameGeo = new THREE.BoxGeometry(0.046, 0.072, 0.016);
  const rockerFrame = new THREE.Mesh(rockerFrameGeo, faceMat);
  rockerFrame.position.set(0.225, 0.11, 0.211);
  group.add(rockerFrame);

  const rockerBtnGeo = new THREE.BoxGeometry(0.032, 0.054, 0.02);
  const rockerBtnMat = new THREE.MeshStandardMaterial({
    color: 0xe64532,
    emissive: 0xd93621,
    emissiveIntensity: 0.9,
    roughness: 0.3,
  });
  const rockerBtn = new THREE.Mesh(rockerBtnGeo, rockerBtnMat);
  rockerBtn.position.set(0.225, 0.11, 0.216);
  rockerBtn.rotation.x = -0.14;
  group.add(rockerBtn);

  // Cooling vent louvers on left side of front panel
  const ventGeo = new THREE.BoxGeometry(0.08, 0.007, 0.008);
  const ventMat = new THREE.MeshStandardMaterial({ color: 0x0b1114, roughness: 0.9 });
  for (let i = 0; i < 4; i += 1) {
    const v = new THREE.Mesh(ventGeo, ventMat);
    v.position.set(-0.19, 0.085 + i * 0.017, 0.21);
    group.add(v);
  }

  // Shrouded Red (+) and Black (-) binding posts with brass core
  const postOuterGeo = new THREE.CylinderGeometry(0.024, 0.027, 0.046, 18);
  const postCoreGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.052, 12);
  const redMat = new THREE.MeshStandardMaterial({ color: 0xd94436, roughness: 0.32, metalness: 0.18 });
  const blkMat = new THREE.MeshStandardMaterial({ color: 0x151a1d, roughness: 0.38, metalness: 0.24 });
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xddb062, roughness: 0.22, metalness: 0.9 });

  for (const [px, mat] of [
    [-0.03, redMat],
    [0.085, blkMat],
  ] as const) {
    const post = new THREE.Mesh(postOuterGeo, mat);
    post.rotation.x = Math.PI / 2;
    post.position.set(px, 0.105, 0.222);
    group.add(post);
    const core = new THREE.Mesh(postCoreGeo, coreMat);
    core.rotation.x = Math.PI / 2;
    core.position.set(px, 0.105, 0.224);
    group.add(core);
  }

  // Vibration-damping rubber feet
  const footGeo = new THREE.CylinderGeometry(0.032, 0.035, 0.018, 14);
  const footMat = new THREE.MeshStandardMaterial({ color: 0x111618, roughness: 0.92 });
  for (const fx of [-0.23, 0.23]) {
    for (const fz of [-0.14, 0.14]) {
      const f = new THREE.Mesh(footGeo, footMat);
      f.position.set(fx, 0.009, fz);
      group.add(f);
    }
  }

  disposables.push(
    bodyGeo, bodyMat, trimGeo, trimMat, faceGeo, faceMat, accentSlitGeo, accentSlitMat,
    screenGeo, screenMat, knobGeo, knobMat, knobRingGeo, knobRingMat, rockerFrameGeo,
    rockerBtnGeo, rockerBtnMat, ventGeo, ventMat, postOuterGeo, postCoreGeo, redMat,
    blkMat, coreMat, footGeo, footMat
  );

  return group;
}

/**
 * Shared architectural 2x2 laboratory bench builder used identically across ALL 4 stations
 * (01 Zn-Cu, 02 CuSO4, 03 NaCl, 04 Practice Desk) so every desk has identical craft, height,
 * beveled walnut slab, corner hex bolts, lower walnut shelf, front modesty panel, and recessed teal LED.
 */
function buildArchitecturalLabBench(args: {
  parent: THREE.Group;
  plaqueText: string;
  warmGoldPlaque?: boolean;
  walnutMat: THREE.MeshStandardMaterial;
  steelFrameMat: THREE.MeshStandardMaterial;
  chromeMat: THREE.MeshStandardMaterial;
  contactShadowMat: THREE.MeshBasicMaterial;
  maxAniso: number;
  occlusionMeshes: THREE.Object3D[];
  disposables: Array<{ dispose: () => void }>;
  sharedGeos: {
    benchTopGeo: THREE.BufferGeometry;
    legGeo: THREE.BufferGeometry;
    footPadGeo: THREE.BufferGeometry;
    apronLongGeo: THREE.BufferGeometry;
    apronShortGeo: THREE.BufferGeometry;
    hexBoltGeo: THREE.BufferGeometry;
    lowerShelfGeo: THREE.BufferGeometry;
    modestyGeo: THREE.BufferGeometry;
    rimLongGeo: THREE.BufferGeometry;
    rimShortGeo: THREE.BufferGeometry;
    ledStripGeo: THREE.BufferGeometry;
    plaqueBackingGeo: THREE.BufferGeometry;
    plaqueFaceGeo: THREE.BufferGeometry;
    shadowPlaneGeo: THREE.BufferGeometry;
  };
}): {
  rimMat: THREE.MeshStandardMaterial;
  ledMat: THREE.MeshStandardMaterial;
} {
  const {
    parent,
    plaqueText,
    warmGoldPlaque = false,
    walnutMat,
    steelFrameMat,
    chromeMat,
    contactShadowMat,
    maxAniso,
    occlusionMeshes,
    disposables,
    sharedGeos,
  } = args;

  const halfW = LAB_BENCH_DIMENSIONS.width / 2; // 1.26
  const halfD = LAB_BENCH_DIMENSIONS.depth / 2; // 0.78

  // Soft floor contact shadow
  const cShadow = new THREE.Mesh(sharedGeos.shadowPlaneGeo, contactShadowMat);
  cShadow.rotation.x = -Math.PI / 2;
  cShadow.position.y = 0.011;
  parent.add(cShadow);

  // Beveled rounded-corner American walnut tabletop
  const topMesh = new THREE.Mesh(sharedGeos.benchTopGeo, walnutMat);
  topMesh.position.y = TABLE_TOP_Y - 0.042;
  topMesh.castShadow = true;
  topMesh.receiveShadow = true;
  parent.add(topMesh);
  occlusionMeshes.push(topMesh);

  // 4 architectural steel legs with stainless leveling feet + machined corner hex bolts
  const legX = halfW - 0.11;
  const legZ = halfD - 0.1;
  for (const lx of [-legX, legX]) {
    for (const lz of [-legZ, legZ]) {
      const leg = new THREE.Mesh(sharedGeos.legGeo, steelFrameMat);
      leg.position.set(lx, 0.43, lz);
      leg.castShadow = true;
      leg.receiveShadow = true;
      parent.add(leg);

      const foot = new THREE.Mesh(sharedGeos.footPadGeo, chromeMat);
      foot.position.set(lx, 0.016, lz);
      parent.add(foot);

      // Machined stainless hex-bolt fasteners on front & outer faces of each leg corner
      const boltFront = new THREE.Mesh(sharedGeos.hexBoltGeo, chromeMat);
      boltFront.rotation.x = Math.PI / 2;
      boltFront.position.set(lx, TABLE_TOP_Y - 0.14, lz + (lz > 0 ? 0.044 : -0.044));
      parent.add(boltFront);

      const boltSide = new THREE.Mesh(sharedGeos.hexBoltGeo, chromeMat);
      boltSide.rotation.z = Math.PI / 2;
      boltSide.position.set(lx + (lx > 0 ? 0.044 : -0.044), TABLE_TOP_Y - 0.14, lz);
      parent.add(boltSide);
    }
  }

  // Structural steel apron rails directly beneath beveled tabletop
  for (const az of [-legZ, legZ]) {
    const rail = new THREE.Mesh(sharedGeos.apronLongGeo, steelFrameMat);
    rail.position.set(0, TABLE_TOP_Y - 0.135, az);
    parent.add(rail);
  }
  for (const ax of [-legX, legX]) {
    const rail = new THREE.Mesh(sharedGeos.apronShortGeo, steelFrameMat);
    rail.position.set(ax, TABLE_TOP_Y - 0.135, 0);
    parent.add(rail);
  }

  // Lower beveled walnut storage shelf + recessed dark rear modesty panel
  const lowerShelf = new THREE.Mesh(sharedGeos.lowerShelfGeo, walnutMat);
  lowerShelf.position.set(0, 0.24, 0);
  lowerShelf.receiveShadow = true;
  parent.add(lowerShelf);

  const modesty = new THREE.Mesh(sharedGeos.modestyGeo, steelFrameMat);
  modesty.position.set(0, 0.54, -legZ + 0.03);
  parent.add(modesty);

  // Highlightable perimeter architectural bevel rail
  const rimMat = new THREE.MeshStandardMaterial({
    color: warmGoldPlaque ? 0x5c4738 : 0x2a4147,
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 0.34,
    metalness: 0.52,
  });
  disposables.push(rimMat);

  const rimF = new THREE.Mesh(sharedGeos.rimLongGeo, rimMat);
  rimF.position.set(0, TABLE_TOP_Y - 0.086, halfD - 0.04);
  parent.add(rimF);
  const rimB = new THREE.Mesh(sharedGeos.rimLongGeo, rimMat);
  rimB.position.set(0, TABLE_TOP_Y - 0.086, -(halfD - 0.04));
  parent.add(rimB);
  const rimL = new THREE.Mesh(sharedGeos.rimShortGeo, rimMat);
  rimL.position.set(-(halfW - 0.04), TABLE_TOP_Y - 0.086, 0);
  parent.add(rimL);
  const rimR = new THREE.Mesh(sharedGeos.rimShortGeo, rimMat);
  rimR.position.set(halfW - 0.04, TABLE_TOP_Y - 0.086, 0);
  parent.add(rimR);

  // Recessed glowing architectural under-lip LED strip along front edge
  const ledMat = new THREE.MeshStandardMaterial({
    color: warmGoldPlaque ? 0xe5b27a : 0x62d9c6,
    emissive: warmGoldPlaque ? 0xd18a47 : 0x45bfa9,
    emissiveIntensity: 0.65,
    roughness: 0.25,
  });
  disposables.push(ledMat);
  const ledStrip = new THREE.Mesh(sharedGeos.ledStripGeo, ledMat);
  ledStrip.position.set(0, TABLE_TOP_Y - 0.095, halfD - 0.015);
  parent.add(ledStrip);

  // Front beveled illuminated brass/teal nameplate plaque
  const plaqueBacking = new THREE.Mesh(sharedGeos.plaqueBackingGeo, steelFrameMat);
  plaqueBacking.position.set(0, TABLE_TOP_Y - 0.19, halfD - 0.05);
  parent.add(plaqueBacking);

  const plaqueTex = createStationPlaqueTexture(plaqueText, maxAniso, warmGoldPlaque);
  const plaqueMat = new THREE.MeshBasicMaterial({ map: plaqueTex });
  const plaqueFace = new THREE.Mesh(sharedGeos.plaqueFaceGeo, plaqueMat);
  plaqueFace.position.set(0, TABLE_TOP_Y - 0.19, halfD - 0.032);
  parent.add(plaqueFace);
  disposables.push(plaqueTex, plaqueMat);

  return { rimMat, ledMat };
}

export function buildLabScene(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean
): LabSceneRig {
  const disposables: Array<{ dispose: () => void }> = [];
  const glassMaterials: THREE.MeshPhysicalMaterial[] = [];
  const sunShaftMaterials: THREE.ShaderMaterial[] = [];
  const sunPatchMaterials: THREE.MeshBasicMaterial[] = [];
  const maxAniso = isSoftwareGl ? 1 : Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1B2930');
  scene.fog = new THREE.Fog('#1B2930', 19, 38);

  // === V4 BALANCED NATURAL DAYLIGHT RIG (<= 1 shadow caster, warm right sun + cool sky fill, zero blowout) ===
  const hemiLight = new THREE.HemisphereLight(0xd9e8f0, 0x262019, 0.52);
  scene.add(hemiLight);

  // Primary Golden-Hour Sunlight streaming down-left through the giant right-wall windows
  const keyLight = new THREE.DirectionalLight(0xffddb0, 1.48);
  keyLight.position.set(8.6, 5.4, 2.1);
  keyLight.target.position.set(-0.6, 0.6, 0.4);
  scene.add(keyLight.target);
  if (!isSoftwareGl) {
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -8.2;
    keyLight.shadow.camera.right = 8.2;
    keyLight.shadow.camera.top = 6.2;
    keyLight.shadow.camera.bottom = -6.2;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 22;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.016;
  }
  scene.add(keyLight);

  // Crisp cool-sky counter fill from upper-left to define glass edges & brushed metal speculars
  const windowFill = new THREE.DirectionalLight(0xb2d4e6, 0.36);
  windowFill.position.set(-6.5, 6.2, 4.5);
  scene.add(windowFill);

  // Soft warm rim accent behind Smart Board & twin glass cabinets
  const rimLight = new THREE.PointLight(0x88dbd0, 0.42, 12, 1.6);
  rimLight.position.set(0, 3.1, -2.5);
  scene.add(rimLight);

  // Dedicated warm practical spun-brass architect desk lamp over Practice Desk 04 (toggleable!)
  const practiceLampLight = new THREE.PointLight(0xffcf88, 0.82, 3.8, 1.6);
  practiceLampLight.position.set(
    WORLD_ANCHORS.practiceDesk.x + 0.54,
    TABLE_TOP_Y + 0.62,
    WORLD_ANCHORS.practiceDesk.z - 0.14
  );
  scene.add(practiceLampLight);

  // Dynamic focus accent light used during Macro "Focus Reaction" mode
  const focusSpotLight = new THREE.PointLight(0xdaf5ef, 0, 4.4, 1.5);
  focusSpotLight.position.set(0, 2.5, 0.5);
  scene.add(focusSpotLight);

  // === SHARED HIGH-RES PROCEDURAL PBR TEXTURES ===
  const walnut = createWalnutWoodTextures(maxAniso);
  const floorPbr = createPolishedConcreteFloorTextures(maxAniso);
  const wallPbr = createMicroCementWallTextures(maxAniso);
  const brushedMetal = createBrushedMetalTextures(maxAniso);
  const windowBackdropTex = createSunlitWindowBackdropTexture(maxAniso);
  const sunPatchTex = createSunPatchCookieTexture();
  const wallClock = createWallClockTexture(maxAniso);
  const gradTex = createBeakerGraduationTexture(maxAniso);
  const shadowDiscTex = createContactShadowTexture();
  const dustSpriteTex = createSoftDotSpriteTexture();

  disposables.push(
    walnut.map, walnut.bumpMap, walnut.roughnessMap,
    floorPbr.map, floorPbr.bumpMap, floorPbr.roughnessMap,
    wallPbr.map, wallPbr.bumpMap, wallPbr.roughnessMap,
    brushedMetal.bumpMap, brushedMetal.roughnessMap,
    windowBackdropTex, sunPatchTex, wallClock.texture, gradTex, shadowDiscTex, dustSpriteTex
  );

  // === SHARED PBR MATERIALS ===
  const walnutMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: walnut.map,
    bumpMap: walnut.bumpMap,
    bumpScale: 0.011,
    roughnessMap: walnut.roughnessMap,
    roughness: 0.44,
    metalness: 0.05,
  });
  const microWallMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: wallPbr.map,
    bumpMap: wallPbr.bumpMap,
    bumpScale: 0.016,
    roughnessMap: wallPbr.roughnessMap,
    roughness: 0.84,
    metalness: 0.04,
  });
  const tealCabinetMat = new THREE.MeshStandardMaterial({
    color: 0x24464e,
    roughness: 0.48,
    metalness: 0.14,
  });
  const steelFrameMat = new THREE.MeshStandardMaterial({
    color: 0x1e262b,
    roughness: 0.36,
    metalness: 0.78,
    bumpMap: brushedMetal.bumpMap,
    bumpScale: 0.002,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xd9e1e6,
    roughness: 0.18,
    metalness: 0.94,
    roughnessMap: brushedMetal.roughnessMap,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd9a756,
    roughness: 0.22,
    metalness: 0.9,
    bumpMap: brushedMetal.bumpMap,
    bumpScale: 0.003,
    roughnessMap: brushedMetal.roughnessMap,
  });
  const zincMat = new THREE.MeshStandardMaterial({
    color: 0xc2cdd3,
    roughness: 0.32,
    metalness: 0.88,
    bumpMap: brushedMetal.bumpMap,
    bumpScale: 0.006,
    roughnessMap: brushedMetal.roughnessMap,
  });
  const copperMat = new THREE.MeshStandardMaterial({
    color: 0xd96e3a,
    roughness: 0.28,
    metalness: 0.68,
    envMapIntensity: 1.25,
    bumpMap: brushedMetal.bumpMap,
    bumpScale: 0.006,
    roughnessMap: brushedMetal.roughnessMap,
  });
  const graphiteMat = new THREE.MeshStandardMaterial({
    color: 0x2c3236,
    roughness: 0.64,
    metalness: 0.28,
    bumpMap: brushedMetal.bumpMap,
    bumpScale: 0.005,
  });
  const mintAccentMat = new THREE.MeshStandardMaterial({
    color: 0x62b8a8,
    roughness: 0.42,
    metalness: 0.16,
  });
  const trayMat = new THREE.MeshStandardMaterial({
    color: 0x1c272b,
    roughness: 0.46,
    metalness: 0.3,
  });
  const redWireMat = new THREE.MeshStandardMaterial({
    color: 0xd0483a,
    roughness: 0.38,
    metalness: 0.08,
  });
  const blackWireMat = new THREE.MeshStandardMaterial({
    color: 0x1a2024,
    roughness: 0.44,
    metalness: 0.1,
  });
  const electronMat = new THREE.MeshStandardMaterial({
    color: 0x9ef5e8,
    emissive: 0x3ecfb8,
    emissiveIntensity: 0.85,
    roughness: 0.2,
    metalness: 0.1,
  });
  const kIonMat = new THREE.MeshStandardMaterial({
    color: 0x72ccbc,
    emissive: 0x2e9482,
    emissiveIntensity: 0.55,
    roughness: 0.24,
  });
  const no3IonMat = new THREE.MeshStandardMaterial({
    color: 0xe6a568,
    emissive: 0xa66238,
    emissiveIntensity: 0.55,
    roughness: 0.24,
  });
  const o2BubbleMat = new THREE.MeshStandardMaterial({
    color: 0xbbf4ef,
    emissive: 0x5abfb4,
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.84,
    roughness: 0.1,
  });
  const h2BubbleMat = new THREE.MeshStandardMaterial({
    color: 0xf7fbff,
    emissive: 0x99d9f2,
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.88,
    roughness: 0.08,
  });
  const cl2BubbleMat = new THREE.MeshStandardMaterial({
    color: 0xd6ea76,
    emissive: 0xa4bf41,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.86,
    roughness: 0.14,
  });
  const naMetalMat = new THREE.MeshStandardMaterial({
    color: 0xdde5ea,
    emissive: 0x4b5c66,
    emissiveIntensity: 0.35,
    roughness: 0.18,
    metalness: 0.94,
  });
  const contactShadowMat = new THREE.MeshBasicMaterial({
    map: shadowDiscTex,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });

  disposables.push(
    walnutMat, microWallMat, tealCabinetMat, steelFrameMat, chromeMat, brassMat,
    zincMat, copperMat, graphiteMat, mintAccentMat, trayMat, redWireMat, blackWireMat,
    electronMat, kIonMat, no3IonMat, o2BubbleMat, h2BubbleMat, cl2BubbleMat,
    naMetalMat, contactShadowMat
  );

  const occlusionMeshes: THREE.Object3D[] = [];
  const zoneHitboxes: SelectableHitTarget[] = [];
  const tableHitboxes: SelectableHitTarget[] = [];
  const objectHitboxes: SelectableHitTarget[] = [];
  const tableRimMaterials = {} as Record<LabExperimentId, THREE.MeshStandardMaterial>;
  const tableLedMaterials = {} as Record<LabExperimentId, THREE.MeshStandardMaterial>;
  const objectHighlightMaterials: Partial<Record<LabObjectId, THREE.MeshBasicMaterial>> = {};

  const cutawayClipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 100);

  // =========================================================================
  // 1. ARCHITECTURAL STUDIO ROOM + GIANT SUNLIT RIGHT-WALL WINDOWS
  // =========================================================================
  const roomGroup = new THREE.Group();
  scene.add(roomGroup);

  const ROOM_HALF_W = 6.25; // Left wall -6.25, Right sunlit window wall +6.25
  const BACK_Z = -3.95;

  // Polished Architectural Concrete Floor with full PBR maps
  const floorGeo = new THREE.PlaneGeometry(ROOM_HALF_W * 2 + 0.6, 14.4);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: floorPbr.map,
    bumpMap: floorPbr.bumpMap,
    bumpScale: 0.01,
    roughnessMap: floorPbr.roughnessMap,
    roughness: 0.54,
    metalness: 0.1,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0, 0, 2.8);
  floorMesh.receiveShadow = true;
  roomGroup.add(floorMesh);
  occlusionMeshes.push(floorMesh);
  disposables.push(floorGeo, floorMat);

  // Ceiling slab with exposed architectural dark steel beams
  const ceilingGeo = new THREE.PlaneGeometry(ROOM_HALF_W * 2 + 0.6, 14.4);
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x1a2429, roughness: 0.9 });
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 6.2, 2.8);
  roomGroup.add(ceiling);

  const beamGeo = new THREE.BoxGeometry(ROOM_HALF_W * 2, 0.24, 0.18);
  for (const bz of [-2.4, 0.55, 3.55]) {
    const beam = new THREE.Mesh(beamGeo, steelFrameMat);
    beam.position.set(0, 5.95, bz);
    roomGroup.add(beam);
  }
  disposables.push(ceilingGeo, ceilingMat, beamGeo);

  // Back wall & Left wall with micro-cement slate-teal PBR maps (height 9.2m covers mobile portrait cleanly)
  const backWallGeo = new THREE.BoxGeometry(ROOM_HALF_W * 2 + 0.5, 9.2, 0.24);
  const backWall = new THREE.Mesh(backWallGeo, microWallMat);
  backWall.position.set(0, 4.6, BACK_Z);
  backWall.receiveShadow = true;
  roomGroup.add(backWall);
  occlusionMeshes.push(backWall);

  const leftWallGeo = new THREE.BoxGeometry(0.24, 9.2, 14.4);
  const leftWall = new THREE.Mesh(leftWallGeo, microWallMat);
  leftWall.position.set(-ROOM_HALF_W, 4.6, 3.1);
  leftWall.receiveShadow = true;
  roomGroup.add(leftWall);

  // Subtle architectural baseboard trim along left & back walls
  const baseboardBackGeo = new THREE.BoxGeometry(ROOM_HALF_W * 2, 0.12, 0.04);
  const baseboardBack = new THREE.Mesh(baseboardBackGeo, steelFrameMat);
  baseboardBack.position.set(0, 0.06, BACK_Z + 0.14);
  roomGroup.add(baseboardBack);

  const baseboardLeftGeo = new THREE.BoxGeometry(0.04, 0.12, 14.0);
  const baseboardLeft = new THREE.Mesh(baseboardLeftGeo, steelFrameMat);
  baseboardLeft.position.set(-ROOM_HALF_W + 0.14, 0.06, 3.1);
  roomGroup.add(baseboardLeft);
  disposables.push(backWallGeo, leftWallGeo, baseboardBackGeo, baseboardLeftGeo);

  // === GIANT RIGHT-WALL ARCHITECTURAL WINDOW APERTURE (z = -2.45 .. +4.35, y = 0.88 .. 4.95) ===
  const winZMin = -2.45;
  const winZMax = 4.35;
  const winYMin = 0.88;
  const winYMax = 4.95;
  const winSpanZ = winZMax - winZMin; // 6.80m wide sunlit window bank!
  const winSpanY = winYMax - winYMin; // 4.07m tall
  const winCenterZ = (winZMin + winZMax) / 2; // +0.95
  const winCenterY = (winYMin + winYMax) / 2; // 2.915

  // Structural wall pieces framing the real recessed window opening
  const rwBottomGeo = new THREE.BoxGeometry(0.28, winYMin, 14.4);
  const rwBottom = new THREE.Mesh(rwBottomGeo, microWallMat);
  rwBottom.position.set(ROOM_HALF_W, winYMin / 2, 3.1);
  rwBottom.receiveShadow = true;
  roomGroup.add(rwBottom);

  const rwTopH = 9.2 - winYMax;
  const rwTopGeo = new THREE.BoxGeometry(0.28, rwTopH, 14.4);
  const rwTop = new THREE.Mesh(rwTopGeo, microWallMat);
  rwTop.position.set(ROOM_HALF_W, winYMax + rwTopH / 2, 3.1);
  roomGroup.add(rwTop);

  const rwRearLen = winZMin - BACK_Z + 0.12;
  const rwRearGeo = new THREE.BoxGeometry(0.28, winSpanY, rwRearLen);
  const rwRear = new THREE.Mesh(rwRearGeo, microWallMat);
  rwRear.position.set(ROOM_HALF_W, winCenterY, BACK_Z + rwRearLen / 2 - 0.06);
  roomGroup.add(rwRear);

  const rwFrontLen = 10.3 - winZMax;
  const rwFrontGeo = new THREE.BoxGeometry(0.28, winSpanY, rwFrontLen);
  const rwFront = new THREE.Mesh(rwFrontGeo, microWallMat);
  rwFront.position.set(ROOM_HALF_W, winCenterY, winZMax + rwFrontLen / 2);
  roomGroup.add(rwFront);

  // Deep architectural stone windowsill ledge
  const sillGeo = new THREE.BoxGeometry(0.46, 0.08, winSpanZ + 0.24);
  const sillMat = new THREE.MeshStandardMaterial({
    color: 0x7c8488,
    roughness: 0.62,
    metalness: 0.08,
    bumpMap: floorPbr.bumpMap,
    bumpScale: 0.008,
  });
  const sill = new THREE.Mesh(sillGeo, sillMat);
  sill.position.set(ROOM_HALF_W - 0.06, winYMin + 0.02, winCenterZ);
  sill.receiveShadow = true;
  roomGroup.add(sill);

  // Natural Golden-Hour Exterior Campus & Foliage Backdrop recessed behind the window glass
  const extGeo = new THREE.PlaneGeometry(winSpanZ + 1.8, winSpanY + 1.4);
  const extMat = new THREE.MeshBasicMaterial({ map: windowBackdropTex, color: 0xd8d2c6 });
  const extBackdrop = new THREE.Mesh(extGeo, extMat);
  extBackdrop.rotation.y = -Math.PI / 2;
  extBackdrop.position.set(ROOM_HALF_W + 0.72, winCenterY + 0.08, winCenterZ);
  roomGroup.add(extBackdrop);

  // Subtle sunlit reflective window glass pane
  const winPaneGeo = new THREE.PlaneGeometry(winSpanZ, winSpanY);
  const winPaneMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff4dc,
    roughness: 0.06,
    metalness: 0.08,
    transparent: true,
    opacity: 0.14,
    clearcoat: 1.0,
    depthWrite: false,
  });
  const winPane = new THREE.Mesh(winPaneGeo, winPaneMat);
  winPane.rotation.y = -Math.PI / 2;
  winPane.position.set(ROOM_HALF_W + 0.06, winCenterY, winCenterZ);
  roomGroup.add(winPane);

  // 3D Dark Anodized Steel Architectural Window Mullions (5 vertical x 4 horizontal)
  const mulVGeo = new THREE.BoxGeometry(0.11, winSpanY + 0.04, 0.075);
  for (let i = 0; i <= 4; i += 1) {
    const mz = winZMin + (i / 4) * winSpanZ;
    const bar = new THREE.Mesh(mulVGeo, steelFrameMat);
    bar.position.set(ROOM_HALF_W + 0.02, winCenterY, mz);
    roomGroup.add(bar);
  }
  const mulHGeo = new THREE.BoxGeometry(0.11, 0.075, winSpanZ + 0.04);
  for (const frac of [0, 0.34, 0.72, 1]) {
    const my = winYMin + frac * winSpanY;
    const bar = new THREE.Mesh(mulHGeo, steelFrameMat);
    bar.position.set(ROOM_HALF_W + 0.02, my, winCenterZ);
    roomGroup.add(bar);
  }

  // Subtle upper warm-wood architectural venetian louver slats (matching sunset lab reference)
  const slatGeo = new THREE.BoxGeometry(0.08, 0.02, winSpanZ - 0.16);
  for (let s = 0; s < 7; s += 1) {
    const slat = new THREE.Mesh(slatGeo, walnutMat);
    slat.position.set(ROOM_HALF_W - 0.04, winYMax - 0.14 - s * 0.13, winCenterZ);
    slat.rotation.z = 0.28;
    roomGroup.add(slat);
  }

  disposables.push(
    rwBottomGeo, rwTopGeo, rwRearGeo, rwFrontGeo, sillGeo, sillMat,
    extGeo, extMat, winPaneGeo, winPaneMat, mulVGeo, mulHGeo, slatGeo
  );

  // === VOLUMETRIC GOLDEN SUNLIGHT SHAFTS + PROJECTED WINDOW-GRID SUN PATCHES + DUST MOTES ===
  const shaftGeo = new THREE.PlaneGeometry(1.95, 7.8);
  const shaftSpecs = [
    { z: -1.15, opacity: 0.1, tiltX: -0.05 },
    { z: 0.35, opacity: 0.13, tiltX: 0.0 },
    { z: 1.85, opacity: 0.12, tiltX: 0.04 },
    { z: 3.15, opacity: 0.09, tiltX: 0.06 },
  ];
  for (const sp of shaftSpecs) {
    const mat = createSunShaftMaterial(sp.opacity);
    mat.userData.baseOpacity = sp.opacity;
    sunShaftMaterials.push(mat);
    const shaft = new THREE.Mesh(shaftGeo, mat);
    shaft.position.set(3.45, 2.38, sp.z);
    // Tilt down-left from window toward floor & desks
    shaft.rotation.set(sp.tiltX, 0.12, -0.82);
    shaft.renderOrder = 8;
    roomGroup.add(shaft);
    disposables.push(mat);
  }
  disposables.push(shaftGeo);

  // Projected warm golden window-mullion sun patches on the polished concrete floor (NormalBlending avoids white clipping)
  const floorSunGeo = new THREE.PlaneGeometry(6.0, 5.6);
  const floorSunMat = new THREE.MeshBasicMaterial({
    map: sunPatchTex,
    color: 0xffce82,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  floorSunMat.userData.baseOpacity = 0.22;
  sunPatchMaterials.push(floorSunMat);
  const floorSunPatch = new THREE.Mesh(floorSunGeo, floorSunMat);
  floorSunPatch.rotation.x = -Math.PI / 2;
  floorSunPatch.rotation.z = -0.14;
  floorSunPatch.position.set(2.45, 0.014, 1.35);
  floorSunPatch.renderOrder = 1;
  roomGroup.add(floorSunPatch);

  // Secondary softer golden floor bounce patch reaching into center aisle
  const floorSunGeo2 = new THREE.PlaneGeometry(4.6, 4.4);
  const floorSunMat2 = new THREE.MeshBasicMaterial({
    map: sunPatchTex,
    color: 0xffc674,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  floorSunMat2.userData.baseOpacity = 0.13;
  sunPatchMaterials.push(floorSunMat2);
  const floorSunPatch2 = new THREE.Mesh(floorSunGeo2, floorSunMat2);
  floorSunPatch2.rotation.x = -Math.PI / 2;
  floorSunPatch2.rotation.z = -0.14;
  floorSunPatch2.position.set(-0.25, 0.015, 2.35);
  floorSunPatch2.renderOrder = 1;
  roomGroup.add(floorSunPatch2);
  disposables.push(floorSunGeo, floorSunMat, floorSunGeo2, floorSunMat2);

  // 48 gently drifting golden sunlit dust motes suspended in the window light
  const dustCount = 48;
  const dustBasePositions = new Float32Array(dustCount * 3);
  const dustLivePositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i += 1) {
    const px = 0.4 + seededFrac(i * 7 + 1) * 5.4;
    const py = 0.95 + seededFrac(i * 11 + 3) * 3.4;
    const pz = -1.9 + seededFrac(i * 17 + 5) * 5.6;
    dustBasePositions[i * 3] = px;
    dustBasePositions[i * 3 + 1] = py;
    dustBasePositions[i * 3 + 2] = pz;
    dustLivePositions[i * 3] = px;
    dustLivePositions[i * 3 + 1] = py;
    dustLivePositions[i * 3 + 2] = pz;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustLivePositions, 3));
  const dustMat = new THREE.PointsMaterial({
    map: dustSpriteTex,
    color: 0xffdf9e,
    size: 0.075,
    transparent: true,
    opacity: 0.36,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sunDustPoints = new THREE.Points(dustGeo, dustMat);
  sunDustPoints.renderOrder = 9;
  roomGroup.add(sunDustPoints);
  disposables.push(dustGeo, dustMat);

  // === BACK WALL: LOWER TEAL LAB CABINETRY + WALNUT COUNTER + CENTERED SMART BOARD + TWIN BACKLIT GLASS CABINETS ===
  const backCounterBaseGeo = new THREE.BoxGeometry(ROOM_HALF_W * 2 - 0.4, 0.88, 0.72);
  const backCounterBase = new THREE.Mesh(backCounterBaseGeo, tealCabinetMat);
  backCounterBase.position.set(0, 0.44, BACK_Z + 0.48);
  backCounterBase.receiveShadow = true;
  roomGroup.add(backCounterBase);

  const backCounterTopGeo = createRoundedSlabGeometry(ROOM_HALF_W * 2 - 0.3, 0.8, 0.065, 0.03, 0.01, 0.01);
  const backCounterTop = new THREE.Mesh(backCounterTopGeo, walnutMat);
  backCounterTop.position.set(0, 0.91, BACK_Z + 0.5);
  backCounterTop.receiveShadow = true;
  roomGroup.add(backCounterTop);

  // Cabinet door seams & brushed chrome drawer pulls along back counter
  const drawerPullGeo = new THREE.BoxGeometry(0.18, 0.018, 0.025);
  const doorGapGeo = new THREE.BoxGeometry(0.012, 0.78, 0.012);
  for (let i = -5; i <= 5; i += 1) {
    const cx = i * 1.04;
    const pull = new THREE.Mesh(drawerPullGeo, chromeMat);
    pull.position.set(cx, 0.72, BACK_Z + 0.855);
    roomGroup.add(pull);
    if (i < 5) {
      const gap = new THREE.Mesh(doorGapGeo, steelFrameMat);
      gap.position.set(cx + 0.52, 0.44, BACK_Z + 0.845);
      roomGroup.add(gap);
    }
  }
  disposables.push(backCounterBaseGeo, backCounterTopGeo, drawerPullGeo, doorGapGeo);

  // === ZONE A: CENTERED 3D SMART TEACHING BOARD (x = 0, y = 2.66, z = -3.72) ===
  const boardGroup = new THREE.Group();
  boardGroup.position.set(
    WORLD_ANCHORS.boardCenter.x,
    WORLD_ANCHORS.boardCenter.y,
    WORLD_ANCHORS.boardCenter.z
  );
  scene.add(boardGroup);

  const boardFrameGeo = createRoundedBoxGeometry(3.86, 2.18, 0.11, 0.04, 0.014);
  const boardFrame = new THREE.Mesh(boardFrameGeo, steelFrameMat);
  boardFrame.castShadow = true;
  boardGroup.add(boardFrame);

  const boardBezelMat = new THREE.MeshStandardMaterial({
    color: 0x3b6068,
    emissive: 0x1a4448,
    emissiveIntensity: 0.45,
    roughness: 0.28,
    metalness: 0.55,
  });
  const boardBezelGeo = createRoundedBoxGeometry(3.96, 2.28, 0.06, 0.05, 0.01);
  const boardBezel = new THREE.Mesh(boardBezelGeo, boardBezelMat);
  boardBezel.position.z = -0.02;
  boardGroup.add(boardBezel);

  const smartBoardTex = createSmartBoardIdleTexture(maxAniso);
  const boardScreenGeo = new THREE.PlaneGeometry(3.64, 1.98);
  const boardScreenMat = new THREE.MeshBasicMaterial({ map: smartBoardTex });
  const boardScreen = new THREE.Mesh(boardScreenGeo, boardScreenMat);
  boardScreen.position.z = 0.064;
  boardGroup.add(boardScreen);

  // Stylus tray + 3 colored stylus pens
  const chalkTrayGeo = new THREE.BoxGeometry(2.0, 0.05, 0.16);
  const chalkTray = new THREE.Mesh(chalkTrayGeo, steelFrameMat);
  chalkTray.position.set(0, -1.14, 0.12);
  boardGroup.add(chalkTray);

  const stylusGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.21, 10);
  const stylusColors = [0x78d4c4, 0xd98a52, 0xedf4f1];
  for (let i = 0; i < 3; i += 1) {
    const sMat = new THREE.MeshStandardMaterial({ color: stylusColors[i], roughness: 0.3, metalness: 0.45 });
    const pen = new THREE.Mesh(stylusGeo, sMat);
    pen.rotation.z = Math.PI / 2;
    pen.position.set(-0.36 + i * 0.34, -1.1, 0.15);
    boardGroup.add(pen);
    disposables.push(sMat);
  }

  // Overhead sleek board light bar
  const boardLampGeo = new THREE.BoxGeometry(2.8, 0.048, 0.11);
  const boardLamp = new THREE.Mesh(boardLampGeo, steelFrameMat);
  boardLamp.position.set(0, 1.24, 0.22);
  boardGroup.add(boardLamp);
  const boardLampStripGeo = new THREE.PlaneGeometry(2.65, 0.055);
  const boardLampStripMat = new THREE.MeshBasicMaterial({ color: 0xb2dad4, side: THREE.DoubleSide });
  const boardLampStrip = new THREE.Mesh(boardLampStripGeo, boardLampStripMat);
  boardLampStrip.rotation.x = Math.PI / 2;
  boardLampStrip.position.set(0, 1.212, 0.22);
  boardGroup.add(boardLampStrip);

  // Generous clickable hitbox for Smart Board
  const boardHitGeo = new THREE.BoxGeometry(4.1, 2.48, 0.46);
  const boardHitMat = new THREE.MeshBasicMaterial({ visible: false });
  const boardHitMesh = new THREE.Mesh(boardHitGeo, boardHitMat);
  boardHitMesh.position.set(0, 0, 0.1);
  boardGroup.add(boardHitMesh);
  zoneHitboxes.push({ mesh: boardHitMesh, kind: 'zone', zoneId: 'BOARD' });

  disposables.push(
    boardFrameGeo, boardBezelGeo, boardBezelMat, smartBoardTex, boardScreenGeo, boardScreenMat,
    chalkTrayGeo, stylusGeo, boardLampGeo, boardLampStripGeo, boardLampStripMat, boardHitGeo, boardHitMat
  );

  // === TWIN SYMMETRIC BACKLIT GLASS REAGENT CABINETS FLANKING SMART BOARD (x = -4.05 & +4.05) ===
  // Hollow 5-panel enclosure so the glowing cyan-teal interior LEDs, shelves & amber/blue reagent bottles shine through!
  const cabBackGeo = new THREE.BoxGeometry(2.35, 2.38, 0.06);
  const cabSideGeo = new THREE.BoxGeometry(0.08, 2.38, 0.48);
  const cabTopBotGeo = new THREE.BoxGeometry(2.35, 0.08, 0.48);
  const cabInteriorGeo = new THREE.PlaneGeometry(2.18, 2.2);
  const cabInteriorMat = new THREE.MeshStandardMaterial({
    color: 0x183c44,
    emissive: 0x1a6872,
    emissiveIntensity: 0.42,
    roughness: 0.62,
  });
  const cabShelfGeo = new THREE.BoxGeometry(2.18, 0.036, 0.38);
  const cabStripGeo = new THREE.PlaneGeometry(2.12, 0.055);
  const cabStripMat = new THREE.MeshBasicMaterial({ color: 0x72c8be });
  const cabGlassGeo = new THREE.PlaneGeometry(2.18, 2.2);
  const cabGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xcce8ee,
    transparent: true,
    opacity: 0.12,
    roughness: 0.1,
    clearcoat: 0.6,
    depthWrite: false,
  });
  const cabMullionVGeo = new THREE.BoxGeometry(0.04, 2.24, 0.032);
  const cabMullionHGeo = new THREE.BoxGeometry(2.2, 0.036, 0.032);
  const bottleBodyGeo = new THREE.CylinderGeometry(0.072, 0.078, 0.24, 14);
  const bottleNeckGeo = new THREE.CylinderGeometry(0.03, 0.034, 0.09, 12);
  const amberBottleMat = new THREE.MeshStandardMaterial({
    color: 0xb66224,
    emissive: 0x5c2808,
    emissiveIntensity: 0.28,
    roughness: 0.18,
    metalness: 0.08,
    transparent: true,
    opacity: 0.92,
  });
  const blueReagentMat = new THREE.MeshStandardMaterial({
    color: 0x0e7ae6,
    emissive: 0x084694,
    emissiveIntensity: 0.38,
    roughness: 0.14,
    transparent: true,
    opacity: 0.9,
  });
  const clearReagentMat = new THREE.MeshStandardMaterial({
    color: 0xb8dce2,
    emissive: 0x1d4d56,
    emissiveIntensity: 0.16,
    roughness: 0.14,
    transparent: true,
    opacity: 0.68,
  });

  for (const cabX of [-4.05, 4.05]) {
    const cg = new THREE.Group();
    cg.position.set(cabX, 2.52, BACK_Z + 0.36);
    roomGroup.add(cg);

    const backPanel = new THREE.Mesh(cabBackGeo, steelFrameMat);
    backPanel.position.z = -0.21;
    cg.add(backPanel);
    const leftSide = new THREE.Mesh(cabSideGeo, steelFrameMat);
    leftSide.position.x = -1.135;
    cg.add(leftSide);
    const rightSide = new THREE.Mesh(cabSideGeo, steelFrameMat);
    rightSide.position.x = 1.135;
    cg.add(rightSide);
    const topCap = new THREE.Mesh(cabTopBotGeo, steelFrameMat);
    topCap.position.y = 1.15;
    cg.add(topCap);
    const botCap = new THREE.Mesh(cabTopBotGeo, steelFrameMat);
    botCap.position.y = -1.15;
    cg.add(botCap);

    const interior = new THREE.Mesh(cabInteriorGeo, cabInteriorMat);
    interior.position.z = -0.17;
    cg.add(interior);

    // Top & mid glowing cyan-teal interior LED strips (iconic feature of reference renders!)
    const strip = new THREE.Mesh(cabStripGeo, cabStripMat);
    strip.position.set(0, 1.07, 0.04);
    cg.add(strip);

    for (const sy of [-0.42, 0.24]) {
      const sh = new THREE.Mesh(cabShelfGeo, steelFrameMat);
      sh.position.set(0, sy, 0.02);
      cg.add(sh);

      const underStrip = new THREE.Mesh(cabStripGeo, cabStripMat);
      underStrip.position.set(0, sy - 0.026, 0.08);
      cg.add(underStrip);

      for (let b = 0; b < 5; b += 1) {
        const bx = -0.82 + b * 0.41;
        const mat = b % 3 === 0 ? amberBottleMat : b % 3 === 1 ? blueReagentMat : clearReagentMat;
        const bBody = new THREE.Mesh(bottleBodyGeo, mat);
        bBody.position.set(bx, sy + 0.14, 0.05);
        cg.add(bBody);
        const bNeck = new THREE.Mesh(bottleNeckGeo, mat);
        bNeck.position.set(bx, sy + 0.29, 0.05);
        cg.add(bNeck);
      }
    }

    const glassDoor = new THREE.Mesh(cabGlassGeo, cabGlassMat);
    glassDoor.position.z = 0.24;
    glassDoor.renderOrder = 4;
    cg.add(glassDoor);

    const doorDivV = new THREE.Mesh(cabMullionVGeo, steelFrameMat);
    doorDivV.position.z = 0.25;
    cg.add(doorDivV);
    const doorDivH = new THREE.Mesh(cabMullionHGeo, steelFrameMat);
    doorDivH.position.set(0, 0.02, 0.25);
    cg.add(doorDivH);
  }

  // Decorative Erlenmeyer flasks resting on the walnut back counter
  const flaskProfile = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.105, 0),
    new THREE.Vector2(0.115, 0.022),
    new THREE.Vector2(0.036, 0.19),
    new THREE.Vector2(0.036, 0.27),
    new THREE.Vector2(0.044, 0.28),
  ];
  const flaskGeo = new THREE.LatheGeometry(flaskProfile, 20);
  const flaskGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xdff6fa,
    roughness: 0.07,
    transparent: true,
    opacity: 0.36,
    clearcoat: 1.0,
    depthWrite: false,
  });
  const flaskLiqGeo = new THREE.ConeGeometry(0.092, 0.11, 18);
  for (const [fx, isBlue] of [
    [-2.5, true],
    [-2.18, false],
    [2.18, true],
    [2.52, true],
  ] as const) {
    const fl = new THREE.Mesh(flaskGeo, flaskGlassMat);
    fl.position.set(fx, 0.945, BACK_Z + 0.56);
    roomGroup.add(fl);
    const liq = new THREE.Mesh(flaskLiqGeo, isBlue ? blueReagentMat : amberBottleMat);
    liq.position.set(fx, 1.0, BACK_Z + 0.56);
    roomGroup.add(liq);
  }

  disposables.push(
    cabBackGeo, cabSideGeo, cabTopBotGeo, cabInteriorGeo, cabInteriorMat, cabShelfGeo, cabStripGeo, cabStripMat,
    cabGlassGeo, cabGlassMat, cabMullionVGeo, cabMullionHGeo, bottleBodyGeo, bottleNeckGeo,
    amberBottleMat, blueReagentMat, clearReagentMat, flaskGeo, flaskGlassMat, flaskLiqGeo
  );

  // === LEFT WALL: REDOX SERIES CHART, SAFETY PLAQUE & LIVE REAL-TIME LABORATORY WALL CLOCK ===
  const redoxChartTex = createRedoxWallChartTexture(maxAniso);
  const redoxChartGeo = new THREE.PlaneGeometry(2.1, 1.48);
  const redoxChartMat = new THREE.MeshBasicMaterial({ map: redoxChartTex });
  const redoxChartMesh = new THREE.Mesh(redoxChartGeo, redoxChartMat);
  redoxChartMesh.rotation.y = Math.PI / 2;
  redoxChartMesh.position.set(-ROOM_HALF_W + 0.15, 2.52, -0.55);
  roomGroup.add(redoxChartMesh);

  const safetyTex = createSafetyPlaqueTexture(maxAniso);
  const safetyGeo = new THREE.PlaneGeometry(1.18, 0.74);
  const safetyMat = new THREE.MeshBasicMaterial({ map: safetyTex });
  const safetyMesh = new THREE.Mesh(safetyGeo, safetyMat);
  safetyMesh.rotation.y = Math.PI / 2;
  safetyMesh.position.set(-ROOM_HALF_W + 0.15, 1.98, 2.05);
  roomGroup.add(safetyMesh);

  // Real-time Wall Clock (mounted prominently on left wall, showing actual system time)
  const clockCaseGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.055, 28);
  const clockCase = new THREE.Mesh(clockCaseGeo, steelFrameMat);
  clockCase.rotation.z = Math.PI / 2;
  clockCase.position.set(-ROOM_HALF_W + 0.16, 3.35, 2.05);
  roomGroup.add(clockCase);

  const clockFaceGeo = new THREE.CircleGeometry(0.3, 28);
  const clockFaceMat = new THREE.MeshBasicMaterial({ map: wallClock.texture });
  const clockFace = new THREE.Mesh(clockFaceGeo, clockFaceMat);
  clockFace.rotation.y = Math.PI / 2;
  clockFace.position.set(-ROOM_HALF_W + 0.192, 3.35, 2.05);
  roomGroup.add(clockFace);

  disposables.push(
    redoxChartTex, redoxChartGeo, redoxChartMat, safetyTex, safetyGeo, safetyMat,
    clockCaseGeo, clockFaceGeo, clockFaceMat
  );

  // === TWIN SUSPENDED ARCHITECTURAL LINEAR PENDANT LIGHTS OVER THE 2 BENCH ROWS ===
  const pendantBodyGeo = new THREE.BoxGeometry(6.2, 0.09, 0.16);
  const pendantLightGeo = new THREE.PlaneGeometry(6.0, 0.11);
  const pendantLightMat = new THREE.MeshBasicMaterial({ color: 0xd8d2c4, side: THREE.DoubleSide });
  const cableGeo = new THREE.CylinderGeometry(0.009, 0.009, 1.5, 8);
  for (const pz of [-1.05, 2.15]) {
    const pBody = new THREE.Mesh(pendantBodyGeo, steelFrameMat);
    pBody.position.set(0, 4.72, pz);
    roomGroup.add(pBody);

    const pLight = new THREE.Mesh(pendantLightGeo, pendantLightMat);
    pLight.rotation.x = Math.PI / 2;
    pLight.position.set(0, 4.67, pz);
    roomGroup.add(pLight);

    for (const cx of [-2.35, 2.35]) {
      const cable = new THREE.Mesh(cableGeo, steelFrameMat);
      cable.position.set(cx, 5.45, pz);
      roomGroup.add(cable);
    }
  }
  disposables.push(pendantBodyGeo, pendantLightGeo, pendantLightMat, cableGeo);

  // === LUSH MULTI-LEAF BOTANICAL POTTED PLANTS (WINDOWSILL, BACK COUNTER & CORNERS) ===
  const plantPlacements: Array<[number, number, number, number]> = [
    [ROOM_HALF_W - 0.12, winYMin + 0.06, -0.55, 1.32], // Right sunlit windowsill rear
    [ROOM_HALF_W - 0.12, winYMin + 0.06, 2.55, 1.42],  // Right sunlit windowsill front
    [-5.45, 0, 3.95, 1.65],                            // Left front corner floor planter
    [5.45, 0, 4.45, 1.58],                             // Right front corner floor planter
    [-2.78, 0.945, BACK_Z + 0.56, 1.04],               // Back counter left
    [2.82, 0.945, BACK_Z + 0.56, 1.04],                // Back counter right
  ];
  for (const [px, py, pz, sc] of plantPlacements) {
    const plant = createLushPottedPlant(sc, disposables);
    plant.position.set(px, py, pz);
    roomGroup.add(plant);
  }

  // =========================================================================
  // 2. SHARED ARCHITECTURAL BENCH GEOMETRY FOR ALL 4 SYMMETRIC 2x2 DESKS
  // =========================================================================
  const BW = LAB_BENCH_DIMENSIONS.width; // 2.52
  const BD = LAB_BENCH_DIMENSIONS.depth; // 1.56
  const sharedBenchGeos = {
    benchTopGeo: createRoundedSlabGeometry(BW, BD, 0.084, 0.065, 0.015, 0.015),
    legGeo: new THREE.BoxGeometry(0.08, 0.86, 0.08),
    footPadGeo: new THREE.CylinderGeometry(0.048, 0.052, 0.032, 16),
    apronLongGeo: new THREE.BoxGeometry(BW - 0.24, 0.1, 0.045),
    apronShortGeo: new THREE.BoxGeometry(0.045, 0.1, BD - 0.22),
    hexBoltGeo: new THREE.CylinderGeometry(0.014, 0.014, 0.014, 6),
    lowerShelfGeo: createRoundedSlabGeometry(BW - 0.26, BD - 0.24, 0.042, 0.035, 0.008, 0.008),
    modestyGeo: new THREE.BoxGeometry(BW - 0.28, 0.56, 0.025),
    rimLongGeo: new THREE.BoxGeometry(BW - 0.08, 0.02, 0.02),
    rimShortGeo: new THREE.BoxGeometry(0.02, 0.02, BD - 0.08),
    ledStripGeo: new THREE.BoxGeometry(BW - 0.36, 0.012, 0.012),
    plaqueBackingGeo: createRoundedBoxGeometry(0.96, 0.24, 0.032, 0.025, 0.006),
    plaqueFaceGeo: new THREE.PlaneGeometry(0.92, 0.21),
    shadowPlaneGeo: new THREE.PlaneGeometry(BW + 0.55, BD + 0.48),
  };
  disposables.push(...Object.values(sharedBenchGeos));

  const tableHitGeo = new THREE.BoxGeometry(BW + 0.18, 1.55, BD + 0.18);
  const tableHitMat = new THREE.MeshBasicMaterial({ visible: false });
  const binGeo = createRoundedBoxGeometry(0.52, 0.22, 0.38, 0.025, 0.008);
  disposables.push(tableHitGeo, tableHitMat, binGeo);

  // Subtle golden sun-glint patch helper for the two right-column sunlit desks (NormalBlending keeps walnut grain rich)
  const deskSunGeo = new THREE.PlaneGeometry(2.15, 1.32);
  const deskSunMat = new THREE.MeshBasicMaterial({
    map: sunPatchTex,
    color: 0xffce82,
    transparent: true,
    opacity: 0.17,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  deskSunMat.userData.baseOpacity = 0.17;
  sunPatchMaterials.push(deskSunMat);
  disposables.push(deskSunGeo, deskSunMat);

  // === BUILD THE 3 EXPERIMENT BENCHES ON THE 2x2 GRID ===
  const stationIds: LabExperimentId[] = ['pin-zn-cu', 'dien-phan-cuso4', 'dien-phan-nacl'];
  for (const stId of stationIds) {
    const meta = LAB_TABLES[stId];
    const base = TABLE_POSITIONS[stId];
    const tGroup = new THREE.Group();
    tGroup.position.set(base.x, base.y, base.z);
    scene.add(tGroup);

    const { rimMat, ledMat } = buildArchitecturalLabBench({
      parent: tGroup,
      plaqueText: meta.shortCode,
      warmGoldPlaque: false,
      walnutMat,
      steelFrameMat,
      chromeMat,
      contactShadowMat,
      maxAniso,
      occlusionMeshes,
      disposables,
      sharedGeos: sharedBenchGeos,
    });
    tableRimMaterials[stId] = rimMat;
    tableLedMaterials[stId] = ledMat;

    // Lower-shelf lab storage totes
    const binLeft = new THREE.Mesh(binGeo, tealCabinetMat);
    binLeft.position.set(-0.66, 0.37, 0.04);
    tGroup.add(binLeft);
    const binRight = new THREE.Mesh(binGeo, trayMat);
    binRight.position.set(0.66, 0.37, 0.04);
    tGroup.add(binRight);

    // Sunlit right-column desk (02 CuSO4) receives warm window sunlight grazing the walnut surface
    if (stId === 'dien-phan-cuso4') {
      const sunOverlay = new THREE.Mesh(deskSunGeo, deskSunMat);
      sunOverlay.rotation.x = -Math.PI / 2;
      sunOverlay.rotation.z = -0.16;
      sunOverlay.position.set(0.18, TABLE_TOP_Y + 0.0025, 0.04);
      tGroup.add(sunOverlay);
    }

    // Invisible table proxy hitbox for Overview clicking
    const hitMesh = new THREE.Mesh(tableHitGeo, tableHitMat);
    hitMesh.position.set(0, 0.92, 0);
    tGroup.add(hitMesh);
    tableHitboxes.push({ mesh: hitMesh, kind: 'table', station: stId });
  }

  // =========================================================================
  // 3. BENCH 04: AXIS-ALIGNED 3D PRACTICE DESK (x = +2.25, z = +2.15, rotY = 0!)
  // =========================================================================
  const practiceGroup = new THREE.Group();
  practiceGroup.position.set(
    WORLD_ANCHORS.practiceDesk.x,
    WORLD_ANCHORS.practiceDesk.y,
    WORLD_ANCHORS.practiceDesk.z
  );
  // Strictly axis-aligned on the 2x2 architectural grid!
  practiceGroup.rotation.y = 0;
  scene.add(practiceGroup);

  const { rimMat: practiceRimMat } = buildArchitecturalLabBench({
    parent: practiceGroup,
    plaqueText: `LUYỆN TẬP · ${PRACTICE_BANK_STATS.standardCount}+${PRACTICE_BANK_STATS.visual3DCount}`,
    warmGoldPlaque: true,
    walnutMat,
    steelFrameMat,
    chromeMat,
    contactShadowMat,
    maxAniso,
    occlusionMeshes,
    disposables,
    sharedGeos: sharedBenchGeos,
  });

  // Warm golden sunlight patch grazing the right side of Practice Desk 04
  const pSunOverlay = new THREE.Mesh(deskSunGeo, deskSunMat);
  pSunOverlay.rotation.x = -Math.PI / 2;
  pSunOverlay.rotation.z = -0.14;
  pSunOverlay.position.set(0.24, TABLE_TOP_Y + 0.0025, 0.06);
  practiceGroup.add(pSunOverlay);

  // Lower-shelf hardcover chemistry textbooks stacked neatly
  const bookGeo = new THREE.BoxGeometry(0.46, 0.075, 0.34);
  const bookColors = [0x1c454e, 0x8a4829, 0x2a5449];
  for (let i = 0; i < 3; i += 1) {
    const bMat = new THREE.MeshStandardMaterial({ color: bookColors[i], roughness: 0.65 });
    const bk = new THREE.Mesh(bookGeo, bMat);
    bk.position.set(-0.56, 0.3 + i * 0.078, 0.06);
    bk.rotation.y = (i - 1) * 0.08;
    practiceGroup.add(bk);
    disposables.push(bMat);
  }

  // Dark stitched-leather architectural desk blotter pad
  const padGeo = createRoundedSlabGeometry(1.74, 1.06, 0.014, 0.035, 0.003, 0.003);
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x17282d,
    roughness: 0.72,
    metalness: 0.08,
    bumpMap: wallPbr.bumpMap,
    bumpScale: 0.003,
  });
  const padMesh = new THREE.Mesh(padGeo, padMat);
  padMesh.position.set(-0.08, TABLE_TOP_Y + 0.007, 0.04);
  padMesh.receiveShadow = true;
  practiceGroup.add(padMesh);

  // === SCULPTED LATHE SPUN-BRASS ARTICULATED ARCHITECT LAMP (RIGHT SIDE OF DESK) ===
  const lampGroup = new THREE.Group();
  lampGroup.position.set(0.86, TABLE_TOP_Y, -0.34);
  practiceGroup.add(lampGroup);

  const lampBaseProfile = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.155, 0),
    new THREE.Vector2(0.15, 0.022),
    new THREE.Vector2(0.125, 0.042),
    new THREE.Vector2(0.038, 0.056),
    new THREE.Vector2(0.022, 0.078),
  ];
  const lampBaseGeo = new THREE.LatheGeometry(lampBaseProfile, 24);
  const lampBase = new THREE.Mesh(lampBaseGeo, brassMat);
  lampBase.castShadow = true;
  lampGroup.add(lampBase);

  const lampArm1Geo = new THREE.CylinderGeometry(0.013, 0.015, 0.5, 12);
  const lampArm1 = new THREE.Mesh(lampArm1Geo, steelFrameMat);
  lampArm1.position.set(-0.05, 0.3, 0.03);
  lampArm1.rotation.z = 0.24;
  lampArm1.rotation.x = 0.1;
  lampGroup.add(lampArm1);

  const lampJointGeo = new THREE.SphereGeometry(0.028, 14, 12);
  const lampElbow = new THREE.Mesh(lampJointGeo, brassMat);
  lampElbow.position.set(-0.11, 0.53, 0.06);
  lampGroup.add(lampElbow);

  const lampArm2Geo = new THREE.CylinderGeometry(0.012, 0.013, 0.38, 12);
  const lampArm2 = new THREE.Mesh(lampArm2Geo, brassMat);
  lampArm2.position.set(-0.24, 0.62, 0.14);
  lampArm2.rotation.z = 1.05;
  lampArm2.rotation.y = 0.32;
  lampGroup.add(lampArm2);

  // Sculpted spun-brass dome lamp shade (LatheGeometry)
  const shadeProfile = [
    new THREE.Vector2(0.028, 0.17),
    new THREE.Vector2(0.068, 0.155),
    new THREE.Vector2(0.12, 0.1),
    new THREE.Vector2(0.152, 0.02),
    new THREE.Vector2(0.156, 0.0),
  ];
  const lampShadeGeo = new THREE.LatheGeometry(shadeProfile, 24);
  const lampShadeMat = new THREE.MeshStandardMaterial({
    color: 0xd9a857,
    roughness: 0.22,
    metalness: 0.9,
    side: THREE.DoubleSide,
  });
  const lampShade = new THREE.Mesh(lampShadeGeo, lampShadeMat);
  lampShade.position.set(-0.34, 0.58, 0.21);
  lampShade.rotation.z = 0.38;
  lampShade.rotation.x = 0.22;
  lampShade.castShadow = true;
  lampGroup.add(lampShade);

  const lampBulbGeo = new THREE.SphereGeometry(0.054, 14, 12);
  const practiceLampBulbMat = new THREE.MeshBasicMaterial({ color: 0xf5d79b });
  const lampBulb = new THREE.Mesh(lampBulbGeo, practiceLampBulbMat);
  lampBulb.position.set(-0.37, 0.6, 0.23);
  lampGroup.add(lampBulb);

  // === 14-SHEET FANNED CREAM EXAMINATION PAPER STACK + BLACK BINDER CLIP ===
  const paperSheetGeo = new THREE.BoxGeometry(0.62, 0.0045, 0.8);
  const creamSheetMat = new THREE.MeshStandardMaterial({ color: 0xe6dfd0, roughness: 0.88 });
  const creamEdgeMat = new THREE.MeshStandardMaterial({ color: 0xd6ccb8, roughness: 0.92 });
  for (let i = 0; i < 13; i += 1) {
    const sh = new THREE.Mesh(paperSheetGeo, i % 2 === 0 ? creamSheetMat : creamEdgeMat);
    const fanAngle = (i - 6) * 0.011 + (seededFrac(i * 19 + 5) - 0.5) * 0.024;
    const jx = (seededFrac(i * 13 + 7) - 0.5) * 0.016;
    const jz = (seededFrac(i * 23 + 3) - 0.5) * 0.014;
    sh.position.set(-0.46 + jx, TABLE_TOP_Y + 0.016 + i * 0.0048, 0.08 + jz);
    sh.rotation.y = fanAngle;
    practiceGroup.add(sh);
  }

  // Top examination cover sheet group (lifts smoothly on hover/focus + 3D page-flip pivot)
  const practiceStackTopGroup = new THREE.Group();
  practiceStackTopGroup.position.set(-0.46, TABLE_TOP_Y + 0.082, 0.08);
  practiceGroup.add(practiceStackTopGroup);

  const coverTex = createPracticeCoverSheetTexture(
    maxAniso,
    PRACTICE_BANK_STATS.standardCount,
    PRACTICE_BANK_STATS.visual3DCount
  );
  const coverMat = new THREE.MeshStandardMaterial({
    color: 0xebe6db,
    map: coverTex,
    roughness: 0.84,
    side: THREE.DoubleSide,
  });
  const baseTopPlaneGeo = new THREE.PlaneGeometry(0.62, 0.8);
  const baseTopSheet = new THREE.Mesh(baseTopPlaneGeo, coverMat);
  baseTopSheet.rotation.x = -Math.PI / 2;
  practiceStackTopGroup.add(baseTopSheet);

  // 3D black steel binder clip gripping top edge of exam paper stack
  const binderBodyGeo = new THREE.BoxGeometry(0.11, 0.028, 0.044);
  const binderBody = new THREE.Mesh(binderBodyGeo, steelFrameMat);
  binderBody.position.set(0, 0.014, -0.385);
  practiceStackTopGroup.add(binderBody);
  const binderWireGeo = new THREE.TorusGeometry(0.036, 0.005, 8, 16, Math.PI);
  const binderWire = new THREE.Mesh(binderWireGeo, chromeMat);
  binderWire.rotation.x = Math.PI / 2;
  binderWire.position.set(0, 0.026, -0.4);
  practiceStackTopGroup.add(binderWire);

  // Page-flip hinged sheet mesh
  const practicePagePivot = new THREE.Group();
  practicePagePivot.position.set(-0.31, 0.008, 0);
  practiceStackTopGroup.add(practicePagePivot);

  const flipSheetGeo = new THREE.PlaneGeometry(0.62, 0.8);
  const flipSheetMat = new THREE.MeshStandardMaterial({
    color: 0xebe6db,
    map: coverTex,
    roughness: 0.84,
    side: THREE.DoubleSide,
  });
  const flipSheetMesh = new THREE.Mesh(flipSheetGeo, flipSheetMat);
  flipSheetMesh.rotation.x = -Math.PI / 2;
  flipSheetMesh.position.set(0.31, 0, 0);
  practicePagePivot.add(flipSheetMesh);
  practicePagePivot.visible = false;

  // === SPIRAL-BOUND OPEN LAB NOTEBOOK WITH METALLIC WIRE RINGS ===
  const nbGroup = new THREE.Group();
  nbGroup.position.set(0.26, TABLE_TOP_Y + 0.019, 0.14);
  nbGroup.rotation.y = -0.12;
  practiceGroup.add(nbGroup);

  const nbCoverGeo = new THREE.BoxGeometry(0.62, 0.014, 0.46);
  const nbCoverMat = new THREE.MeshStandardMaterial({ color: 0x1a383f, roughness: 0.62, metalness: 0.12 });
  const nbCover = new THREE.Mesh(nbCoverGeo, nbCoverMat);
  nbGroup.add(nbCover);

  const nbSpreadTex = createNotebookSpreadTexture(maxAniso);
  const nbPageGeo = new THREE.PlaneGeometry(0.58, 0.42);
  const nbPageMat = new THREE.MeshStandardMaterial({ color: 0xebe6db, map: nbSpreadTex, roughness: 0.86 });
  const nbPages = new THREE.Mesh(nbPageGeo, nbPageMat);
  nbPages.rotation.x = -Math.PI / 2;
  nbPages.position.set(0, 0.012, 0);
  nbGroup.add(nbPages);

  // 12 metallic spiral wire binding rings along the notebook spine!
  const spiralRingGeo = new THREE.TorusGeometry(0.016, 0.0032, 8, 14);
  for (let r = 0; r < 12; r += 1) {
    const ring = new THREE.Mesh(spiralRingGeo, chromeMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(0, 0.016, -0.19 + r * 0.0345);
    nbGroup.add(ring);
  }

  // Turned black & gold fountain pen resting across open notebook
  const penBodyGeo = new THREE.CylinderGeometry(0.013, 0.011, 0.34, 14);
  const penBodyMat = new THREE.MeshStandardMaterial({ color: 0x141a1d, roughness: 0.18, metalness: 0.65 });
  const penMesh = new THREE.Mesh(penBodyGeo, penBodyMat);
  penMesh.rotation.z = Math.PI / 2;
  penMesh.rotation.y = 0.28;
  penMesh.position.set(0.14, 0.025, 0.12);
  nbGroup.add(penMesh);

  const penBandGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.025, 14);
  const penBand = new THREE.Mesh(penBandGeo, brassMat);
  penBand.rotation.z = Math.PI / 2;
  penBand.rotation.y = 0.28;
  penBand.position.set(0.18, 0.025, 0.108);
  nbGroup.add(penBand);

  const penTipGeo = new THREE.ConeGeometry(0.012, 0.052, 12);
  const penTip = new THREE.Mesh(penTipGeo, brassMat);
  penTip.rotation.z = -Math.PI / 2;
  penTip.position.set(0.31, 0.025, 0.07);
  nbGroup.add(penTip);

  // === WIRE-MESH PEN CUP WITH PENCILS & ACRYLIC RULER (BACK-CENTER OF PRACTICE DESK) ===
  const cupGeo = new THREE.CylinderGeometry(0.072, 0.062, 0.19, 18, 1, true);
  const cupMat = new THREE.MeshStandardMaterial({
    color: 0x283236,
    roughness: 0.38,
    metalness: 0.8,
    side: THREE.DoubleSide,
  });
  const cupMesh = new THREE.Mesh(cupGeo, cupMat);
  cupMesh.position.set(0.18, TABLE_TOP_Y + 0.095, -0.34);
  practiceGroup.add(cupMesh);

  const pencilGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.26, 8);
  const pencilColors = [0xd9913b, 0x3b8f82, 0xc9523b];
  for (let p = 0; p < 3; p += 1) {
    const pMat = new THREE.MeshStandardMaterial({ color: pencilColors[p], roughness: 0.55 });
    const pen = new THREE.Mesh(pencilGeo, pMat);
    pen.position.set(0.16 + p * 0.02, TABLE_TOP_Y + 0.15, -0.35 + (p % 2) * 0.02);
    pen.rotation.z = (p - 1) * 0.16;
    pen.rotation.x = (p % 2 === 0 ? 1 : -1) * 0.1;
    practiceGroup.add(pen);
    disposables.push(pMat);
  }

  const rulerGeo = new THREE.BoxGeometry(0.46, 0.006, 0.052);
  const rulerMat = new THREE.MeshPhysicalMaterial({
    color: 0xdff5f7,
    roughness: 0.12,
    transparent: true,
    opacity: 0.64,
    clearcoat: 1.0,
  });
  const rulerMesh = new THREE.Mesh(rulerGeo, rulerMat);
  rulerMesh.position.set(-0.92, TABLE_TOP_Y + 0.015, 0.18);
  rulerMesh.rotation.y = 1.46;
  practiceGroup.add(rulerMesh);

  // 2 Playful Sticky Notes on Practice Desk ("Muối không chở electron :)" & "Đừng quên chiều e⁻!")
  const sticky1Tex = createStickyNoteTexture('Muối không chở', 'electron :)', '#F7E79B', maxAniso);
  const sticky2Tex = createStickyNoteTexture('Đừng quên', 'chiều e⁻ !', '#BCEEE2', maxAniso);
  const stickyGeo = new THREE.PlaneGeometry(0.21, 0.21);
  const sticky1Mat = new THREE.MeshStandardMaterial({ map: sticky1Tex, roughness: 0.88 });
  const sticky2Mat = new THREE.MeshStandardMaterial({ map: sticky2Tex, roughness: 0.88 });

  const sticky1 = new THREE.Mesh(stickyGeo, sticky1Mat);
  sticky1.rotation.x = -Math.PI / 2;
  sticky1.rotation.z = 0.16;
  sticky1.position.set(0.84, TABLE_TOP_Y + 0.014, 0.42);
  practiceGroup.add(sticky1);

  const sticky2 = new THREE.Mesh(stickyGeo, sticky2Mat);
  sticky2.rotation.x = -Math.PI / 2;
  sticky2.rotation.z = -0.12;
  sticky2.position.set(-0.88, TABLE_TOP_Y + 0.014, -0.34);
  practiceGroup.add(sticky2);

  // Small chemistry flask badge sticker on front-right walnut corner
  const stickerTex = createDeskStickerTexture(maxAniso);
  const stickerGeo = new THREE.PlaneGeometry(0.14, 0.14);
  const stickerMat = new THREE.MeshBasicMaterial({ map: stickerTex, transparent: true });
  const stickerMesh = new THREE.Mesh(stickerGeo, stickerMat);
  stickerMesh.rotation.x = -Math.PI / 2;
  stickerMesh.rotation.z = -0.18;
  stickerMesh.position.set(1.04, TABLE_TOP_Y + 0.003, 0.56);
  practiceGroup.add(stickerMesh);

  // Generous invisible Practice Desk hitbox for Overview clicking
  const practiceHitGeo = new THREE.BoxGeometry(BW + 0.18, 1.55, BD + 0.18);
  const practiceHitMat = new THREE.MeshBasicMaterial({ visible: false });
  const practiceHitMesh = new THREE.Mesh(practiceHitGeo, practiceHitMat);
  practiceHitMesh.position.set(0, 0.92, 0);
  practiceGroup.add(practiceHitMesh);
  zoneHitboxes.push({ mesh: practiceHitMesh, kind: 'zone', zoneId: 'PRACTICE' });

  disposables.push(
    bookGeo, padGeo, padMat, lampBaseGeo, lampArm1Geo, lampJointGeo, lampArm2Geo,
    lampShadeGeo, lampShadeMat, lampBulbGeo, practiceLampBulbMat,
    paperSheetGeo, creamSheetMat, creamEdgeMat, coverTex, coverMat, baseTopPlaneGeo,
    binderBodyGeo, binderWireGeo, flipSheetGeo, flipSheetMat,
    nbCoverGeo, nbCoverMat, nbSpreadTex, nbPageGeo, nbPageMat, spiralRingGeo,
    penBodyGeo, penBodyMat, penBandGeo, penTipGeo, cupGeo, cupMat, pencilGeo,
    rulerGeo, rulerMat, sticky1Tex, sticky2Tex, stickyGeo, sticky1Mat, sticky2Mat,
    stickerTex, stickerGeo, stickerMat, practiceHitGeo, practiceHitMat
  );

  // Helper to register clickable object hitbox + wireframe highlight
  const registerObjectHitbox = (
    parent: THREE.Object3D,
    objectId: LabObjectId,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number
  ): THREE.Mesh => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshBasicMaterial({ visible: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    disposables.push(geo, mat);
    objectHitboxes.push({
      mesh,
      kind: 'object',
      station: LAB_OBJECTS[objectId].station,
      objectId,
    });
    objectHighlightMaterials[objectId] = addHighlightBox(parent, w * 0.94, h * 0.94, d * 0.94, x, y, z, disposables);
    return mesh;
  };

  // Shared crystalline copper nodule deposit helper
  const noduleGeo = new THREE.DodecahedronGeometry(0.016, 0);
  disposables.push(noduleGeo);

  // =========================================================================
  // STATION 1: PIN Zn–Cu (Back-Left: x = -2.25, z = -1.05)
  // =========================================================================
  const s1 = new THREE.Group();
  s1.position.set(TABLE_POSITIONS['pin-zn-cu'].x, TABLE_TOP_Y, TABLE_POSITIONS['pin-zn-cu'].z);
  scene.add(s1);

  // Beveled Clear Optical Acrylic Base Tray with 4 chrome standoffs (matches Daniell cell close-up reference!)
  const s1AcrylicGeo = createRoundedSlabGeometry(1.66, 0.76, 0.044, 0.055, 0.008, 0.008);
  const s1AcrylicMat = new THREE.MeshPhysicalMaterial({
    color: 0xeaf8fb,
    roughness: 0.06,
    metalness: 0.05,
    ior: 1.49,
    thickness: 0.08,
    transmission: isSoftwareGl ? 0 : 0.66,
    transparent: true,
    opacity: isSoftwareGl ? 0.38 : 0.92,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });
  glassMaterials.push(s1AcrylicMat);
  const s1Tray = new THREE.Mesh(s1AcrylicGeo, s1AcrylicMat);
  s1Tray.position.set(0, 0.028, 0.04);
  s1.add(s1Tray);

  const standoffGeo = new THREE.CylinderGeometry(0.022, 0.024, 0.026, 14);
  for (const sx of [-0.74, 0.74]) {
    for (const sz of [-0.28, 0.36]) {
      const st = new THREE.Mesh(standoffGeo, chromeMat);
      st.position.set(sx, 0.013, sz);
      s1.add(st);
    }
  }
  disposables.push(s1AcrylicGeo, s1AcrylicMat, standoffGeo);

  // Left Beaker: ZnSO4 (clear borosilicate LatheGeometry)
  const znBeaker = createGlassBeakerGroup(
    0.27, 0.48, 0xd8eaee, 0.34, gradTex, isSoftwareGl, cutawayClipPlane, glassMaterials, disposables
  );
  znBeaker.group.position.set(-0.52, 0.05, 0.04);
  s1.add(znBeaker.group);
  registerObjectHitbox(s1, 'zn-cu-beaker-zn', 0.56, 0.52, 0.56, -0.52, 0.3, 0.04);

  // Right Beaker: CuSO4 (translucent sapphire-blue borosilicate LatheGeometry so submerged Cu plate stays clearly visible)
  const cuBeaker = createGlassBeakerGroup(
    0.27, 0.48, 0x0b78e8, 0.38, gradTex, isSoftwareGl, cutawayClipPlane, glassMaterials, disposables
  );
  cuBeaker.group.position.set(0.52, 0.05, 0.04);
  s1.add(cuBeaker.group);
  registerObjectHitbox(s1, 'zn-cu-beaker-cu', 0.56, 0.52, 0.56, 0.52, 0.3, 0.04);

  // Beveled Zn & Cu Electrode Plates (0.49 m tall: ~33% exposed above liquid y=0.410, ~67% submerged down to y=0.083)
  const plateGeo = createRoundedBoxGeometry(0.16, 0.49, 0.036, 0.012, 0.005);
  const znCuZnPlate = new THREE.Mesh(plateGeo, zincMat);
  znCuZnPlate.position.set(-0.64, 0.328, 0.04);
  znCuZnPlate.castShadow = true;
  znCuZnPlate.renderOrder = 0;
  s1.add(znCuZnPlate);
  registerObjectHitbox(s1, 'zn-cu-electrode-zn', 0.24, 0.58, 0.22, -0.64, 0.35, 0.04);

  // Beveled Cu Electrode Plate (right, Cathode +) + growing crystalline copper deposit cluster strictly below waterline
  const cuBasePlate = new THREE.Mesh(plateGeo, copperMat);
  cuBasePlate.position.set(0.64, 0.328, 0.04);
  cuBasePlate.castShadow = true;
  cuBasePlate.renderOrder = 0;
  s1.add(cuBasePlate);

  const znCuCuPlatingMat = new THREE.MeshStandardMaterial({
    color: 0xe3763e,
    roughness: 0.32,
    metalness: 0.65,
    envMapIntensity: 1.2,
    bumpMap: brushedMetal.bumpMap,
    bumpScale: 0.01,
  });
  const znCuCuPlating = new THREE.Group();
  znCuCuPlating.position.set(0.64, 0.245, 0.04);
  const cuPlatingCoreGeo = createRoundedBoxGeometry(0.172, 0.32, 0.048, 0.012, 0.006);
  const cuPlatingCore = new THREE.Mesh(cuPlatingCoreGeo, znCuCuPlatingMat);
  cuPlatingCore.renderOrder = 0;
  znCuCuPlating.add(cuPlatingCore);
  // Organic crystalline copper nodules deposited along submerged cathode surface
  for (let n = 0; n < 18; n += 1) {
    const nod = new THREE.Mesh(noduleGeo, znCuCuPlatingMat);
    const nx = (seededFrac(n * 11 + 2) - 0.5) * 0.145;
    const ny = (seededFrac(n * 17 + 5) - 0.5) * 0.28;
    const nz = (n % 2 === 0 ? 1 : -1) * (0.022 + seededFrac(n * 7) * 0.012);
    nod.position.set(nx, ny, nz);
    nod.scale.setScalar(0.65 + seededFrac(n * 23) * 0.65);
    znCuCuPlating.add(nod);
  }
  znCuCuPlating.scale.set(1, 1, 0.01);
  s1.add(znCuCuPlating);
  registerObjectHitbox(s1, 'zn-cu-electrode-cu', 0.24, 0.58, 0.22, 0.64, 0.35, 0.04);
  disposables.push(plateGeo, cuPlatingCoreGeo, znCuCuPlatingMat);

  // Detailed 3D Alligator / Thumbscrew Clamps seated atop Zn & Cu electrodes
  const znClamp = createElectrodeClampGroup(blackWireMat, brassMat, chromeMat, disposables);
  znClamp.position.set(-0.64, 0.605, 0.04);
  s1.add(znClamp);
  const cuClamp = createElectrodeClampGroup(redWireMat, brassMat, chromeMat, disposables);
  cuClamp.position.set(0.64, 0.605, 0.04);
  cuClamp.rotation.y = Math.PI;
  s1.add(cuClamp);

  // Subtle fun sticky note on Table 1 front-left corner
  const s1StickyTex = createStickyNoteTexture('Đừng quên', 'chiều e⁻ !', '#F8E39A', maxAniso);
  const s1StickyGeo = new THREE.PlaneGeometry(0.18, 0.18);
  const s1StickyMat = new THREE.MeshStandardMaterial({ map: s1StickyTex, roughness: 0.88 });
  const s1Sticky = new THREE.Mesh(s1StickyGeo, s1StickyMat);
  s1Sticky.rotation.x = -Math.PI / 2;
  s1Sticky.rotation.z = -0.14;
  s1Sticky.position.set(-0.98, 0.003, 0.54);
  s1.add(s1Sticky);
  disposables.push(s1StickyTex, s1StickyGeo, s1StickyMat);

  // U-Shaped Glass Salt Bridge KNO3 (smooth TubeGeometry)
  const bridgePoints = [
    new THREE.Vector3(-0.36, 0.24, 0.04),
    new THREE.Vector3(-0.36, 0.58, 0.04),
    new THREE.Vector3(-0.26, 0.66, 0.04),
    new THREE.Vector3(0, 0.67, 0.04),
    new THREE.Vector3(0.26, 0.66, 0.04),
    new THREE.Vector3(0.36, 0.58, 0.04),
    new THREE.Vector3(0.36, 0.24, 0.04),
  ];
  const znCuKCurve = new THREE.CatmullRomCurve3(bridgePoints);
  const znCuNO3Curve = new THREE.CatmullRomCurve3([...bridgePoints].reverse());

  const bridgeGeo = new THREE.TubeGeometry(znCuKCurve, 44, 0.046, 18, false);
  const bridgeMat = new THREE.MeshPhysicalMaterial({
    color: 0xe3f6f7,
    roughness: 0.14,
    metalness: 0.04,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
  });
  const bridgeMesh = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridgeMesh.renderOrder = 6;
  s1.add(bridgeMesh);

  // Porous cotton plugs at salt bridge tips
  const plugGeo = new THREE.CylinderGeometry(0.043, 0.043, 0.055, 14);
  const plugMat = new THREE.MeshStandardMaterial({ color: 0xedf0ec, roughness: 0.92 });
  const plugL = new THREE.Mesh(plugGeo, plugMat);
  plugL.position.set(-0.36, 0.24, 0.04);
  s1.add(plugL);
  const plugR = new THREE.Mesh(plugGeo, plugMat);
  plugR.position.set(0.36, 0.24, 0.04);
  s1.add(plugR);
  registerObjectHitbox(s1, 'zn-cu-salt-bridge', 0.84, 0.54, 0.2, 0, 0.5, 0.04);
  disposables.push(bridgeGeo, bridgeMat, plugGeo, plugMat);

  // Chamfered Digital Voltmeter on sleek column stand behind beakers (matching Zn-Cu hero reference!)
  const znCuVoltmeterDisplay = createLiveDisplayTexture(maxAniso);
  disposables.push(znCuVoltmeterDisplay.texture);

  const vmGroup = new THREE.Group();
  vmGroup.position.set(0, 0, -0.44);
  s1.add(vmGroup);

  const vmBaseGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.036, 22);
  const vmBase = new THREE.Mesh(vmBaseGeo, steelFrameMat);
  vmBase.position.y = 0.018;
  vmGroup.add(vmBase);

  const vmStandGeo = new THREE.CylinderGeometry(0.028, 0.032, 0.72, 16);
  const vmStand = new THREE.Mesh(vmStandGeo, steelFrameMat);
  vmStand.position.y = 0.38;
  vmGroup.add(vmStand);

  const vmBodyGeo = createRoundedBoxGeometry(0.64, 0.36, 0.15, 0.032, 0.012);
  const vmBody = new THREE.Mesh(vmBodyGeo, steelFrameMat);
  vmBody.position.y = 0.88;
  vmBody.castShadow = true;
  vmGroup.add(vmBody);

  const vmRimGeo = createRoundedBoxGeometry(0.66, 0.38, 0.045, 0.034, 0.008);
  const vmRim = new THREE.Mesh(vmRimGeo, chromeMat);
  vmRim.position.set(0, 0.88, 0.056);
  vmGroup.add(vmRim);

  const vmScreenGeo = new THREE.PlaneGeometry(0.54, 0.25);
  const vmScreenMat = new THREE.MeshBasicMaterial({ map: znCuVoltmeterDisplay.texture });
  const vmScreen = new THREE.Mesh(vmScreenGeo, vmScreenMat);
  vmScreen.position.set(0, 0.895, 0.082);
  vmGroup.add(vmScreen);

  // Front binding terminals below voltmeter screen
  const vmTermGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.036, 14);
  const vmTermL = new THREE.Mesh(vmTermGeo, blackWireMat);
  vmTermL.rotation.x = Math.PI / 2;
  vmTermL.position.set(-0.18, 0.735, 0.085);
  vmGroup.add(vmTermL);
  const vmTermR = new THREE.Mesh(vmTermGeo, redWireMat);
  vmTermR.rotation.x = Math.PI / 2;
  vmTermR.position.set(0.18, 0.735, 0.085);
  vmGroup.add(vmTermR);

  registerObjectHitbox(s1, 'zn-cu-voltmeter', 0.7, 0.44, 0.24, 0, 0.88, -0.44);
  disposables.push(vmBaseGeo, vmStandGeo, vmBodyGeo, vmRimGeo, vmScreenGeo, vmScreenMat, vmTermGeo);

  // Upgraded Precision Brass Knife Switch (Khóa K) with Live Status LED
  const swGroup = new THREE.Group();
  swGroup.position.set(0, 0, 0.56);
  s1.add(swGroup);

  const swBaseGeo = createRoundedSlabGeometry(0.54, 0.22, 0.056, 0.028, 0.008, 0.008);
  const swBase = new THREE.Mesh(swBaseGeo, steelFrameMat);
  swBase.position.y = 0.028;
  swBase.castShadow = true;
  swGroup.add(swBase);

  const swPostGeo = new THREE.CylinderGeometry(0.026, 0.03, 0.085, 16);
  const swPostL = new THREE.Mesh(swPostGeo, brassMat);
  swPostL.position.set(-0.15, 0.088, 0);
  swGroup.add(swPostL);
  const swPostR = new THREE.Mesh(swPostGeo, brassMat);
  swPostR.position.set(0.15, 0.088, 0);
  swGroup.add(swPostR);

  // Live glowing status LED dome on left of knife switch (emerald closed / amber open)
  const swLedGeo = new THREE.SphereGeometry(0.022, 14, 12);
  const znCuSwitchLedMat = new THREE.MeshBasicMaterial({ color: 0xe6a85c });
  const swLed = new THREE.Mesh(swLedGeo, znCuSwitchLedMat);
  swLed.position.set(-0.22, 0.064, 0);
  swGroup.add(swLed);

  const znCuSwitchPivot = new THREE.Group();
  znCuSwitchPivot.position.set(-0.15, 0.115, 0);
  swGroup.add(znCuSwitchPivot);

  const bladeGeo = new THREE.BoxGeometry(0.34, 0.024, 0.018);
  const blade = new THREE.Mesh(bladeGeo, brassMat);
  blade.position.set(0.17, 0, 0);
  znCuSwitchPivot.add(blade);

  const handleGeo = new THREE.CylinderGeometry(0.024, 0.02, 0.11, 14);
  const handle = new THREE.Mesh(handleGeo, steelFrameMat);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.36, 0.008, 0);
  znCuSwitchPivot.add(handle);

  registerObjectHitbox(s1, 'zn-cu-switch', 0.64, 0.3, 0.34, 0, 0.14, 0.56);
  disposables.push(swBaseGeo, swPostGeo, swLedGeo, znCuSwitchLedMat, bladeGeo, handleGeo);

  // Shared luminous current trail sheath material
  const wireGlowMat = new THREE.MeshBasicMaterial({
    color: 0x78f0dc,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  disposables.push(wireGlowMat);

  // Outer 3D wire path for Pin Zn-Cu
  const znCuWireCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.64, 0.64, 0.04),
    new THREE.Vector3(-0.64, 0.92, -0.06),
    new THREE.Vector3(-0.36, 0.94, -0.34),
    new THREE.Vector3(-0.18, 0.74, -0.36),
    new THREE.Vector3(0.18, 0.74, -0.36),
    new THREE.Vector3(0.36, 0.94, -0.34),
    new THREE.Vector3(0.64, 0.92, -0.06),
    new THREE.Vector3(0.64, 0.64, 0.04),
  ]);
  const s1WireGeo = new THREE.TubeGeometry(znCuWireCurve, 48, 0.013, 10, false);
  const s1WireMesh = new THREE.Mesh(s1WireGeo, redWireMat);
  s1.add(s1WireMesh);
  const s1WireGlowGeo = new THREE.TubeGeometry(znCuWireCurve, 36, 0.024, 8, false);
  const znCuWireGlowMesh = new THREE.Mesh(s1WireGlowGeo, wireGlowMat);
  znCuWireGlowMesh.visible = false;
  s1.add(znCuWireGlowMesh);

  // Front switch leads connecting electrodes to knife switch
  const swLeadL = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.64, 0.62, 0.04),
    new THREE.Vector3(-0.88, 0.4, 0.34),
    new THREE.Vector3(-0.56, 0.06, 0.56),
    new THREE.Vector3(-0.2, 0.06, 0.56),
  ]);
  const swLeadR = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.2, 0.06, 0.56),
    new THREE.Vector3(0.56, 0.06, 0.56),
    new THREE.Vector3(0.88, 0.4, 0.34),
    new THREE.Vector3(0.64, 0.62, 0.04),
  ]);
  const swLeadLGeo = new THREE.TubeGeometry(swLeadL, 28, 0.012, 10, false);
  const swLeadRGeo = new THREE.TubeGeometry(swLeadR, 28, 0.012, 10, false);
  s1.add(new THREE.Mesh(swLeadLGeo, blackWireMat));
  s1.add(new THREE.Mesh(swLeadRGeo, redWireMat));
  registerObjectHitbox(s1, 'zn-cu-wire', 1.38, 0.24, 0.56, 0, 0.88, -0.18);
  disposables.push(s1WireGeo, s1WireGlowGeo, swLeadLGeo, swLeadRGeo);

  const orbGeo = new THREE.SphereGeometry(0.028, 12, 12);
  const ionGeo = new THREE.SphereGeometry(0.022, 10, 10);
  disposables.push(orbGeo, ionGeo);

  const znCuElectrons: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i += 1) {
    const m = new THREE.Mesh(orbGeo, electronMat);
    m.visible = false;
    s1.add(m);
    znCuElectrons.push(m);
  }
  const znCuKIons: THREE.Mesh[] = [];
  const znCuNO3Ions: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i += 1) {
    const k = new THREE.Mesh(ionGeo, kIonMat);
    k.visible = false;
    s1.add(k);
    znCuKIons.push(k);

    const n = new THREE.Mesh(ionGeo, no3IonMat);
    n.visible = false;
    s1.add(n);
    znCuNO3Ions.push(n);
  }

  // =========================================================================
  // STATION 2: ĐIỆN PHÂN CuSO₄ (Back-Right: x = +2.25, z = -1.05)
  // =========================================================================
  const s2 = new THREE.Group();
  s2.position.set(TABLE_POSITIONS['dien-phan-cuso4'].x, TABLE_TOP_Y, TABLE_POSITIONS['dien-phan-cuso4'].z);
  scene.add(s2);

  // Brushed aluminum optical magnetic stirrer platform with glowing teal under-edge (matches CuSO4 reference!)
  const s2StandGeo = createRoundedSlabGeometry(0.94, 0.74, 0.068, 0.055, 0.01, 0.01);
  const s2StandMat = new THREE.MeshStandardMaterial({
    color: 0x6f7c82,
    roughness: 0.28,
    metalness: 0.8,
    bumpMap: brushedMetal.bumpMap,
    bumpScale: 0.004,
    roughnessMap: brushedMetal.roughnessMap,
  });
  const s2Stand = new THREE.Mesh(s2StandGeo, s2StandMat);
  s2Stand.position.set(-0.25, 0.04, 0.08);
  s2Stand.castShadow = true;
  s2Stand.receiveShadow = true;
  s2.add(s2Stand);

  const s2StandTrimGeo = createRoundedSlabGeometry(0.96, 0.76, 0.016, 0.058, 0.004, 0.004);
  const s2StandTrimMat = new THREE.MeshBasicMaterial({ color: 0x56decb });
  const s2StandTrim = new THREE.Mesh(s2StandTrimGeo, s2StandTrimMat);
  s2StandTrim.position.set(-0.25, 0.012, 0.08);
  s2.add(s2StandTrim);
  disposables.push(s2StandGeo, s2StandMat, s2StandTrimGeo, s2StandTrimMat);

  // Main CuSO4 LatheGeometry borosilicate electrolytic cell
  const cuso4Cell = createGlassBeakerGroup(
    0.38, 0.56, 0x0f75e6, 0.74, gradTex, isSoftwareGl, cutawayClipPlane, glassMaterials, disposables
  );
  cuso4Cell.group.position.set(-0.25, 0.075, 0.08);
  s2.add(cuso4Cell.group);
  registerObjectHitbox(s2, 'cuso4-cell', 0.82, 0.64, 0.8, -0.25, 0.36, 0.08);
  registerObjectHitbox(s2, 'cuso4-solution', 0.64, 0.32, 0.64, -0.25, 0.24, 0.08);

  // Glass Petri dish with crystalline blue CuSO4·5H2O cluster
  const dishGeo = new THREE.CylinderGeometry(0.16, 0.155, 0.032, 24);
  const dishMat = new THREE.MeshPhysicalMaterial({
    color: 0xeaf8fa,
    transparent: true,
    opacity: 0.44,
    roughness: 0.08,
    clearcoat: 1.0,
  });
  const dish = new THREE.Mesh(dishGeo, dishMat);
  dish.position.set(0.62, 0.018, 0.42);
  s2.add(dish);
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x1a82f5,
    emissive: 0x093b75,
    emissiveIntensity: 0.35,
    roughness: 0.2,
    metalness: 0.14,
  });
  for (let c = 0; c < 9; c += 1) {
    const cr = new THREE.Mesh(noduleGeo, crystalMat);
    const a = (c / 9) * Math.PI * 2;
    const rad = c === 0 ? 0 : 0.055 + (c % 2) * 0.032;
    cr.position.set(0.62 + Math.cos(a) * rad, 0.034 + (c % 2) * 0.008, 0.42 + Math.sin(a) * rad);
    cr.scale.set(1.2, 0.85, 1.1);
    s2.add(cr);
  }
  disposables.push(dishGeo, dishMat, crystalMat);

  // Cathode (-) left inside CuSO4 cell + growing copper plating sleeve & nodules
  const rodGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.58, 18);
  const cuso4CathodeCore = new THREE.Mesh(rodGeo, graphiteMat);
  cuso4CathodeCore.position.set(-0.46, 0.4, 0.08);
  s2.add(cuso4CathodeCore);

  const cuso4CathodeClamp = createElectrodeClampGroup(blackWireMat, brassMat, chromeMat, disposables);
  cuso4CathodeClamp.position.set(-0.46, 0.71, 0.08);
  s2.add(cuso4CathodeClamp);

  const cuso4CathodePlatingMat = new THREE.MeshStandardMaterial({
    color: 0xdf7640,
    roughness: 0.32,
    metalness: 0.92,
    bumpMap: brushedMetal.bumpMap,
    bumpScale: 0.01,
  });
  const cuso4CathodePlating = new THREE.Group();
  cuso4CathodePlating.position.set(-0.46, 0.3, 0.08);
  const platingSleeveGeo = new THREE.CylinderGeometry(0.054, 0.054, 0.36, 18);
  const platingSleeve = new THREE.Mesh(platingSleeveGeo, cuso4CathodePlatingMat);
  cuso4CathodePlating.add(platingSleeve);
  for (let n = 0; n < 14; n += 1) {
    const nod = new THREE.Mesh(noduleGeo, cuso4CathodePlatingMat);
    const ang = (n / 14) * Math.PI * 2;
    nod.position.set(Math.cos(ang) * 0.048, (seededFrac(n * 13) - 0.5) * 0.3, Math.sin(ang) * 0.048);
    nod.scale.setScalar(0.6 + seededFrac(n * 7) * 0.55);
    cuso4CathodePlating.add(nod);
  }
  cuso4CathodePlating.scale.set(0.65, 1, 0.65);
  cuso4CathodePlating.visible = false;
  s2.add(cuso4CathodePlating);
  disposables.push(cuso4CathodePlatingMat);

  // Subtle "LAB READY" metal plaque on Table 2 front-left corner
  const readyTex = createLabReadyPlaqueTexture(maxAniso);
  const readyGeo = new THREE.PlaneGeometry(0.34, 0.085);
  const readyMat = new THREE.MeshBasicMaterial({ map: readyTex });
  const readyPlaque = new THREE.Mesh(readyGeo, readyMat);
  readyPlaque.rotation.x = -Math.PI / 2;
  readyPlaque.position.set(-0.94, 0.004, 0.62);
  s2.add(readyPlaque);
  disposables.push(readyTex, readyGeo, readyMat);
  registerObjectHitbox(s2, 'cuso4-cathode', 0.22, 0.62, 0.22, -0.46, 0.4, 0.08);

  // Anode (+) on right inside CuSO4 cell: switches between inert graphite rod and soluble copper plate
  const cuso4AnodeGraphite = new THREE.Mesh(rodGeo, graphiteMat);
  cuso4AnodeGraphite.position.set(-0.04, 0.4, 0.08);
  s2.add(cuso4AnodeGraphite);

  const cuAnodePlateGeo = createRoundedBoxGeometry(0.12, 0.56, 0.04, 0.01, 0.005);
  const cuso4AnodeCopper = new THREE.Mesh(cuAnodePlateGeo, copperMat);
  cuso4AnodeCopper.position.set(-0.04, 0.4, 0.08);
  cuso4AnodeCopper.visible = false;
  s2.add(cuso4AnodeCopper);

  const cuso4AnodeClamp = createElectrodeClampGroup(redWireMat, brassMat, chromeMat, disposables);
  cuso4AnodeClamp.position.set(-0.04, 0.71, 0.08);
  cuso4AnodeClamp.rotation.y = Math.PI;
  s2.add(cuso4AnodeClamp);

  registerObjectHitbox(s2, 'cuso4-anode', 0.22, 0.62, 0.22, -0.04, 0.4, 0.08);
  disposables.push(rodGeo, platingSleeveGeo, cuAnodePlateGeo);

  // Chamfered DC Power Supply on right side of Table 2
  const cuso4Display = createLiveDisplayTexture(maxAniso);
  disposables.push(cuso4Display.texture);
  const s2Power = createDCPowerSupplyGroup(cuso4Display, brushedMetal, disposables);
  s2Power.position.set(0.7, 0, -0.18);
  s2Power.rotation.y = -0.22;
  s2.add(s2Power);
  registerObjectHitbox(s2, 'cuso4-power', 0.66, 0.42, 0.46, 0.7, 0.2, -0.18);

  const cuso4WireCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.04, 0.74, 0.08),
    new THREE.Vector3(0.08, 0.88, 0.02),
    new THREE.Vector3(0.45, 0.64, 0.02),
    new THREE.Vector3(0.62, 0.14, 0.06),
    new THREE.Vector3(0.74, 0.14, 0.06),
    new THREE.Vector3(0.35, 0.82, -0.22),
    new THREE.Vector3(-0.28, 0.92, -0.06),
    new THREE.Vector3(-0.46, 0.74, 0.08),
  ]);
  const s2WireGeo = new THREE.TubeGeometry(cuso4WireCurve, 48, 0.013, 10, false);
  s2.add(new THREE.Mesh(s2WireGeo, redWireMat));
  const s2WireGlowGeo = new THREE.TubeGeometry(cuso4WireCurve, 36, 0.024, 8, false);
  const cuso4WireGlowMesh = new THREE.Mesh(s2WireGlowGeo, wireGlowMat);
  cuso4WireGlowMesh.visible = false;
  s2.add(cuso4WireGlowMesh);
  registerObjectHitbox(s2, 'cuso4-wire', 1.15, 0.34, 0.45, 0.18, 0.76, -0.04);
  disposables.push(s2WireGeo, s2WireGlowGeo);

  const bubbleGeo = new THREE.SphereGeometry(0.017, 10, 10);
  disposables.push(bubbleGeo);

  const cuso4Electrons: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i += 1) {
    const m = new THREE.Mesh(orbGeo, electronMat);
    m.visible = false;
    s2.add(m);
    cuso4Electrons.push(m);
  }
  const cuso4O2Bubbles: THREE.Mesh[] = [];
  const cuso4H2Bubbles: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i += 1) {
    const o2 = new THREE.Mesh(bubbleGeo, o2BubbleMat);
    o2.visible = false;
    s2.add(o2);
    cuso4O2Bubbles.push(o2);

    const h2 = new THREE.Mesh(bubbleGeo, h2BubbleMat);
    h2.visible = false;
    s2.add(h2);
    cuso4H2Bubbles.push(h2);
  }

  // =========================================================================
  // STATION 3: ĐIỆN PHÂN NaCl (Front-Left: x = -2.25, z = +2.15)
  // =========================================================================
  const s3 = new THREE.Group();
  s3.position.set(TABLE_POSITIONS['dien-phan-nacl'].x, TABLE_TOP_Y, TABLE_POSITIONS['dien-phan-nacl'].z);
  scene.add(s3);

  const naclDisplay = createLiveDisplayTexture(maxAniso);
  disposables.push(naclDisplay.texture);
  const s3Power = createDCPowerSupplyGroup(naclDisplay, brushedMetal, disposables);
  s3Power.position.set(-0.76, 0, -0.14);
  s3Power.rotation.y = 0.22;
  s3.add(s3Power);
  registerObjectHitbox(s3, 'nacl-power', 0.66, 0.42, 0.46, -0.76, 0.2, -0.14);

  const naclAnodeMesh = new THREE.Mesh(rodGeo, graphiteMat);
  naclAnodeMesh.position.set(-0.08, 0.38, 0.08);
  s3.add(naclAnodeMesh);
  const naclAnodeClamp = createElectrodeClampGroup(redWireMat, brassMat, chromeMat, disposables);
  naclAnodeClamp.position.set(-0.08, 0.69, 0.08);
  s3.add(naclAnodeClamp);
  registerObjectHitbox(s3, 'nacl-anode', 0.22, 0.62, 0.22, -0.08, 0.38, 0.08);

  const naclCathodeMesh = new THREE.Mesh(rodGeo, graphiteMat);
  naclCathodeMesh.position.set(0.52, 0.38, 0.08);
  s3.add(naclCathodeMesh);
  const naclCathodeClamp = createElectrodeClampGroup(blackWireMat, brassMat, chromeMat, disposables);
  naclCathodeClamp.position.set(0.52, 0.69, 0.08);
  naclCathodeClamp.rotation.y = Math.PI;
  s3.add(naclCathodeClamp);
  registerObjectHitbox(s3, 'nacl-cathode', 0.22, 0.62, 0.22, 0.52, 0.38, 0.08);

  // --- Variant B: Brine Two-Compartment Glass Tank + Central Cation-Exchange Membrane ---
  const naclBrineGroup = new THREE.Group();
  naclBrineGroup.position.set(0.22, 0, 0.08);
  s3.add(naclBrineGroup);

  const tankW = 1.16;
  const tankH = 0.54;
  const tankD = 0.52;
  const tankGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xdff5fa,
    roughness: 0.06,
    metalness: 0.04,
    ior: 1.48,
    thickness: 0.12,
    transmission: isSoftwareGl ? 0 : 0.68,
    transparent: true,
    opacity: isSoftwareGl ? 0.2 : 0.94,
    clearcoat: 1.0,
    side: THREE.FrontSide,
    depthWrite: false,
    clippingPlanes: [cutawayClipPlane],
  });
  glassMaterials.push(tankGlassMat);
  const tankGeo = new THREE.BoxGeometry(tankW, tankH, tankD);
  const tankMesh = new THREE.Mesh(tankGeo, tankGlassMat);
  tankMesh.position.y = tankH / 2 + 0.03;
  tankMesh.renderOrder = 5;
  naclBrineGroup.add(tankMesh);

  // Sleek anodized aluminum base + slim open top perimeter rim (never blocks view of brine/membrane!)
  const tankBaseGeo = createRoundedSlabGeometry(tankW + 0.08, tankD + 0.08, 0.04, 0.03, 0.006, 0.006);
  const tankBase = new THREE.Mesh(tankBaseGeo, steelFrameMat);
  tankBase.position.y = 0.02;
  naclBrineGroup.add(tankBase);

  const tankRimLongGeo = new THREE.BoxGeometry(tankW + 0.04, 0.024, 0.024);
  const tankRimShortGeo = new THREE.BoxGeometry(0.024, 0.024, tankD + 0.04);
  for (const rz of [-tankD / 2, tankD / 2]) {
    const r = new THREE.Mesh(tankRimLongGeo, chromeMat);
    r.position.set(0, tankH + 0.032, rz);
    naclBrineGroup.add(r);
  }
  for (const rx of [-tankW / 2, tankW / 2]) {
    const r = new THREE.Mesh(tankRimShortGeo, chromeMat);
    r.position.set(rx, tankH + 0.032, 0);
    naclBrineGroup.add(r);
  }

  // Clear polycarbonate gas-hood bridge bar carrying the two chrome gas outlets
  const tankLidGeo = new THREE.BoxGeometry(tankW - 0.08, 0.018, 0.14);
  const tankLid = new THREE.Mesh(tankLidGeo, tankGlassMat);
  tankLid.position.set(0, tankH + 0.042, -0.14);
  naclBrineGroup.add(tankLid);

  const outletGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.09, 14);
  for (const ox of [-0.32, 0.32]) {
    const out = new THREE.Mesh(outletGeo, chromeMat);
    out.position.set(ox, tankH + 0.088, -0.14);
    naclBrineGroup.add(out);
  }

  const brineLiqGeo = new THREE.BoxGeometry(tankW - 0.06, tankH * 0.72, tankD - 0.06);
  const brineLiqMat = new THREE.MeshPhysicalMaterial({
    color: 0x24b4cc,
    emissive: 0x0b5f73,
    emissiveIntensity: 0.42,
    roughness: 0.1,
    clearcoat: 0.6,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    clippingPlanes: [cutawayClipPlane],
  });
  const brineLiq = new THREE.Mesh(brineLiqGeo, brineLiqMat);
  brineLiq.position.y = (tankH * 0.72) / 2 + 0.04;
  brineLiq.renderOrder = 2;
  naclBrineGroup.add(brineLiq);

  const memGeo = new THREE.BoxGeometry(0.03, tankH - 0.04, tankD - 0.04);
  const memMat = new THREE.MeshStandardMaterial({
    color: 0xbff7ec,
    emissive: 0x3ec4ab,
    emissiveIntensity: 0.54,
    roughness: 0.28,
    transparent: true,
    opacity: 0.86,
  });
  const memMesh = new THREE.Mesh(memGeo, memMat);
  memMesh.position.y = tankH / 2 + 0.03;
  memMesh.renderOrder = 4;
  naclBrineGroup.add(memMesh);
  disposables.push(
    tankGeo, tankGlassMat, tankBaseGeo, tankRimLongGeo, tankRimShortGeo, tankLidGeo, outletGeo,
    brineLiqGeo, brineLiqMat, memGeo, memMat
  );

  // --- Variant A: Molten NaCl Refractory Heated Vessel (NO membrane, NO water!) ---
  const naclMoltenGroup = new THREE.Group();
  naclMoltenGroup.position.set(0.22, 0, 0.08);
  naclMoltenGroup.visible = false;
  s3.add(naclMoltenGroup);

  const crucibleGeo = createRoundedBoxGeometry(1.12, 0.48, 0.54, 0.04, 0.012);
  const crucibleMat = new THREE.MeshStandardMaterial({
    color: 0x3e3733,
    roughness: 0.82,
    metalness: 0.18,
    bumpMap: wallPbr.bumpMap,
    bumpScale: 0.014,
  });
  const crucible = new THREE.Mesh(crucibleGeo, crucibleMat);
  crucible.position.y = 0.24;
  crucible.castShadow = true;
  naclMoltenGroup.add(crucible);

  const moltenSaltGeo = new THREE.BoxGeometry(1.0, 0.14, 0.44);
  const moltenSaltMat = new THREE.MeshStandardMaterial({
    color: 0xe69244,
    emissive: 0xc95e1a,
    emissiveIntensity: 0.82,
    roughness: 0.28,
  });
  const moltenSalt = new THREE.Mesh(moltenSaltGeo, moltenSaltMat);
  moltenSalt.position.y = 0.42;
  naclMoltenGroup.add(moltenSalt);

  const heaterBandGeo = new THREE.BoxGeometry(1.16, 0.06, 0.58);
  const heaterBandMat = new THREE.MeshStandardMaterial({
    color: 0xd96b27,
    emissive: 0xc24c14,
    emissiveIntensity: 0.72,
    roughness: 0.38,
  });
  const heaterBand = new THREE.Mesh(heaterBandGeo, heaterBandMat);
  heaterBand.position.y = 0.08;
  naclMoltenGroup.add(heaterBand);
  disposables.push(crucibleGeo, crucibleMat, moltenSaltGeo, moltenSaltMat, heaterBandGeo, heaterBandMat);

  registerObjectHitbox(s3, 'nacl-cell', 1.24, 0.62, 0.62, 0.22, 0.32, 0.08);
  registerObjectHitbox(s3, 'nacl-electrolyte', 1.0, 0.34, 0.46, 0.22, 0.24, 0.08);
  const naclMembraneHitbox = registerObjectHitbox(s3, 'nacl-membrane', 0.16, 0.56, 0.54, 0.22, 0.32, 0.08);

  const naclWireCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.08, 0.72, 0.08),
    new THREE.Vector3(-0.22, 0.86, 0.02),
    new THREE.Vector3(-0.52, 0.54, 0.06),
    new THREE.Vector3(-0.72, 0.14, 0.08),
    new THREE.Vector3(-0.6, 0.14, 0.08),
    new THREE.Vector3(-0.1, 0.82, -0.22),
    new THREE.Vector3(0.42, 0.88, -0.06),
    new THREE.Vector3(0.52, 0.72, 0.08),
  ]);
  const s3WireGeo = new THREE.TubeGeometry(naclWireCurve, 48, 0.013, 10, false);
  s3.add(new THREE.Mesh(s3WireGeo, blackWireMat));
  const s3WireGlowGeo = new THREE.TubeGeometry(naclWireCurve, 36, 0.024, 8, false);
  const naclWireGlowMesh = new THREE.Mesh(s3WireGlowGeo, wireGlowMat);
  naclWireGlowMesh.visible = false;
  s3.add(naclWireGlowMesh);
  disposables.push(s3WireGeo, s3WireGlowGeo);

  const naclElectrons: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i += 1) {
    const m = new THREE.Mesh(orbGeo, electronMat);
    m.visible = false;
    s3.add(m);
    naclElectrons.push(m);
  }
  const naclCl2Bubbles: THREE.Mesh[] = [];
  const naclH2Bubbles: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i += 1) {
    const cl2 = new THREE.Mesh(bubbleGeo, cl2BubbleMat);
    cl2.visible = false;
    s3.add(cl2);
    naclCl2Bubbles.push(cl2);

    const h2 = new THREE.Mesh(bubbleGeo, h2BubbleMat);
    h2.visible = false;
    s3.add(h2);
    naclH2Bubbles.push(h2);
  }
  const naclNaDrops: THREE.Mesh[] = [];
  const naDropGeo = new THREE.SphereGeometry(0.036, 12, 12);
  disposables.push(naDropGeo);
  for (let i = 0; i < 6; i += 1) {
    const d = new THREE.Mesh(naDropGeo, naMetalMat);
    d.visible = false;
    s3.add(d);
    naclNaDrops.push(d);
  }
  const naclNaIons: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i += 1) {
    const ion = new THREE.Mesh(ionGeo, no3IonMat);
    ion.visible = false;
    s3.add(ion);
    naclNaIons.push(ion);
  }

  // =========================================================================
  // 4. MICROSCOPIC 3D RIG (INSTANCED IONS, HYDRATION SHELLS, LATTICE, ARROWS)
  // =========================================================================
  const microGroup = new THREE.Group();
  microGroup.visible = false;
  scene.add(microGroup);

  const microRingGeo = new THREE.TorusGeometry(0.32, 0.008, 10, 40);
  const microRingMat = new THREE.MeshBasicMaterial({
    color: 0x78d4c4,
    transparent: true,
    opacity: 0.72,
  });
  const microRing = new THREE.Mesh(microRingGeo, microRingMat);
  microRing.renderOrder = 16;
  microGroup.add(microRing);

  const microIonGeo = new THREE.SphereGeometry(1, isSoftwareGl ? 10 : 14, isSoftwareGl ? 8 : 12);
  const microIonMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.22,
    metalness: 0.15,
    emissive: 0x10282e,
    emissiveIntensity: 0.35,
  });
  const microIonMesh = new THREE.InstancedMesh(microIonGeo, microIonMat, MICRO_MAX_PARTICLES);
  microIonMesh.count = 0;
  microIonMesh.frustumCulled = false;
  microIonMesh.renderOrder = 12;
  microGroup.add(microIonMesh);

  const microHydrationGeo = new THREE.SphereGeometry(1, 10, 8);
  const microHydrationMat = new THREE.MeshBasicMaterial({
    color: 0x8be4f5,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  const microHydrationMesh = new THREE.InstancedMesh(
    microHydrationGeo,
    microHydrationMat,
    MICRO_MAX_PARTICLES
  );
  microHydrationMesh.count = 0;
  microHydrationMesh.frustumCulled = false;
  microHydrationMesh.renderOrder = 13;
  microGroup.add(microHydrationMesh);

  const microLatticeGeo = new THREE.SphereGeometry(0.022, 10, 8);
  const microLatticeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.24,
    metalness: 0.88,
  });
  const microLatticeMesh = new THREE.InstancedMesh(
    microLatticeGeo,
    microLatticeMat,
    MICRO_MAX_LATTICE
  );
  microLatticeMesh.count = 0;
  microLatticeMesh.frustumCulled = false;
  microLatticeMesh.renderOrder = 11;
  microGroup.add(microLatticeMesh);

  const microArrows: THREE.Group[] = [];
  const arrowShaftGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.12, 8);
  const arrowHeadGeo = new THREE.ConeGeometry(0.016, 0.042, 10);
  const arrowMintMat = new THREE.MeshBasicMaterial({ color: 0x78d4c4 });
  const arrowCopperMat = new THREE.MeshBasicMaterial({ color: 0xf0a05a });
  for (let i = 0; i < 6; i += 1) {
    const ag = new THREE.Group();
    const mat = i % 2 === 0 ? arrowMintMat : arrowCopperMat;
    const shaft = new THREE.Mesh(arrowShaftGeo, mat);
    shaft.rotation.z = -Math.PI / 2;
    shaft.position.x = -0.02;
    const head = new THREE.Mesh(arrowHeadGeo, mat);
    head.rotation.z = -Math.PI / 2;
    head.position.x = 0.055;
    ag.add(shaft, head);
    ag.visible = false;
    microGroup.add(ag);
    microArrows.push(ag);
  }

  // =========================================================================
  // 5. MACRO OBSERVATION 3D RIG (DIRECTIONAL CHEVRONS + REACTION-ZONE RINGS)
  // =========================================================================
  const macroChevronGeo = new THREE.ConeGeometry(0.032, 0.088, 10);
  const macroEArrowMat = new THREE.MeshStandardMaterial({
    color: 0x9cf7e6,
    emissive: 0x4cdbc4,
    emissiveIntensity: 1.25,
    roughness: 0.2,
  });
  const macroIonMintMat = new THREE.MeshStandardMaterial({
    color: 0x78d4c4,
    emissive: 0x3eb39f,
    emissiveIntensity: 1.0,
    roughness: 0.25,
  });
  const macroIonAmberMat = new THREE.MeshStandardMaterial({
    color: 0xf4b270,
    emissive: 0xc97b38,
    emissiveIntensity: 1.0,
    roughness: 0.25,
  });

  const macroElectronArrows: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i += 1) {
    const cone = new THREE.Mesh(macroChevronGeo, macroEArrowMat);
    cone.visible = false;
    cone.renderOrder = 14;
    scene.add(cone);
    macroElectronArrows.push(cone);
  }

  const macroIonArrows: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i += 1) {
    const cone = new THREE.Mesh(macroChevronGeo, i < 2 ? macroIonMintMat : macroIonAmberMat);
    cone.scale.setScalar(0.84);
    cone.visible = false;
    cone.renderOrder = 14;
    scene.add(cone);
    macroIonArrows.push(cone);
  }

  const macroZoneRingGeo = new THREE.TorusGeometry(0.18, 0.01, 10, 32);
  const macroZoneAnodeMat = new THREE.MeshBasicMaterial({
    color: 0xe8a86d,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  const macroZoneCathodeMat = new THREE.MeshBasicMaterial({
    color: 0x78d4c4,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  const macroReactionRings: THREE.Mesh[] = [
    new THREE.Mesh(macroZoneRingGeo, macroZoneAnodeMat),
    new THREE.Mesh(macroZoneRingGeo, macroZoneCathodeMat),
  ];
  for (const ring of macroReactionRings) {
    ring.rotation.x = Math.PI / 2;
    ring.visible = false;
    ring.renderOrder = 15;
    scene.add(ring);
  }

  disposables.push(
    microRingGeo, microRingMat, microIonGeo, microIonMat,
    microHydrationGeo, microHydrationMat, microLatticeGeo, microLatticeMat,
    arrowShaftGeo, arrowHeadGeo, arrowMintMat, arrowCopperMat,
    macroChevronGeo, macroEArrowMat, macroIonMintMat, macroIonAmberMat,
    macroZoneRingGeo, macroZoneAnodeMat, macroZoneCathodeMat
  );

  return {
    scene,
    hemiLight,
    keyLight,
    windowFill,
    rimLight,
    practiceLampLight,
    practiceLampBulbMat,
    focusSpotLight,
    sunShaftMaterials,
    sunPatchMaterials,
    sunDustPoints,
    sunDustBasePositions: dustBasePositions,
    glassMaterials,
    wallClock,
    zoneHitboxes,
    tableHitboxes,
    objectHitboxes,
    occlusionMeshes,
    tableRimMaterials,
    tableLedMaterials,
    objectHighlightMaterials,
    boardBezelMat,
    practiceRimMat,
    practicePagePivot,
    practiceStackTopGroup,
    cutawayClipPlane,
    microGroup,
    microRing,
    microIonMesh,
    microHydrationMesh,
    microLatticeMesh,
    microArrows,
    macroElectronArrows,
    macroIonArrows,
    macroReactionRings,
    znCuSwitchPivot,
    znCuSwitchLedMat,
    znCuVoltmeterDisplay,
    znCuZnPlate,
    znCuCuPlating,
    znCuCuPlatingMat,
    znCuCuSolutionMat: cuBeaker.liquidMat,
    znCuWireCurve,
    znCuWireGlowMesh,
    znCuElectrons,
    znCuKCurve,
    znCuNO3Curve,
    znCuKIons,
    znCuNO3Ions,
    cuso4Display,
    cuso4SolutionMat: cuso4Cell.liquidMat,
    cuso4CathodePlating,
    cuso4CathodePlatingMat,
    cuso4AnodeGraphite,
    cuso4AnodeCopper,
    cuso4WireCurve,
    cuso4WireGlowMesh,
    cuso4Electrons,
    cuso4O2Bubbles,
    cuso4H2Bubbles,
    naclDisplay,
    naclBrineGroup,
    naclMoltenGroup,
    naclMembraneHitbox,
    naclWireCurve,
    naclWireGlowMesh,
    naclElectrons,
    naclCl2Bubbles,
    naclH2Bubbles,
    naclNaDrops,
    naclNaIons,
    disposables,
  };
}

/**
 * Applies GPU-tier material capabilities (transmission & envMapIntensity) without remounting WebGL.
 */
export function applyLabGraphicsTierMaterials(
  rig: LabSceneRig,
  opts: {
    transmissionEnabled: boolean;
    envMapIntensity: number;
    sunShaftOpacity: number;
  }
): void {
  for (const gMat of rig.glassMaterials) {
    // Keep transmission disabled on nested-liquid vessels so Three.js opaque-only transmission pass never hides inner CuSO4 or Cu electrodes
    gMat.transmission = 0;
    gMat.opacity = 0.16;
    gMat.clearcoat = opts.transmissionEnabled ? 0.95 : 0.72;
    gMat.reflectivity = opts.transmissionEnabled ? 0.85 : 0.65;
    gMat.envMapIntensity = opts.transmissionEnabled ? 0.85 : 0.55;
    gMat.needsUpdate = true;
  }
  for (const sMat of rig.sunShaftMaterials) {
    const base = (sMat.userData.baseOpacity as number) ?? 0.11;
    sMat.uniforms.uOpacity.value = base * opts.sunShaftOpacity;
  }
  for (const pMat of rig.sunPatchMaterials) {
    const base = (pMat.userData.baseOpacity as number) ?? 0.18;
    pMat.opacity = base * Math.max(0.45, opts.sunShaftOpacity);
  }
}

/**
 * Deterministically updates every 3D visual element from the single source of truth (`Lab3DVisuals`)
 * plus V4 sunlit dust drift, live wall clock, toggleable practice lamp, Focus Reaction lighting,
 * cutaway clipping, and Microscopic InstancedMesh. Zero per-frame heap allocations.
 */
export function updateLabSceneVisuals(
  rig: LabSceneRig,
  visuals: Lab3DVisuals,
  hoveredTable: LabExperimentId | null,
  selectedTable: LabExperimentId | null,
  hoveredObject: LabObjectId | null,
  selectedObject: LabObjectId | null,
  world?: WorldVisualOptions
): void {
  const macro = world?.macroOptions ?? DEFAULT_MACRO_OPTIONS;
  const inMacroView =
    world !== undefined &&
    selectedTable !== null &&
    (world.zone === 'TABLE' || world.zone === 'REACTION' || world.zone === 'OBJECT');

  // 0. Live real-time wall clock & gentle sunlit dust mote drift
  if (world?.clockTimeMs !== undefined) {
    const tSec = world.clockTimeMs * 0.001;
    const posAttr = rig.sunDustPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
    const base = rig.sunDustBasePositions;
    for (let i = 0; i < posAttr.count; i += 1) {
      const i3 = i * 3;
      const phase = i * 0.73;
      posAttr.setXYZ(
        i,
        base[i3] + Math.sin(tSec * 0.35 + phase) * 0.11,
        base[i3 + 1] + Math.cos(tSec * 0.28 + phase * 1.3) * 0.08,
        base[i3 + 2] + Math.sin(tSec * 0.22 + phase * 0.9) * 0.1
      );
    }
    posAttr.needsUpdate = true;
    rig.wallClock.update(new Date());
  }

  // 0b. Smart Board, Practice Desk lamp toggle & hover lift, Focus Reaction lighting
  if (world) {
    const boardActive = world.zone === 'BOARD' || world.hoveredZone === 'BOARD';
    rig.boardBezelMat.color.copy(boardActive ? _colorMint : _colorDimBorder);
    rig.boardBezelMat.emissive.copy(boardActive ? _colorMint : _colorDimBorder);
    rig.boardBezelMat.emissiveIntensity = world.zone === 'BOARD' ? 0.78 : boardActive ? 0.48 : 0.18;

    const practiceHovered = world.hoveredZone === 'PRACTICE';
    const practiceFocused = world.zone === 'PRACTICE';
    const practiceActive = practiceFocused || practiceHovered;
    rig.practiceRimMat.color.copy(practiceActive ? _colorCopper : _colorDimBorder);
    rig.practiceRimMat.emissive.copy(practiceActive ? _colorCopper : _colorDimBorder);
    rig.practiceRimMat.emissiveIntensity = practiceFocused ? 0.72 : practiceHovered ? 0.48 : 0.14;

    const lampOn = world.practiceLampOn !== false;
    rig.practiceLampLight.intensity = !lampOn
      ? 0
      : practiceFocused
        ? 1.1
        : practiceHovered
          ? 0.95
          : 0.78;
    rig.practiceLampBulbMat.color.setHex(lampOn ? 0xf5d79b : 0x56544e);

    const hoverLift = practiceHovered ? 0.018 : 0;
    rig.practiceStackTopGroup.position.y =
      TABLE_TOP_Y + 0.082 + Math.max(world.practiceOpenLift * 0.024, hoverLift);
    if (world.practiceFlipAngle > 0.01 && world.practiceFlipAngle < Math.PI - 0.01) {
      rig.practicePagePivot.visible = true;
      rig.practicePagePivot.rotation.z = world.practiceFlipAngle;
    } else {
      rig.practicePagePivot.visible = false;
      rig.practicePagePivot.rotation.z = 0;
    }

    // Focus Reaction mode: softly dim peripheral room sunlight and spotlight the active reacting cell
    const focusActive = inMacroView && macro.focusReaction && selectedTable !== null;
    if (focusActive && selectedTable) {
      const tb = TABLE_POSITIONS[selectedTable];
      rig.hemiLight.intensity = 0.26;
      rig.windowFill.intensity = 0.18;
      rig.keyLight.intensity = 0.72;
      rig.rimLight.intensity = 0.2;
      rig.focusSpotLight.position.set(tb.x, TABLE_TOP_Y + 1.4, tb.z + 0.45);
      rig.focusSpotLight.intensity = 1.15;
    } else {
      rig.hemiLight.intensity = 0.52;
      rig.windowFill.intensity = 0.36;
      rig.keyLight.intensity = 1.48;
      rig.rimLight.intensity = 0.42;
      rig.focusSpotLight.intensity = 0;
    }

    // Cutaway clipping plane — strictly active ONLY inside MICRO mode when cutaway is enabled
    const enableClip = world.zone === 'MICRO' && world.cutawayActive;
    if (enableClip) {
      const activeStation = world.microFrame?.station ?? selectedTable ?? 'pin-zn-cu';
      const baseZ = TABLE_POSITIONS[activeStation].z;
      rig.cutawayClipPlane.constant = baseZ + 0.11;
    } else {
      rig.cutawayClipPlane.constant = 100;
    }

    // Microscopic 3D Rig
    const showMicro = world.zone === 'MICRO' && world.microFrame !== null;
    rig.microGroup.visible = showMicro;
    if (showMicro && world.microFrame) {
      const mf = world.microFrame;
      const meta = MICRO_ZONES[mf.zone];
      const base = TABLE_POSITIONS[meta.station];

      rig.microRing.visible = world.microShowReactionZone;
      rig.microRing.position.set(
        base.x + meta.focusCenterLocal.x,
        base.y + meta.focusCenterLocal.y,
        base.z + meta.focusCenterLocal.z + 0.09
      );
      const rScale = meta.ringRadius / 0.32;
      rig.microRing.scale.setScalar(rScale);

      const pCount = Math.min(MICRO_MAX_PARTICLES, mf.particles.length);
      rig.microIonMesh.count = pCount;
      let hydCount = 0;

      for (let i = 0; i < pCount; i += 1) {
        const p = mf.particles[i];
        const spMeta = MICRO_SPECIES_META[p.species];
        const radius = spMeta.radius * p.scale;

        _tmpDummy.position.set(p.position.x, p.position.y, p.position.z);
        _tmpDummy.rotation.set(0, 0, 0);
        _tmpDummy.scale.setScalar(radius);
        _tmpDummy.updateMatrix();
        rig.microIonMesh.setMatrixAt(i, _tmpDummy.matrix);

        _tmpColor.setHex(spMeta.colorHex);
        if (!p.highlighted) {
          _tmpColor.lerp(_colorDimParticle, 0.72);
        }
        rig.microIonMesh.setColorAt(i, _tmpColor);

        if (world.microShowHydration && p.hydrated && p.highlighted) {
          _tmpDummy.scale.setScalar(radius * 1.55);
          _tmpDummy.updateMatrix();
          rig.microHydrationMesh.setMatrixAt(hydCount, _tmpDummy.matrix);
          hydCount += 1;
        }
      }
      rig.microIonMesh.instanceMatrix.needsUpdate = true;
      if (rig.microIonMesh.instanceColor) {
        rig.microIonMesh.instanceColor.needsUpdate = true;
      }
      rig.microHydrationMesh.count = hydCount;
      rig.microHydrationMesh.visible = hydCount > 0;
      if (hydCount > 0) {
        rig.microHydrationMesh.instanceMatrix.needsUpdate = true;
      }

      const showLattice =
        mf.zone === 'zncu-zn' ||
        mf.zone === 'zncu-cu' ||
        mf.zone === 'cuso4-cathode' ||
        (mf.zone === 'cuso4-anode' && visuals.cuso4.variant === 'cuso4-copper');
      if (showLattice) {
        const isZinc = mf.zone === 'zncu-zn';
        _tmpColor.setHex(isZinc ? 0xc8d4da : 0xd97542);
        const anchorX =
          mf.zone === 'zncu-zn'
            ? base.x - 0.64
            : mf.zone === 'zncu-cu'
              ? base.x + 0.64
              : mf.zone === 'cuso4-cathode'
                ? base.x - 0.46
                : base.x - 0.04;
        const anchorZ = base.z + (mf.station === 'pin-zn-cu' ? 0.04 : 0.08);
        let latIdx = 0;
        for (let row = 0; row < 6 && latIdx < MICRO_MAX_LATTICE; row += 1) {
          for (let col = 0; col < 5 && latIdx < MICRO_MAX_LATTICE; col += 1) {
            const lx = anchorX + (col - 2) * 0.032;
            const ly = TABLE_TOP_Y + 0.14 + row * 0.046;
            const lz = anchorZ + 0.024;
            _tmpDummy.position.set(lx, ly, lz);
            _tmpDummy.scale.setScalar(1);
            _tmpDummy.updateMatrix();
            rig.microLatticeMesh.setMatrixAt(latIdx, _tmpDummy.matrix);
            rig.microLatticeMesh.setColorAt(latIdx, _tmpColor);
            latIdx += 1;
          }
        }
        rig.microLatticeMesh.count = latIdx;
        rig.microLatticeMesh.visible = true;
        rig.microLatticeMesh.instanceMatrix.needsUpdate = true;
        if (rig.microLatticeMesh.instanceColor) {
          rig.microLatticeMesh.instanceColor.needsUpdate = true;
        }
      } else {
        rig.microLatticeMesh.count = 0;
        rig.microLatticeMesh.visible = false;
      }

      for (let i = 0; i < rig.microArrows.length; i += 1) {
        const arr = rig.microArrows[i];
        arr.visible = world.microShowArrows && i < 4;
        if (arr.visible) {
          const cx = base.x + meta.focusCenterLocal.x;
          const cy = base.y + meta.focusCenterLocal.y;
          const cz = base.z + meta.focusCenterLocal.z + 0.07;
          if (mf.zone === 'zncu-bridge') {
            const isTop = i < 2;
            arr.position.set(cx + (i % 2 === 0 ? -0.14 : 0.14), cy + (isTop ? 0.1 : -0.06), cz);
            arr.rotation.set(0, 0, isTop ? 0 : Math.PI);
          } else if (mf.zone === 'zncu-zn') {
            const isElectron = i === 0;
            arr.position.set(
              isElectron ? cx : cx + 0.14,
              isElectron ? cy + 0.14 : cy - 0.08 + i * 0.07,
              cz
            );
            arr.rotation.set(0, 0, isElectron ? Math.PI / 2 : 0);
          } else if (mf.zone === 'zncu-cu' || mf.zone === 'cuso4-cathode') {
            const isElectron = i === 0;
            arr.position.set(
              isElectron ? cx : cx + (mf.zone === 'zncu-cu' ? -0.14 : 0.14),
              isElectron ? cy + 0.14 : cy - 0.08 + i * 0.07,
              cz
            );
            arr.rotation.set(0, 0, isElectron ? -Math.PI / 2 : mf.zone === 'zncu-cu' ? 0 : Math.PI);
          } else {
            const goRight = i % 2 === 0;
            arr.position.set(cx + (goRight ? 0.04 : -0.12), cy - 0.06 + i * 0.055, cz);
            arr.rotation.set(0, 0, goRight ? 0 : Math.PI);
          }
        }
      }
    }
  }

  // 1. Table rim & under-lip LED highlight feedback
  const stations: LabExperimentId[] = ['pin-zn-cu', 'dien-phan-cuso4', 'dien-phan-nacl'];
  for (const st of stations) {
    const isSel = selectedTable === st;
    const isHov = hoveredTable === st;
    const rim = rig.tableRimMaterials[st];
    const led = rig.tableLedMaterials[st];
    if (isSel) {
      rim.color.copy(_colorMint);
      rim.emissive.copy(_colorMint);
      rim.emissiveIntensity = 0.36;
      led.emissive.copy(_colorMint);
      led.emissiveIntensity = 0.68;
    } else if (isHov) {
      rim.color.copy(_colorMint);
      rim.emissive.copy(_colorMint);
      rim.emissiveIntensity = 0.24;
      led.emissive.copy(_colorMint);
      led.emissiveIntensity = 0.48;
    } else {
      rim.color.copy(_colorDimBorder);
      rim.emissive.setHex(0x000000);
      rim.emissiveIntensity = 0;
      led.emissive.setHex(0x3ab29e);
      led.emissiveIntensity = 0.3;
    }
  }

  // 2. Object selection / hover / visual-quiz highlight
  const quizCands = world?.visualQuizCandidates;
  const quizSel = world?.visualQuizSelected;
  for (const key of Object.keys(rig.objectHighlightMaterials) as LabObjectId[]) {
    const mat = rig.objectHighlightMaterials[key];
    if (!mat) continue;
    if (quizCands && quizCands.length > 0) {
      if (quizSel === key) {
        mat.color.setHex(0xc77b4c);
        mat.opacity = 0.95;
      } else if (hoveredObject === key && quizCands.includes(key)) {
        mat.color.setHex(0x78d4c4);
        mat.opacity = 0.85;
      } else if (quizCands.includes(key)) {
        mat.color.setHex(0x78d4c4);
        mat.opacity = 0.35;
      } else {
        mat.opacity = 0;
      }
    } else {
      mat.color.setHex(0x78d4c4);
      if (selectedObject === key) {
        mat.opacity = 0.9;
      } else if (hoveredObject === key) {
        mat.opacity = 0.45;
      } else {
        mat.opacity = 0;
      }
    }
  }

  // 3. Station 1: Pin Zn-Cu
  const zn = visuals.znCu;
  rig.znCuSwitchPivot.rotation.z = zn.switchLeverAngleRad;
  rig.znCuSwitchLedMat.color.setHex(zn.circuitClosed ? 0x4ef2b8 : 0xe8a85a);
  rig.znCuVoltmeterDisplay.draw(
    zn.voltmeterText,
    zn.circuitClosed ? 'Mạch đóng · Tải 100 Ω' : 'Mạch mở · E°pin',
    zn.circuitClosed ? '#78D4C4' : '#E8B17E'
  );
  rig.znCuZnPlate.scale.set(zn.znThinScale, 1, 1);
  rig.znCuCuPlating.visible = zn.cuPlatingScale > 0.01;
  rig.znCuCuPlating.scale.set(1, 1, Math.max(0.08, zn.cuPlatingScale));
  rig.znCuCuPlatingMat.roughness = Math.max(0.14, 0.34 - zn.cuPlatingScale * 0.2);

  _tmpColor.copy(_colorBlueClear).lerp(_colorBlueRich, zn.cuSolutionBlueRatio);
  rig.znCuCuSolutionMat.color.copy(_tmpColor);
  rig.znCuCuSolutionMat.opacity = 0.24 + zn.cuSolutionBlueRatio * 0.16;

  const znShowElectrons = zn.electronsActive && (!inMacroView || macro.showElectronFlow);
  const znShowIons = zn.ionsActive && (!inMacroView || macro.showIonFlow);
  rig.znCuWireGlowMesh.visible =
    zn.circuitClosed &&
    macro.showElectronFlow &&
    (zn.electronsActive || (inMacroView && selectedTable === 'pin-zn-cu'));

  for (let i = 0; i < rig.znCuElectrons.length; i += 1) {
    const orb = rig.znCuElectrons[i];
    orb.visible = znShowElectrons;
    if (znShowElectrons) {
      const u = (zn.electronPhase + i / rig.znCuElectrons.length) % 1;
      rig.znCuWireCurve.getPointAt(u, _tmpVec3);
      orb.position.copy(_tmpVec3);
    }
  }
  for (let i = 0; i < rig.znCuKIons.length; i += 1) {
    const kIon = rig.znCuKIons[i];
    const no3Ion = rig.znCuNO3Ions[i];
    kIon.visible = znShowIons;
    no3Ion.visible = znShowIons;
    if (znShowIons) {
      const u = (zn.electronPhase * 0.7 + i / rig.znCuKIons.length) % 1;
      rig.znCuKCurve.getPointAt(u, _tmpVec3);
      kIon.position.set(_tmpVec3.x, _tmpVec3.y + 0.014, _tmpVec3.z + 0.015);

      const u2 = (zn.electronPhase * 0.7 + (i + 0.5) / rig.znCuNO3Ions.length) % 1;
      rig.znCuNO3Curve.getPointAt(u2, _tmpVec3);
      no3Ion.position.set(_tmpVec3.x, _tmpVec3.y - 0.014, _tmpVec3.z - 0.015);
    }
  }

  // 4. Station 2: CuSO4 Electrolysis
  const cu = visuals.cuso4;
  rig.cuso4Display.draw(
    cu.powerVoltageText,
    `I = ${cu.powerCurrentText}`,
    cu.inStage2 ? '#F0B37A' : '#78D4C4'
  );
  _tmpColor.copy(_colorBlueClear).lerp(_colorBlueRich, cu.solutionBlueRatio);
  rig.cuso4SolutionMat.color.copy(_tmpColor);
  rig.cuso4SolutionMat.opacity = 0.22 + cu.solutionBlueRatio * 0.22;

  rig.cuso4CathodePlating.visible = cu.cathodeCuThickness > 0.01;
  const sleeveRadiusScale = 0.65 + cu.cathodeCuThickness * 0.55;
  rig.cuso4CathodePlating.scale.set(sleeveRadiusScale, 1, sleeveRadiusScale);
  rig.cuso4CathodePlatingMat.roughness = Math.max(0.14, 0.34 - cu.cathodeCuThickness * 0.2);

  const isCopperAnode = cu.variant === 'cuso4-copper';
  rig.cuso4AnodeGraphite.visible = !isCopperAnode;
  rig.cuso4AnodeCopper.visible = isCopperAnode;
  if (isCopperAnode) {
    rig.cuso4AnodeCopper.scale.set(cu.anodeCuRemainingRatio, 1, 1);
  }
  rig.cuso4WireGlowMesh.visible =
    macro.showElectronFlow &&
    (cu.electronsActive || (inMacroView && selectedTable === 'dien-phan-cuso4'));

  for (let i = 0; i < rig.cuso4Electrons.length; i += 1) {
    const orb = rig.cuso4Electrons[i];
    const active = cu.electronsActive && (!inMacroView || macro.showElectronFlow) && i < cu.wireParticleCount;
    orb.visible = active;
    if (active) {
      const u = (cu.electronPhase + i / cu.wireParticleCount) % 1;
      rig.cuso4WireCurve.getPointAt(u, _tmpVec3);
      orb.position.copy(_tmpVec3);
    }
  }

  const bubbleClockCu = cu.timeSeconds * 0.025 * cu.electronSpeedMultiplier;
  for (let i = 0; i < rig.cuso4O2Bubbles.length; i += 1) {
    const b = rig.cuso4O2Bubbles[i];
    const show = cu.o2BubbleIntensity > 0 && i < Math.ceil(cu.o2BubbleIntensity * rig.cuso4O2Bubbles.length);
    b.visible = show;
    if (show) {
      const cycle = (bubbleClockCu + seededFrac(i + 11)) % 1;
      const angle = seededFrac(i + 37) * Math.PI * 2;
      const rad = 0.045 + seededFrac(i + 53) * 0.04;
      b.position.set(
        -0.04 + Math.cos(angle) * rad,
        0.16 + cycle * 0.32,
        0.08 + Math.sin(angle) * rad
      );
      b.scale.setScalar(0.7 + (1 - cycle) * 0.55);
    }
  }
  for (let i = 0; i < rig.cuso4H2Bubbles.length; i += 1) {
    const b = rig.cuso4H2Bubbles[i];
    const show = cu.h2BubbleIntensity > 0 && i < Math.ceil(cu.h2BubbleIntensity * rig.cuso4H2Bubbles.length);
    b.visible = show;
    if (show) {
      const cycle = (bubbleClockCu * 1.15 + seededFrac(i + 101)) % 1;
      const angle = seededFrac(i + 137) * Math.PI * 2;
      const rad = 0.052 + seededFrac(i + 173) * 0.042;
      b.position.set(
        -0.46 + Math.cos(angle) * rad,
        0.16 + cycle * 0.32,
        0.08 + Math.sin(angle) * rad
      );
      b.scale.setScalar(0.75 + (1 - cycle) * 0.5);
    }
  }

  // 5. Station 3: NaCl Electrolysis
  const na = visuals.nacl;
  rig.naclDisplay.draw(
    na.powerVoltageText,
    `I = ${na.powerCurrentText}`,
    na.variant === 'nacl-molten' ? '#F0B37A' : '#78D4C4'
  );
  rig.naclBrineGroup.visible = na.showMembrane;
  rig.naclMoltenGroup.visible = !na.showMembrane;
  rig.naclMembraneHitbox.visible = false;

  for (let i = 0; i < rig.naclElectrons.length; i += 1) {
    const orb = rig.naclElectrons[i];
    const active = na.electronsActive && (!inMacroView || macro.showElectronFlow) && i < na.wireParticleCount;
    orb.visible = active;
    if (active) {
      const u = (na.electronPhase + i / na.wireParticleCount) % 1;
      rig.naclWireCurve.getPointAt(u, _tmpVec3);
      orb.position.copy(_tmpVec3);
    }
  }

  const bubbleClockNa = na.timeSeconds * 0.028 * na.electronSpeedMultiplier;
  for (let i = 0; i < rig.naclCl2Bubbles.length; i += 1) {
    const b = rig.naclCl2Bubbles[i];
    const show = na.cl2BubbleIntensity > 0 && i < Math.ceil(na.cl2BubbleIntensity * rig.naclCl2Bubbles.length);
    b.visible = show;
    if (show) {
      const cycle = (bubbleClockNa + seededFrac(i + 211)) % 1;
      const angle = seededFrac(i + 241) * Math.PI * 2;
      const rad = 0.045 + seededFrac(i + 271) * 0.045;
      b.position.set(
        -0.08 + Math.cos(angle) * rad,
        0.18 + cycle * 0.34,
        0.08 + Math.sin(angle) * rad
      );
      b.scale.setScalar(0.75 + (1 - cycle) * 0.55);
    }
  }

  for (let i = 0; i < rig.naclH2Bubbles.length; i += 1) {
    const b = rig.naclH2Bubbles[i];
    const show = na.h2BubbleIntensity > 0 && i < Math.ceil(na.h2BubbleIntensity * rig.naclH2Bubbles.length);
    b.visible = show;
    if (show) {
      const cycle = (bubbleClockNa * 1.1 + seededFrac(i + 311)) % 1;
      const angle = seededFrac(i + 347) * Math.PI * 2;
      const rad = 0.045 + seededFrac(i + 383) * 0.045;
      b.position.set(
        0.52 + Math.cos(angle) * rad,
        0.18 + cycle * 0.34,
        0.08 + Math.sin(angle) * rad
      );
      b.scale.setScalar(0.7 + (1 - cycle) * 0.5);
    }
  }

  for (let i = 0; i < rig.naclNaDrops.length; i += 1) {
    const drop = rig.naclNaDrops[i];
    const threshold = (i + 0.5) / rig.naclNaDrops.length;
    const show = !na.showMembrane && na.moltenNaDepositRatio >= threshold * 0.65;
    drop.visible = show;
    if (show) {
      const ang = (i / rig.naclNaDrops.length) * Math.PI * 2;
      drop.position.set(
        0.52 + Math.cos(ang) * 0.075,
        0.49 + (i % 2) * 0.02,
        0.08 + Math.sin(ang) * 0.075
      );
      const grow = Math.min(1, na.moltenNaDepositRatio * 1.4);
      drop.scale.setScalar(0.65 + grow * 0.55);
    }
  }

  const naclShowIons = na.naIonMembraneActive && (!inMacroView || macro.showIonFlow);
  for (let i = 0; i < rig.naclNaIons.length; i += 1) {
    const ion = rig.naclNaIons[i];
    ion.visible = naclShowIons;
    if (naclShowIons) {
      const u = (bubbleClockNa * 0.45 + i / rig.naclNaIons.length) % 1;
      ion.position.set(0.04 + u * 0.36, 0.22 + (i % 3) * 0.08, 0.08 + ((i % 2) - 0.5) * 0.14);
    }
  }
  rig.naclWireGlowMesh.visible =
    macro.showElectronFlow &&
    (na.electronsActive || (inMacroView && selectedTable === 'dien-phan-nacl'));

  // 6. Macro Observation 3D Directional Chevrons & Reaction-Zone Halo Rings
  const showMacroOverlays = inMacroView && selectedTable !== null && !(world?.visualQuizCandidates?.length);
  const activeBase = selectedTable ? TABLE_POSITIONS[selectedTable] : null;

  const activeWireCurve =
    selectedTable === 'pin-zn-cu'
      ? zn.circuitClosed
        ? rig.znCuWireCurve
        : null
      : selectedTable === 'dien-phan-cuso4'
        ? rig.cuso4WireCurve
        : selectedTable === 'dien-phan-nacl'
          ? rig.naclWireCurve
          : null;
  const activePhase =
    selectedTable === 'pin-zn-cu'
      ? zn.electronPhase
      : selectedTable === 'dien-phan-cuso4'
        ? cu.electronPhase
        : na.electronPhase;

  for (let i = 0; i < rig.macroElectronArrows.length; i += 1) {
    const cone = rig.macroElectronArrows[i];
    const show = Boolean(showMacroOverlays && macro.showElectronFlow && activeWireCurve && activeBase);
    cone.visible = show;
    if (show && activeWireCurve && activeBase) {
      const u = (0.14 + i * 0.23 + activePhase * 0.35) % 0.96;
      const clampedU = Math.max(0.04, Math.min(0.95, u));
      activeWireCurve.getPointAt(clampedU, _tmpVec3);
      activeWireCurve.getTangentAt(clampedU, _tmpVec3B).normalize();
      cone.position.set(
        activeBase.x + _tmpVec3.x,
        TABLE_TOP_Y + _tmpVec3.y,
        activeBase.z + _tmpVec3.z
      );
      _tmpQuat.setFromUnitVectors(_upAxis, _tmpVec3B);
      cone.quaternion.copy(_tmpQuat);
    }
  }

  for (let i = 0; i < rig.macroIonArrows.length; i += 1) {
    const cone = rig.macroIonArrows[i];
    let visible = false;
    if (showMacroOverlays && macro.showIonFlow && activeBase) {
      if (selectedTable === 'pin-zn-cu' && zn.circuitClosed) {
        visible = true;
        const isK = i < 2;
        const curve = isK ? rig.znCuKCurve : rig.znCuNO3Curve;
        const u = 0.28 + (i % 2) * 0.42;
        curve.getPointAt(u, _tmpVec3);
        curve.getTangentAt(u, _tmpVec3B).normalize();
        cone.position.set(
          activeBase.x + _tmpVec3.x,
          TABLE_TOP_Y + _tmpVec3.y + (isK ? 0.055 : -0.055),
          activeBase.z + _tmpVec3.z + 0.04
        );
        _tmpQuat.setFromUnitVectors(_upAxis, _tmpVec3B);
        cone.quaternion.copy(_tmpQuat);
      } else if (selectedTable === 'dien-phan-nacl' && na.showMembrane && i < 2) {
        visible = true;
        cone.position.set(
          activeBase.x + 0.14 + i * 0.16,
          TABLE_TOP_Y + 0.3 + (i % 2) * 0.08,
          activeBase.z + 0.22
        );
        _tmpVec3B.set(1, 0, 0);
        _tmpQuat.setFromUnitVectors(_upAxis, _tmpVec3B);
        cone.quaternion.copy(_tmpQuat);
      }
    }
    cone.visible = visible;
  }

  for (let i = 0; i < rig.macroReactionRings.length; i += 1) {
    const ring = rig.macroReactionRings[i];
    const show = Boolean(showMacroOverlays && macro.showReactionZone && activeBase);
    ring.visible = show;
    if (show && activeBase) {
      if (selectedTable === 'pin-zn-cu') {
        ring.position.set(
          activeBase.x + (i === 0 ? -0.64 : 0.64),
          TABLE_TOP_Y + 0.28,
          activeBase.z + 0.04
        );
        ring.scale.setScalar(0.95);
      } else if (selectedTable === 'dien-phan-cuso4') {
        ring.position.set(
          activeBase.x + (i === 0 ? -0.04 : -0.46),
          TABLE_TOP_Y + 0.3,
          activeBase.z + 0.08
        );
        ring.scale.setScalar(0.78);
      } else {
        ring.position.set(
          activeBase.x + (i === 0 ? -0.08 : 0.52),
          TABLE_TOP_Y + 0.3,
          activeBase.z + 0.08
        );
        ring.scale.setScalar(0.84);
      }
    }
  }
}

export function disposeLabScene(rig: LabSceneRig): void {
  for (const item of rig.disposables) {
    try {
      item.dispose();
    } catch {
      // Ignore already disposed resource
    }
  }
  rig.scene.clear();
}
