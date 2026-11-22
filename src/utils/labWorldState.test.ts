import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_MODULES,
  DEFAULT_MACRO_OPTIONS,
  PRACTICE_BANK_STATS,
  PRACTICE_DECKS,
  SPEED_PRESETS,
  VISUAL_LAB_QUESTIONS,
  advanceSimulationTime,
  buildBeforeAfterComparison,
  computeMacroCallouts,
  computeMicroscopicFrame,
  getWorldCameraPreset,
  resolveEffectiveGraphicsProfile,
  stepSimulationTime,
} from './labWorldState';
import { computeElectrolysisAtTime, getDefaultParams } from './electrochemEngine';
import { computeGalvanicCellSnapshot, createInitialGalvanicState } from './lab3dState';

test('Speed presets include 0.25x to 4x and advanceSimulationTime scales strictly with speedMultiplier', () => {
  assert.deepEqual([...SPEED_PRESETS], [0.25, 0.5, 1, 1.5, 2, 4]);

  const s1 = advanceSimulationTime({
    currentTimeSeconds: 0,
    totalTimeSeconds: 1800,
    realDeltaSeconds: 1,
    speedMultiplier: 1,
    basePlaybackDurationSeconds: 18,
  });
  const s2 = advanceSimulationTime({
    currentTimeSeconds: 0,
    totalTimeSeconds: 1800,
    realDeltaSeconds: 1,
    speedMultiplier: 2,
    basePlaybackDurationSeconds: 18,
  });
  const sQuarter = advanceSimulationTime({
    currentTimeSeconds: 0,
    totalTimeSeconds: 1800,
    realDeltaSeconds: 1,
    speedMultiplier: 0.25,
    basePlaybackDurationSeconds: 18,
  });

  assert.equal(s1.nextTimeSeconds, 100);
  assert.equal(s2.nextTimeSeconds, 200);
  assert.equal(sQuarter.nextTimeSeconds, 25);
});

test('Manual stepSimulationTime moves forward and backward deterministically within bounds', () => {
  const fwd = stepSimulationTime({
    station: 'dien-phan-cuso4',
    currentTimeSeconds: 0,
    totalTimeSeconds: 1930,
    direction: 1,
  });
  assert.equal(fwd, 193);

  const back = stepSimulationTime({
    station: 'dien-phan-cuso4',
    currentTimeSeconds: fwd,
    totalTimeSeconds: 1930,
    direction: -1,
  });
  assert.equal(back, 0);
});

test('Smart Teaching Board exposes 10 real syllabus modules with interactive equation links', () => {
  assert.equal(BOARD_MODULES.length, 10);
  for (const mod of BOARD_MODULES) {
    assert.ok(mod.title.length > 5);
    assert.ok(mod.blocks.length >= 1, `Module ${mod.id} must have real content blocks`);
    assert.ok(mod.equations.length >= 1, `Module ${mod.id} must have interactive equations`);
    assert.ok(mod.observeTarget.microZone);
  }
});

test('Practice Desk decks reuse real question bank and 3D visual picking questions', () => {
  assert.ok(PRACTICE_DECKS.length >= 6);
  const balanced = PRACTICE_DECKS.find((d) => d.id === 'deck-balanced-12');
  assert.ok(balanced);
  assert.equal(balanced.questions.length, 12);

  const visual = PRACTICE_DECKS.find((d) => d.id === 'deck-visual-3d');
  assert.ok(visual);
  assert.equal(visual.questions.length, VISUAL_LAB_QUESTIONS.length);
  for (const q of VISUAL_LAB_QUESTIONS) {
    assert.ok(q.candidateObjects.includes(q.correctObjectId));
  }
});

test('Microscopic engine obeys strict electrochemistry invariants across Zn-Cu, CuSO4, and NaCl', () => {
  const galvanicClosed = computeGalvanicCellSnapshot({
    ...createInitialGalvanicState(),
    circuitClosed: true,
    timeSeconds: 20,
  });
  const cuso4InertParams = getDefaultParams('cuso4-inert');
  const cuso4Stage1 = computeElectrolysisAtTime(cuso4InertParams, 400);
  const cuso4Stage2 = computeElectrolysisAtTime(cuso4InertParams, 1500);
  const cuso4CopperParams = getDefaultParams('cuso4-copper');
  const cuso4CopperSnap = computeElectrolysisAtTime(cuso4CopperParams, 500);
  const naclMoltenParams = getDefaultParams('nacl-molten');
  const naclMoltenSnap = computeElectrolysisAtTime(naclMoltenParams, 400);
  const naclBrineParams = getDefaultParams('nacl-brine');
  const naclBrineSnap = computeElectrolysisAtTime(naclBrineParams, 400);

  // 1. Salt bridge MUST NEVER contain electrons (e-)
  const bridgeFrame = computeMicroscopicFrame({
    zone: 'zncu-bridge',
    galvanic: galvanicClosed,
    cuso4Variant: 'cuso4-inert',
    cuso4Snapshot: cuso4Stage1,
    naclVariant: 'nacl-brine',
    naclSnapshot: naclBrineSnap,
    trackedSpecies: 'K+',
    reducedMotion: false,
  });
  assert.equal(bridgeFrame.activeSpecies.includes('e-'), false);
  assert.ok(bridgeFrame.activeSpecies.includes('K+'));
  assert.ok(bridgeFrame.activeSpecies.includes('NO3-'));

  // 2. CuSO4 inert stage 1 -> stage 2 switches cathode mechanism to H2O/H2
  const cuCat1 = computeMicroscopicFrame({
    zone: 'cuso4-cathode',
    galvanic: galvanicClosed,
    cuso4Variant: 'cuso4-inert',
    cuso4Snapshot: cuso4Stage1,
    naclVariant: 'nacl-brine',
    naclSnapshot: naclBrineSnap,
    trackedSpecies: null,
    reducedMotion: false,
  });
  const cuCat2 = computeMicroscopicFrame({
    zone: 'cuso4-cathode',
    galvanic: galvanicClosed,
    cuso4Variant: 'cuso4-inert',
    cuso4Snapshot: cuso4Stage2,
    naclVariant: 'nacl-brine',
    naclSnapshot: naclBrineSnap,
    trackedSpecies: null,
    reducedMotion: false,
  });
  assert.equal(cuCat1.hasH2AtCathode, false);
  assert.equal(cuCat2.hasH2AtCathode, true);

  // 3. CuSO4 copper anode MUST have zero O2 at anode
  const cuAnodeCopper = computeMicroscopicFrame({
    zone: 'cuso4-anode',
    galvanic: galvanicClosed,
    cuso4Variant: 'cuso4-copper',
    cuso4Snapshot: cuso4CopperSnap,
    naclVariant: 'nacl-brine',
    naclSnapshot: naclBrineSnap,
    trackedSpecies: null,
    reducedMotion: false,
  });
  assert.equal(cuAnodeCopper.hasO2AtAnode, false);
  assert.ok(cuAnodeCopper.activeSpecies.includes('Cu2+'));

  // 4. Molten NaCl MUST have ZERO H2O, ZERO OH-, and ZERO membrane
  const moltenFrame = computeMicroscopicFrame({
    zone: 'nacl-molten',
    galvanic: galvanicClosed,
    cuso4Variant: 'cuso4-inert',
    cuso4Snapshot: cuso4Stage1,
    naclVariant: 'nacl-molten',
    naclSnapshot: naclMoltenSnap,
    trackedSpecies: null,
    reducedMotion: false,
  });
  assert.equal(moltenFrame.hasWater, false);
  assert.equal(moltenFrame.hasMembrane, false);
  assert.equal(moltenFrame.activeSpecies.includes('H2O'), false);
  assert.equal(moltenFrame.activeSpecies.includes('OH-'), false);

  // 5. Brine NaCl has membrane, Na+, Cl-, H2O, OH-
  const brineFrame = computeMicroscopicFrame({
    zone: 'nacl-brine-membrane',
    galvanic: galvanicClosed,
    cuso4Variant: 'cuso4-inert',
    cuso4Snapshot: cuso4Stage1,
    naclVariant: 'nacl-brine',
    naclSnapshot: naclBrineSnap,
    trackedSpecies: 'Na+',
    reducedMotion: false,
  });
  assert.equal(brineFrame.hasWater, true);
  assert.equal(brineFrame.hasMembrane, true);
  assert.ok(brineFrame.activeSpecies.includes('Na+'));
  assert.ok(brineFrame.activeSpecies.includes('OH-'));

  // 6. Determinism: identical inputs produce bit-for-bit identical particle positions
  const brineFrameAgain = computeMicroscopicFrame({
    zone: 'nacl-brine-membrane',
    galvanic: galvanicClosed,
    cuso4Variant: 'cuso4-inert',
    cuso4Snapshot: cuso4Stage1,
    naclVariant: 'nacl-brine',
    naclSnapshot: naclBrineSnap,
    trackedSpecies: 'Na+',
    reducedMotion: false,
  });
  assert.deepEqual(brineFrame.particles, brineFrameAgain.particles);
});

test('World camera presets frame OVERVIEW, BOARD, PRACTICE, and MICRO cleanly on desktop and 390px mobile', () => {
  const deskOverview = getWorldCameraPreset({
    zone: 'OVERVIEW',
    station: null,
    objectId: null,
    microZone: 'zncu-zn',
    aspect: 1440 / 720,
  });
  const mobOverview = getWorldCameraPreset({
    zone: 'OVERVIEW',
    station: null,
    objectId: null,
    microZone: 'zncu-zn',
    aspect: 390 / 420,
  });
  assert.ok(mobOverview.position.z > deskOverview.position.z);

  const board = getWorldCameraPreset({
    zone: 'BOARD',
    station: null,
    objectId: null,
    microZone: 'zncu-zn',
    aspect: 1.8,
  });
  assert.ok(board.position.z > board.target.z);

  const practice = getWorldCameraPreset({
    zone: 'PRACTICE',
    station: null,
    objectId: null,
    microZone: 'zncu-zn',
    aspect: 1.8,
  });
  assert.ok(practice.position.y > practice.target.y);

  const cmp = buildBeforeAfterComparison({
    station: 'dien-phan-cuso4',
    galvanic: computeGalvanicCellSnapshot(createInitialGalvanicState()),
    cuso4Variant: 'cuso4-inert',
    cuso4Params: getDefaultParams('cuso4-inert'),
    cuso4Snapshot: computeElectrolysisAtTime(getDefaultParams('cuso4-inert'), 965),
    naclVariant: 'nacl-brine',
    naclParams: getDefaultParams('nacl-brine'),
    naclSnapshot: computeElectrolysisAtTime(getDefaultParams('nacl-brine'), 400),
  });
  assert.equal(cmp.length, 4);
  assert.match(cmp[1].afterText, /0,635 g/);
});

test('Graphics quality tier resolver adapts cleanly across GPU desktop, mobile, and software WebGL', () => {
  const sw = resolveEffectiveGraphicsProfile({
    preference: 'ultra',
    isSoftwareGl: true,
    viewportWidth: 1440,
    devicePixelRatio: 2,
  });
  assert.equal(sw.effectiveTier, 'standard');
  assert.equal(sw.shadowsEnabled, false);
  assert.equal(sw.maxPixelRatio, 1);

  const deskAuto = resolveEffectiveGraphicsProfile({
    preference: 'auto',
    isSoftwareGl: false,
    viewportWidth: 1440,
    devicePixelRatio: 2,
  });
  assert.equal(deskAuto.effectiveTier, 'ultra');
  assert.equal(deskAuto.shadowsEnabled, true);
  assert.equal(deskAuto.shadowMapSize, 2048);

  const mobAuto = resolveEffectiveGraphicsProfile({
    preference: 'auto',
    isSoftwareGl: false,
    viewportWidth: 390,
    devicePixelRatio: 2,
  });
  assert.equal(mobAuto.effectiveTier, 'high');
  assert.equal(mobAuto.shadowMapSize, 1024);

  const explicitStd = resolveEffectiveGraphicsProfile({
    preference: 'standard',
    isSoftwareGl: false,
    viewportWidth: 1440,
    devicePixelRatio: 2,
  });
  assert.equal(explicitStd.effectiveTier, 'standard');
  assert.equal(explicitStd.shadowsEnabled, false);
});

test('Macro observation callouts stay scientifically accurate and honor display toggles', () => {
  const galvanicClosed = computeGalvanicCellSnapshot({
    ...createInitialGalvanicState(),
    circuitClosed: true,
    timeSeconds: 18,
  });
  const cuso4InertParams = getDefaultParams('cuso4-inert');
  const cuso4Stage2 = computeElectrolysisAtTime(cuso4InertParams, 1500);
  const cuso4CopperSnap = computeElectrolysisAtTime(getDefaultParams('cuso4-copper'), 400);
  const naclMoltenSnap = computeElectrolysisAtTime(getDefaultParams('nacl-molten'), 400);
  const naclBrineSnap = computeElectrolysisAtTime(getDefaultParams('nacl-brine'), 400);

  // Pin Zn-Cu: Anode (-) Zn, Cathode (+) Cu, electron flow Zn -> Cu, KNO3 ion flow
  const znCuCallouts = computeMacroCallouts({
    station: 'pin-zn-cu',
    galvanic: galvanicClosed,
    cuso4Variant: 'cuso4-inert',
    cuso4Snapshot: cuso4Stage2,
    naclVariant: 'nacl-brine',
    naclSnapshot: naclBrineSnap,
    options: DEFAULT_MACRO_OPTIONS,
  });
  assert.ok(znCuCallouts.some((c) => c.title.includes('Anode (−) · Zn')));
  assert.ok(znCuCallouts.some((c) => c.title.includes('Cathode (+) · Cu')));
  assert.ok(znCuCallouts.some((c) => c.title.includes('e⁻ : Zn → Cu')));
  assert.ok(znCuCallouts.some((c) => c.title.includes('KNO₃')));

  // Turning off polarity labels hides polarity callouts
  const znCuNoPolarity = computeMacroCallouts({
    station: 'pin-zn-cu',
    galvanic: galvanicClosed,
    cuso4Variant: 'cuso4-inert',
    cuso4Snapshot: cuso4Stage2,
    naclVariant: 'nacl-brine',
    naclSnapshot: naclBrineSnap,
    options: { ...DEFAULT_MACRO_OPTIONS, showPolarityLabels: false },
  });
  assert.equal(znCuNoPolarity.some((c) => c.category === 'polarity'), false);

  // CuSO4 copper anode must NOT mention O2 product
  const cuCopperCallouts = computeMacroCallouts({
    station: 'dien-phan-cuso4',
    galvanic: galvanicClosed,
    cuso4Variant: 'cuso4-copper',
    cuso4Snapshot: cuso4CopperSnap,
    naclVariant: 'nacl-brine',
    naclSnapshot: naclBrineSnap,
    options: DEFAULT_MACRO_OPTIONS,
  });
  assert.equal(cuCopperCallouts.some((c) => c.title.includes('O₂')), false);
  assert.ok(cuCopperCallouts.some((c) => c.title.includes('Cu tan')));

  // Molten NaCl has Na product and no membrane ion flow callout
  const moltenCallouts = computeMacroCallouts({
    station: 'dien-phan-nacl',
    galvanic: galvanicClosed,
    cuso4Variant: 'cuso4-inert',
    cuso4Snapshot: cuso4Stage2,
    naclVariant: 'nacl-molten',
    naclSnapshot: naclMoltenSnap,
    options: DEFAULT_MACRO_OPTIONS,
  });
  assert.ok(moltenCallouts.some((c) => c.title.includes('Na lỏng')));
  assert.equal(moltenCallouts.some((c) => c.id === 'macro-nacl-ion'), false);

  // Practice bank exact verified count
  assert.equal(PRACTICE_BANK_STATS.standardCount, 36);
  assert.equal(PRACTICE_BANK_STATS.visual3DCount, 6);
  assert.equal(PRACTICE_BANK_STATS.totalCount, 42);
});
