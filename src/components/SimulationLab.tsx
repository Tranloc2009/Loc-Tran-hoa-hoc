import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Crosshair,
  Eye,
  FileText,
  Focus,
  Gauge,
  HelpCircle,
  Layers,
  Microscope,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  Settings,
  SlidersHorizontal,
  StepBack,
  StepForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ANODE_COPPER_INITIAL_G,
  ElectrolysisParams,
  ElectrolysisRawInput,
  ElectrolysisValidationErrors,
  ElectrolysisVariant,
  buildFaradayDerivation,
  computeElectrolysisAtTime,
  getDefaultParams,
  getDefaultRawInput,
  getDepletionTimeSeconds,
  getElectrolysisMilestones,
  validateElectrolysisParams,
} from '../utils/electrochemEngine';
import {
  GalvanicCellState,
  LAB_OBJECTS,
  LAB_STEP_GUIDES,
  LAB_TABLES,
  LabExperimentId,
  LabGuideKey,
  LabGuidedStep,
  LabObjectId,
  computeGalvanicCellSnapshot,
  computeLab3DVisuals,
  createInitialGalvanicState,
  getObjectsForStation,
} from '../utils/lab3dState';
import {
  BOARD_MODULES,
  CameraSpeedMode,
  DEFAULT_MACRO_OPTIONS,
  GraphicsQualityTier,
  IonSpeciesId,
  MICRO_ZONES,
  MacroDisplayOptions,
  MicroZoneId,
  SPEED_PRESETS,
  VisualLabQuestion,
  WorldZone,
  advanceSimulationTime,
  buildBeforeAfterComparison,
  computeMicroscopicFrame,
  getBoardModuleIndexForSlug,
  getMicroZonesForStation,
  stepSimulationTime,
} from '../utils/labWorldState';
import { playLabSound } from '../utils/labSound';
import { LearningProgress, QuizResultSummary } from '../utils/storage';
import { TimeUnit, formatViNumber } from '../utils/faraday';
import { ChemText } from './ChemText';
import { ElectrochemChart } from './ElectrochemChart';
import {
  HotspotInfo,
  LabCuSO4Svg,
  LabNaClSvg,
  LabZnCuSvg,
} from './LabApparatusSvg';
import type {
  Lab3DCanvasHandle,
  MicroDisplayOptions,
  VisualQuizState,
} from './lab3d/Lab3DCanvas';
import { LabStepGallery } from './lab3d/LabStepGallery';
import { SmartBoardPanel } from './lab3d/SmartBoardPanel';
import { PracticeDeskPanel, PracticeSessionState } from './lab3d/PracticeDeskPanel';

const LazyLab3DCanvas = React.lazy(() =>
  import('./lab3d/Lab3DCanvas').then((mod) => ({ default: mod.Lab3DCanvas }))
);

export type SimTabId =
  | 'pin-zn-cu'
  | 'dien-phan-cuso4'
  | 'nacl-nong-chay'
  | 'dien-phan-nacl'
  | 'faraday';

type DrawerTab = 'display' | 'steps' | 'results' | 'params' | 'compare';
type Fallback2DTab = 'sim' | 'board' | 'practice';

type ReturnContext =
  | { from: 'BOARD'; moduleIndex: number }
  | { from: 'PRACTICE'; deckId: string | null; questionIndex: number };

export interface WorldLaunchRoute {
  nonce: number;
  worldZone: WorldZone;
  station: LabExperimentId;
  cuso4Variant: 'cuso4-inert' | 'cuso4-copper';
  naclVariant: 'nacl-molten' | 'nacl-brine';
  boardModuleIndex: number;
  practiceDeckId: string | null;
  openDrawerParams: boolean;
}

interface SimulationLabProps {
  launchRoute: WorldLaunchRoute;
  progress: LearningProgress;
  onToggleLessonComplete: (slug: string) => void;
  onMarkCurrentLesson: (slug: string) => void;
  onRecordQuestionOutcome: (questionId: string, isCorrect: boolean) => void;
  onSaveQuizResult: (result: QuizResultSummary, deckId?: string) => void;
  onSyncHash?: (hash: string) => void;
}

const DEFAULT_MICRO_OPTIONS: MicroDisplayOptions = {
  showIonLabels: true,
  showArrows: true,
  showEquations: true,
  showReactionZone: true,
  showHydration: true,
  cutaway: true,
};

function getDefaultMicroZoneForStation(
  station: LabExperimentId,
  naclVariant: 'nacl-molten' | 'nacl-brine'
): MicroZoneId {
  const zones = getMicroZonesForStation(station, naclVariant);
  return zones[0]?.id ?? 'zncu-cu';
}

export const SimulationLab: React.FC<SimulationLabProps> = ({
  launchRoute,
  progress,
  onToggleLessonComplete,
  onMarkCurrentLesson,
  onRecordQuestionOutcome,
  onSaveQuizResult,
  onSyncHash,
}) => {
  // =========================================================================
  // 1. EXPLORATION & UNIFIED 3D WORLD STATE (NEVER alters chemical math)
  // =========================================================================
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [fallback2DTab, setFallback2DTab] = useState<Fallback2DTab>(() =>
    launchRoute.worldZone === 'BOARD'
      ? 'board'
      : launchRoute.worldZone === 'PRACTICE'
        ? 'practice'
        : 'sim'
  );
  const [worldZone, setWorldZone] = useState<WorldZone>(launchRoute.worldZone);
  const [selectedStation, setSelectedStation] = useState<LabExperimentId>(launchRoute.station);
  const [selectedObject, setSelectedObject] = useState<LabObjectId | null>(null);
  const [microZone, setMicroZone] = useState<MicroZoneId>(() =>
    getDefaultMicroZoneForStation(launchRoute.station, launchRoute.naclVariant)
  );
  const [microOptions, setMicroOptions] = useState<MicroDisplayOptions>(DEFAULT_MICRO_OPTIONS);
  const [macroOptions, setMacroOptions] = useState<MacroDisplayOptions>(DEFAULT_MACRO_OPTIONS);
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQualityTier>('auto');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [trackedSpecies, setTrackedSpecies] = useState<IonSpeciesId | null>(null);
  const [cameraRequestNonce, setCameraRequestNonce] = useState<number>(0);
  const [cameraSpeedMode, setCameraSpeedMode] = useState<CameraSpeedMode>('normal');
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showSettingsPopover, setShowSettingsPopover] = useState<boolean>(false);
  const [showExploreMenu, setShowExploreMenu] = useState<boolean>(false);
  const [showFpsDebug, setShowFpsDebug] = useState<boolean>(false);
  const [practiceLampOn, setPracticeLampOn] = useState<boolean>(true);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(launchRoute.openDrawerParams);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>(
    launchRoute.openDrawerParams ? 'params' : 'display'
  );
  const [showDerivation, setShowDerivation] = useState<boolean>(false);
  const [activeHotspot2D, setActiveHotspot2D] = useState<HotspotInfo | null>(null);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [returnContext, setReturnContext] = useState<ReturnContext | null>(null);

  // =========================================================================
  // 2. SMART BOARD & PRACTICE DESK PRESERVED STATE
  // =========================================================================
  const [boardModuleIndex, setBoardModuleIndex] = useState<number>(launchRoute.boardModuleIndex);
  const [practiceFlipNonce, setPracticeFlipNonce] = useState<number>(0);
  const [practiceSession, setPracticeSession] = useState<PracticeSessionState>(() => ({
    activeDeckId: launchRoute.practiceDeckId,
    questionIndex: 0,
    answers: {},
    submitted: false,
    startedAtMs: Date.now(),
    elapsedSeconds: 0,
  }));
  const [activeVisualQuiz, setActiveVisualQuiz] = useState<VisualLabQuestion | null>(null);

  // Active step number per guide key (1..10) & cached 3D thumbnails
  const [stepByGuide, setStepByGuide] = useState<Record<LabGuideKey, number>>({
    'pin-zn-cu': 1,
    'cuso4-inert': 1,
    'cuso4-copper': 1,
    'nacl-molten': 1,
    'nacl-brine': 1,
  });
  const [stepThumbnails, setStepThumbnails] = useState<Record<string, string>>({});
  const canvasHandleRef = useRef<Lab3DCanvasHandle | null>(null);

  // =========================================================================
  // 3. SHARED SIMULATION STATE (Single Source of Truth across 3D, Micro, 2D, Charts)
  // =========================================================================
  const [cuso4Variant, setCuso4Variant] = useState<'cuso4-inert' | 'cuso4-copper'>(
    launchRoute.cuso4Variant
  );
  const [naclVariant, setNaclVariant] = useState<'nacl-molten' | 'nacl-brine'>(
    launchRoute.naclVariant
  );
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  const [galvanicState, setGalvanicState] = useState<GalvanicCellState>(() =>
    createInitialGalvanicState()
  );

  const [paramsByVariant, setParamsByVariant] = useState<
    Record<ElectrolysisVariant, ElectrolysisParams>
  >(() => ({
    'cuso4-inert': getDefaultParams('cuso4-inert'),
    'cuso4-copper': getDefaultParams('cuso4-copper'),
    'nacl-molten': getDefaultParams('nacl-molten'),
    'nacl-brine': getDefaultParams('nacl-brine'),
  }));

  const [rawInputsByVariant, setRawInputsByVariant] = useState<
    Record<ElectrolysisVariant, ElectrolysisRawInput>
  >(() => ({
    'cuso4-inert': getDefaultRawInput('cuso4-inert'),
    'cuso4-copper': getDefaultRawInput('cuso4-copper'),
    'nacl-molten': getDefaultRawInput('nacl-molten'),
    'nacl-brine': getDefaultRawInput('nacl-brine'),
  }));

  const [timeByVariant, setTimeByVariant] = useState<Record<ElectrolysisVariant, number>>({
    'cuso4-inert': 0,
    'cuso4-copper': 0,
    'nacl-molten': 0,
    'nacl-brine': 0,
  });

  const [inputErrors, setInputErrors] = useState<ElectrolysisValidationErrors>({});

  // Sync incoming external hash navigation (browser Back/Forward or deep links)
  const lastLaunchNonceRef = useRef<number>(launchRoute.nonce);
  useEffect(() => {
    if (lastLaunchNonceRef.current === launchRoute.nonce) return;
    lastLaunchNonceRef.current = launchRoute.nonce;
    setIsRunning(false);
    setActiveVisualQuiz(null);
    setReturnContext(null);
    setSelectedObject(null);
    setWorldZone(launchRoute.worldZone);
    setSelectedStation(launchRoute.station);
    setCuso4Variant(launchRoute.cuso4Variant);
    setNaclVariant(launchRoute.naclVariant);
    setBoardModuleIndex(launchRoute.boardModuleIndex);
    setMicroZone(getDefaultMicroZoneForStation(launchRoute.station, launchRoute.naclVariant));
    if (launchRoute.practiceDeckId) {
      setPracticeSession((prev) => ({
        ...prev,
        activeDeckId: launchRoute.practiceDeckId,
        questionIndex: 0,
      }));
    }
    if (launchRoute.openDrawerParams) {
      setDrawerOpen(true);
      setDrawerTab('params');
    }
    if (launchRoute.worldZone === 'BOARD') {
      setFallback2DTab('board');
    } else if (launchRoute.worldZone === 'PRACTICE') {
      setFallback2DTab('practice');
    } else {
      setFallback2DTab('sim');
    }
    setCameraRequestNonce((n) => n + 1);
  }, [launchRoute]);

  // Respect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Escape key closes popovers / drawers / modals / object closeup cleanly
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (drawerOpen) {
        setDrawerOpen(false);
        return;
      }
      if (showExploreMenu) {
        setShowExploreMenu(false);
        return;
      }
      if (showSettingsPopover) {
        setShowSettingsPopover(false);
        return;
      }
      if (showHelpModal) {
        setShowHelpModal(false);
        return;
      }
      if (activeHotspot2D) {
        setActiveHotspot2D(null);
        return;
      }
      if (activeVisualQuiz) {
        setActiveVisualQuiz(null);
        setWorldZone('PRACTICE');
        setCameraRequestNonce((n) => n + 1);
        return;
      }
      if (worldZone === 'OBJECT' && selectedObject) {
        setSelectedObject(null);
        setWorldZone('TABLE');
        setCameraRequestNonce((n) => n + 1);
      } else if (worldZone === 'MICRO') {
        setWorldZone('TABLE');
        setCameraRequestNonce((n) => n + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    drawerOpen,
    showExploreMenu,
    showSettingsPopover,
    showHelpModal,
    activeHotspot2D,
    activeVisualQuiz,
    worldZone,
    selectedObject,
  ]);

  // Derived scientific snapshots (single source of truth)
  const galvanicSnapshot = useMemo(
    () => computeGalvanicCellSnapshot(galvanicState),
    [galvanicState]
  );

  const cuso4Params = paramsByVariant[cuso4Variant];
  const cuso4Snapshot = useMemo(
    () => computeElectrolysisAtTime(cuso4Params, timeByVariant[cuso4Variant]),
    [cuso4Params, timeByVariant, cuso4Variant]
  );

  const naclParams = paramsByVariant[naclVariant];
  const naclSnapshot = useMemo(
    () => computeElectrolysisAtTime(naclParams, timeByVariant[naclVariant]),
    [naclParams, timeByVariant, naclVariant]
  );

  const activeElectrolysisVariant: ElectrolysisVariant =
    selectedStation === 'dien-phan-cuso4' ? cuso4Variant : naclVariant;
  const activeParams = paramsByVariant[activeElectrolysisVariant];
  const activeRawInput = rawInputsByVariant[activeElectrolysisVariant];
  const activeElectrolysisSnapshot =
    selectedStation === 'dien-phan-cuso4' ? cuso4Snapshot : naclSnapshot;

  const activeGuideKey: LabGuideKey =
    selectedStation === 'pin-zn-cu'
      ? 'pin-zn-cu'
      : selectedStation === 'dien-phan-cuso4'
        ? cuso4Variant
        : naclVariant;

  const milestones = useMemo(
    () => getElectrolysisMilestones(activeParams),
    [activeParams]
  );
  const depletionTime = useMemo(
    () => getDepletionTimeSeconds(activeParams),
    [activeParams]
  );
  const derivationSteps = useMemo(
    () => buildFaradayDerivation(activeParams, activeElectrolysisSnapshot),
    [activeParams, activeElectrolysisSnapshot]
  );

  // Deterministic 3D macro scene visuals
  const lab3DVisuals = useMemo(
    () =>
      computeLab3DVisuals({
        galvanic: galvanicSnapshot,
        cuso4Variant,
        cuso4Params,
        cuso4Snapshot,
        naclVariant,
        naclParams,
        naclSnapshot,
        activeStation:
          worldZone === 'OVERVIEW' || worldZone === 'BOARD' || worldZone === 'PRACTICE'
            ? null
            : selectedStation,
        isRunning,
        playbackSpeed,
      }),
    [
      galvanicSnapshot,
      cuso4Variant,
      cuso4Params,
      cuso4Snapshot,
      naclVariant,
      naclParams,
      naclSnapshot,
      worldZone,
      selectedStation,
      isRunning,
      playbackSpeed,
    ]
  );

  // Deterministic 3D microscopic ion & mechanism frame
  const microFrame = useMemo(() => {
    if (worldZone !== 'MICRO') return null;
    return computeMicroscopicFrame({
      zone: microZone,
      galvanic: galvanicSnapshot,
      cuso4Variant,
      cuso4Snapshot,
      naclVariant,
      naclSnapshot,
      trackedSpecies,
      reducedMotion,
    });
  }, [
    worldZone,
    microZone,
    galvanicSnapshot,
    cuso4Variant,
    cuso4Snapshot,
    naclVariant,
    naclSnapshot,
    trackedSpecies,
    reducedMotion,
  ]);

  const beforeAfterRows = useMemo(
    () =>
      buildBeforeAfterComparison({
        station: selectedStation,
        galvanic: galvanicSnapshot,
        cuso4Variant,
        cuso4Params,
        cuso4Snapshot,
        naclVariant,
        naclParams,
        naclSnapshot,
      }),
    [
      selectedStation,
      galvanicSnapshot,
      cuso4Variant,
      cuso4Params,
      cuso4Snapshot,
      naclVariant,
      naclParams,
      naclSnapshot,
    ]
  );

  // Visual 3D quiz overlay state for Lab3DCanvas raycasting interception
  const visualQuizState: VisualQuizState | null = useMemo(() => {
    if (!activeVisualQuiz) return null;
    const picked = practiceSession.answers[activeVisualQuiz.id] as LabObjectId | undefined;
    return {
      active: true,
      prompt: activeVisualQuiz.prompt,
      candidateObjects: activeVisualQuiz.candidateObjects,
      selectedObjectId: picked ?? null,
    };
  }, [activeVisualQuiz, practiceSession.answers]);

  // =========================================================================
  // 4. SINGLE PLAYBACK CLOCK (simulationDelta = realDelta * speedMultiplier)
  // =========================================================================
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) {
      lastFrameRef.current = null;
      return;
    }

    if (selectedStation === 'pin-zn-cu' && !galvanicState.circuitClosed) {
      setIsRunning(false);
      lastFrameRef.current = null;
      return;
    }

    let rafId = 0;

    const tick = (now: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = now;
        rafId = window.requestAnimationFrame(tick);
        return;
      }
      const realDeltaSeconds = Math.min(now - lastFrameRef.current, 80) / 1000;
      lastFrameRef.current = now;

      if (selectedStation === 'pin-zn-cu') {
        setGalvanicState((prev) => {
          const step = advanceSimulationTime({
            currentTimeSeconds: prev.timeSeconds,
            totalTimeSeconds: prev.totalTimeSeconds,
            realDeltaSeconds,
            speedMultiplier: playbackSpeed,
          });
          if (step.reachedEnd) {
            setIsRunning(false);
          }
          return { ...prev, timeSeconds: step.nextTimeSeconds };
        });
      } else {
        const variant = activeElectrolysisVariant;
        const total = activeParams.totalTimeSeconds;
        if (total <= 0) {
          setIsRunning(false);
          return;
        }
        setTimeByVariant((prev) => {
          const step = advanceSimulationTime({
            currentTimeSeconds: prev[variant],
            totalTimeSeconds: total,
            realDeltaSeconds,
            speedMultiplier: playbackSpeed,
          });
          if (step.reachedEnd) {
            setIsRunning(false);
          }
          return { ...prev, [variant]: step.nextTimeSeconds };
        });
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      lastFrameRef.current = null;
    };
  }, [
    isRunning,
    selectedStation,
    galvanicState.circuitClosed,
    playbackSpeed,
    activeElectrolysisVariant,
    activeParams.totalTimeSeconds,
  ]);

  // =========================================================================
  // 5. UNIFIED WORLD NAVIGATION & INTERACTION HANDLERS
  // =========================================================================
  const handleGoOverview = useCallback(() => {
    setActiveVisualQuiz(null);
    setReturnContext(null);
    setSelectedObject(null);
    setDrawerOpen(false);
    setWorldZone('OVERVIEW');
    setCameraRequestNonce((n) => n + 1);
    onSyncHash?.('#/');
  }, [onSyncHash]);

  const handleOpenBoard = useCallback(
    (moduleIdx?: number) => {
      setIsRunning(false);
      setActiveVisualQuiz(null);
      setReturnContext(null);
      setSelectedObject(null);
      setDrawerOpen(false);
      const nextIdx =
        moduleIdx !== undefined
          ? Math.max(0, Math.min(BOARD_MODULES.length - 1, moduleIdx))
          : boardModuleIndex;
      setBoardModuleIndex(nextIdx);
      setWorldZone('BOARD');
      setFallback2DTab('board');
      setCameraRequestNonce((n) => n + 1);
      const slug = BOARD_MODULES[nextIdx]?.lessonSlug;
      if (slug) {
        onMarkCurrentLesson(slug);
        onSyncHash?.(`#/bai/${slug}`);
      }
    },
    [boardModuleIndex, onMarkCurrentLesson, onSyncHash]
  );

  const handleOpenPractice = useCallback(() => {
    setIsRunning(false);
    setActiveVisualQuiz(null);
    setReturnContext(null);
    setSelectedObject(null);
    setDrawerOpen(false);
    setWorldZone('PRACTICE');
    setFallback2DTab('practice');
    setCameraRequestNonce((n) => n + 1);
    onSyncHash?.('#/luyen-tap');
  }, [onSyncHash]);

  const handleSelectZoneFrom3D = useCallback(
    (zone: 'BOARD' | 'PRACTICE') => {
      if (zone === 'BOARD') {
        handleOpenBoard();
      } else {
        handleOpenPractice();
      }
    },
    [handleOpenBoard, handleOpenPractice]
  );

  const handleSelectStation = useCallback(
    (station: LabExperimentId) => {
      if (station !== selectedStation) {
        setIsRunning(false);
        setInputErrors({});
        setActiveHotspot2D(null);
        setTrackedSpecies(null);
      }
      setActiveVisualQuiz(null);
      setSelectedStation(station);
      setSelectedObject(null);
      setMicroZone(getDefaultMicroZoneForStation(station, naclVariant));
      setWorldZone('TABLE');
      setFallback2DTab('sim');
      setCameraRequestNonce((n) => n + 1);
      onSyncHash?.(`#/mo-phong?tab=${station}`);
    },
    [selectedStation, naclVariant, onSyncHash]
  );

  const handleSelectObject = useCallback((objectId: LabObjectId) => {
    const obj = LAB_OBJECTS[objectId];
    if (!obj) return;
    setSelectedStation((prev) => {
      if (prev !== obj.station) {
        setIsRunning(false);
      }
      return obj.station;
    });
    setSelectedObject(objectId);
    setWorldZone('OBJECT');
    setCameraRequestNonce((n) => n + 1);
  }, []);

  const handleBackToTable = useCallback(() => {
    setSelectedObject(null);
    setTrackedSpecies(null);
    setWorldZone('TABLE');
    setCameraRequestNonce((n) => n + 1);
  }, []);

  const handleOpenReactionView = useCallback(() => {
    setSelectedObject(null);
    setWorldZone('REACTION');
    setCameraRequestNonce((n) => n + 1);
  }, []);

  const handleEnterMicro = useCallback(
    (targetZone?: MicroZoneId) => {
      const nextZone = targetZone ?? getDefaultMicroZoneForStation(selectedStation, naclVariant);
      const zoneMeta = MICRO_ZONES[nextZone];
      if (zoneMeta && zoneMeta.station !== selectedStation) {
        setIsRunning(false);
        setSelectedStation(zoneMeta.station);
      }
      if (nextZone === 'nacl-molten') {
        setNaclVariant('nacl-molten');
      } else if (nextZone === 'nacl-brine-membrane') {
        setNaclVariant('nacl-brine');
      }
      setSelectedObject(null);
      setTrackedSpecies(null);
      setMicroZone(nextZone);
      setWorldZone('MICRO');
      setFallback2DTab('sim');
      setCameraRequestNonce((n) => n + 1);
    },
    [selectedStation, naclVariant]
  );

  const handleExitMicro = useCallback(() => {
    setTrackedSpecies(null);
    setSelectedObject(null);
    setWorldZone('TABLE');
    setCameraRequestNonce((n) => n + 1);
  }, []);

  /**
   * Reliable Macro entry from ANY mode (MICRO, OBJECT, REACTION, OVERVIEW):
   * frames macro table view, clears micro tracking clutter, and strictly preserves
   * simulation time, speed, switch state, electrodes, and variants.
   */
  const handleEnterMacro = useCallback(() => {
    setTrackedSpecies(null);
    setSelectedObject(null);
    setWorldZone('TABLE');
    setFallback2DTab('sim');
    setCameraRequestNonce((n) => n + 1);
  }, []);

  // Smart Board -> 3D Model / Micro jump (preserves exact module index!)
  const handleBoardObserveModel = useCallback(
    (target: {
      station: LabExperimentId;
      objectId?: LabObjectId;
      cuso4Variant?: 'cuso4-inert' | 'cuso4-copper';
      naclVariant?: 'nacl-molten' | 'nacl-brine';
    }) => {
      setIsRunning(false);
      setReturnContext({ from: 'BOARD', moduleIndex: boardModuleIndex });
      setSelectedStation(target.station);
      if (target.cuso4Variant) setCuso4Variant(target.cuso4Variant);
      if (target.naclVariant) setNaclVariant(target.naclVariant);
      setMicroZone(
        getDefaultMicroZoneForStation(target.station, target.naclVariant ?? naclVariant)
      );
      if (target.objectId) {
        setSelectedObject(target.objectId);
        setWorldZone('OBJECT');
      } else {
        setSelectedObject(null);
        setWorldZone('TABLE');
      }
      setFallback2DTab('sim');
      setCameraRequestNonce((n) => n + 1);
    },
    [boardModuleIndex, naclVariant]
  );

  const handleBoardObserveMicro = useCallback(
    (target: {
      station: LabExperimentId;
      microZone: MicroZoneId;
      cuso4Variant?: 'cuso4-inert' | 'cuso4-copper';
      naclVariant?: 'nacl-molten' | 'nacl-brine';
    }) => {
      setIsRunning(false);
      setReturnContext({ from: 'BOARD', moduleIndex: boardModuleIndex });
      setSelectedStation(target.station);
      if (target.cuso4Variant) setCuso4Variant(target.cuso4Variant);
      if (target.naclVariant) setNaclVariant(target.naclVariant);
      setSelectedObject(null);
      setTrackedSpecies(null);
      setMicroZone(target.microZone);
      setWorldZone('MICRO');
      setFallback2DTab('sim');
      setCameraRequestNonce((n) => n + 1);
    },
    [boardModuleIndex]
  );

  // Practice Desk -> Observe phenomenon in 3D (preserves all answers!)
  const handlePracticeObservePhenomenon = useCallback(
    (target: {
      station: LabExperimentId;
      microZone?: MicroZoneId;
      cuso4Variant?: 'cuso4-inert' | 'cuso4-copper';
      naclVariant?: 'nacl-molten' | 'nacl-brine';
    }) => {
      setIsRunning(false);
      setReturnContext({
        from: 'PRACTICE',
        deckId: practiceSession.activeDeckId,
        questionIndex: practiceSession.questionIndex,
      });
      setSelectedStation(target.station);
      if (target.cuso4Variant) setCuso4Variant(target.cuso4Variant);
      if (target.naclVariant) setNaclVariant(target.naclVariant);
      setSelectedObject(null);
      if (target.microZone) {
        setMicroZone(target.microZone);
        setWorldZone('MICRO');
      } else {
        setMicroZone(
          getDefaultMicroZoneForStation(target.station, target.naclVariant ?? naclVariant)
        );
        setWorldZone('TABLE');
      }
      setFallback2DTab('sim');
      setCameraRequestNonce((n) => n + 1);
    },
    [practiceSession.activeDeckId, practiceSession.questionIndex, naclVariant]
  );

  // Practice Desk -> Direct 3D object picking question
  const handleStartVisual3DPick = useCallback((question: VisualLabQuestion) => {
    setIsRunning(false);
    setActiveVisualQuiz(question);
    setSelectedStation(question.station);
    if (question.cuso4Variant) setCuso4Variant(question.cuso4Variant);
    if (question.naclVariant) setNaclVariant(question.naclVariant);
    setSelectedObject(null);
    setWorldZone('TABLE');
    setFallback2DTab('sim');
    setCameraRequestNonce((n) => n + 1);
  }, []);

  const handleVisualQuizPick = useCallback(
    (objectId: LabObjectId) => {
      if (!activeVisualQuiz) return;
      setPracticeSession((prev) => ({
        ...prev,
        answers: {
          ...prev.answers,
          [activeVisualQuiz.id]: objectId,
        },
      }));
    },
    [activeVisualQuiz]
  );

  const handleFinishVisualQuizPick = useCallback(() => {
    setActiveVisualQuiz(null);
    setWorldZone('PRACTICE');
    setFallback2DTab('practice');
    setCameraRequestNonce((n) => n + 1);
  }, []);

  const handleReturnToContext = useCallback(() => {
    if (!returnContext) return;
    setIsRunning(false);
    setSelectedObject(null);
    if (returnContext.from === 'BOARD') {
      setBoardModuleIndex(returnContext.moduleIndex);
      setWorldZone('BOARD');
      setFallback2DTab('board');
    } else {
      setWorldZone('PRACTICE');
      setFallback2DTab('practice');
    }
    setReturnContext(null);
    setCameraRequestNonce((n) => n + 1);
  }, [returnContext]);

  const handleTogglePinSwitch = useCallback(() => {
    playLabSound('switch', soundEnabled);
    setGalvanicState((prev) => {
      const nextClosed = !prev.circuitClosed;
      if (!nextClosed) {
        setIsRunning(false);
      }
      return { ...prev, circuitClosed: nextClosed };
    });
  }, [soundEnabled]);

  const isAtEnd =
    selectedStation === 'pin-zn-cu'
      ? galvanicSnapshot.progress >= 0.999
      : activeParams.totalTimeSeconds > 0
        ? activeElectrolysisSnapshot.timeSeconds >= activeParams.totalTimeSeconds - 1e-6
        : true;

  const hasStarted =
    selectedStation === 'pin-zn-cu'
      ? galvanicSnapshot.timeSeconds > 0.05
      : activeElectrolysisSnapshot.timeSeconds > 1e-6;

  const handlePrimaryPlayToggle = useCallback(() => {
    if (worldZone === 'OVERVIEW' || worldZone === 'BOARD' || worldZone === 'PRACTICE') {
      setWorldZone('TABLE');
      setCameraRequestNonce((n) => n + 1);
    }
    if (selectedStation === 'pin-zn-cu' && !galvanicState.circuitClosed) {
      setGalvanicState((prev) => ({ ...prev, circuitClosed: true }));
    }
    if (isRunning) {
      setIsRunning(false);
      return;
    }
    if (isAtEnd) {
      if (selectedStation === 'pin-zn-cu') {
        setGalvanicState((prev) => ({ ...prev, timeSeconds: 0 }));
      } else {
        setTimeByVariant((prev) => ({ ...prev, [activeElectrolysisVariant]: 0 }));
      }
    }
    setIsRunning(true);
  }, [
    worldZone,
    selectedStation,
    galvanicState.circuitClosed,
    isRunning,
    isAtEnd,
    activeElectrolysisVariant,
  ]);

  const handleStepTime = useCallback(
    (direction: 1 | -1) => {
      setIsRunning(false);
      if (worldZone === 'OVERVIEW' || worldZone === 'BOARD' || worldZone === 'PRACTICE') {
        setWorldZone('TABLE');
        setCameraRequestNonce((n) => n + 1);
      }
      if (selectedStation === 'pin-zn-cu') {
        setGalvanicState((prev) => {
          const nextTime = stepSimulationTime({
            station: 'pin-zn-cu',
            currentTimeSeconds: prev.timeSeconds,
            totalTimeSeconds: prev.totalTimeSeconds,
            direction,
          });
          return {
            ...prev,
            circuitClosed: direction === 1 ? true : prev.circuitClosed,
            timeSeconds: nextTime,
          };
        });
      } else {
        const variant = activeElectrolysisVariant;
        const total = activeParams.totalTimeSeconds;
        setTimeByVariant((prev) => ({
          ...prev,
          [variant]: stepSimulationTime({
            station: selectedStation,
            currentTimeSeconds: prev[variant],
            totalTimeSeconds: total,
            direction,
          }),
        }));
      }
    },
    [worldZone, selectedStation, activeElectrolysisVariant, activeParams.totalTimeSeconds]
  );

  const handleReset = () => {
    setIsRunning(false);
    setActiveHotspot2D(null);
    if (selectedStation === 'pin-zn-cu') {
      setGalvanicState((prev) => ({ ...prev, timeSeconds: 0 }));
    } else {
      setTimeByVariant((prev) => ({ ...prev, [activeElectrolysisVariant]: 0 }));
    }
    setStepByGuide((prev) => ({ ...prev, [activeGuideKey]: 1 }));
  };

  const handleSelectCuSO4Variant = (nextVar: 'cuso4-inert' | 'cuso4-copper') => {
    setIsRunning(false);
    setInputErrors({});
    setActiveHotspot2D(null);
    setCuso4Variant(nextVar);
  };

  const handleSelectNaClVariant = (nextVar: 'nacl-molten' | 'nacl-brine') => {
    setIsRunning(false);
    setInputErrors({});
    setActiveHotspot2D(null);
    if (nextVar === 'nacl-molten' && selectedObject === 'nacl-membrane') {
      setSelectedObject(null);
      setWorldZone('TABLE');
      setCameraRequestNonce((n) => n + 1);
    }
    setNaclVariant(nextVar);
    if (selectedStation === 'dien-phan-nacl') {
      setMicroZone(nextVar === 'nacl-molten' ? 'nacl-molten' : 'nacl-brine-membrane');
      if (worldZone === 'MICRO') {
        setCameraRequestNonce((n) => n + 1);
      }
    }
  };

  const handleApplyGuidedStep = (step: LabGuidedStep, observeIn3D = true) => {
    setIsRunning(false);
    setStepByGuide((prev) => ({ ...prev, [activeGuideKey]: step.stepNumber }));

    if (activeGuideKey === 'pin-zn-cu') {
      setGalvanicState((prev) => ({
        ...prev,
        circuitClosed: step.pinCircuitClosed ?? prev.circuitClosed,
        timeSeconds: step.pinTimeSeconds ?? prev.timeSeconds,
      }));
    } else {
      const params = paramsByVariant[activeGuideKey];
      const dep = getDepletionTimeSeconds(params);
      const nextTime =
        step.useDepletionTime && dep !== null
          ? Math.min(dep, params.totalTimeSeconds)
          : (step.timeFraction ?? 0) * params.totalTimeSeconds;
      setTimeByVariant((prev) => ({ ...prev, [activeGuideKey]: nextTime }));
    }

    if (observeIn3D) {
      setSelectedObject(step.focusObject);
      setWorldZone(step.cameraLevel);
      setCameraRequestNonce((n) => n + 1);

      const thumbKey = `${activeGuideKey}-${step.stepNumber}`;
      window.setTimeout(() => {
        const dataUrl = canvasHandleRef.current?.captureThumbnail();
        if (dataUrl) {
          setStepThumbnails((prev) => (prev[thumbKey] ? prev : { ...prev, [thumbKey]: dataUrl }));
        }
      }, reducedMotion ? 80 : 1020);
    }
  };

  const handleRawInputChange = (field: keyof ElectrolysisRawInput, value: string) => {
    setRawInputsByVariant((prev) => ({
      ...prev,
      [activeElectrolysisVariant]: {
        ...prev[activeElectrolysisVariant],
        [field]: value,
      },
    }));
  };

  const handleApplyParams = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRunning) return;
    const { errors, params } = validateElectrolysisParams(
      activeElectrolysisVariant,
      activeRawInput
    );
    setInputErrors(errors);
    if (!params) return;

    setParamsByVariant((prev) => ({
      ...prev,
      [activeElectrolysisVariant]: params,
    }));
    setTimeByVariant((prev) => ({
      ...prev,
      [activeElectrolysisVariant]: Math.min(prev[activeElectrolysisVariant], params.totalTimeSeconds),
    }));
    setIsRunning(false);
  };

  const handleRestoreDefaultParams = () => {
    setIsRunning(false);
    const defRaw = getDefaultRawInput(activeElectrolysisVariant);
    const defParams = getDefaultParams(activeElectrolysisVariant);
    setRawInputsByVariant((prev) => ({ ...prev, [activeElectrolysisVariant]: defRaw }));
    setParamsByVariant((prev) => ({ ...prev, [activeElectrolysisVariant]: defParams }));
    setInputErrors({});
    setTimeByVariant((prev) => ({ ...prev, [activeElectrolysisVariant]: 0 }));
  };

  const toggleMicroOption = (key: keyof MicroDisplayOptions) => {
    setMicroOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleMacroOption = (key: keyof MacroDisplayOptions) => {
    setMacroOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCycleSpeed = () => {
    const quickCycle = [0.5, 1, 2, 4];
    const idx = quickCycle.indexOf(playbackSpeed);
    const next = quickCycle[(idx + 1) % quickCycle.length];
    setPlaybackSpeed(next);
  };

  const primaryButtonLabel = isRunning
    ? 'Tạm dừng'
    : hasStarted && !isAtEnd
      ? 'Tiếp tục'
      : 'Phát';

  const stationObjects = useMemo(
    () => getObjectsForStation(selectedStation, naclVariant),
    [selectedStation, naclVariant]
  );

  const microZonesForStation = useMemo(
    () => getMicroZonesForStation(selectedStation, naclVariant),
    [selectedStation, naclVariant]
  );

  const isExperimentFocused =
    worldZone === 'TABLE' ||
    worldZone === 'OBJECT' ||
    worldZone === 'REACTION' ||
    worldZone === 'MICRO';

  const depletionPercent =
    selectedStation === 'dien-phan-cuso4' &&
    cuso4Variant === 'cuso4-inert' &&
    depletionTime !== null &&
    activeParams.totalTimeSeconds > 0 &&
    depletionTime <= activeParams.totalTimeSeconds
      ? (depletionTime / activeParams.totalTimeSeconds) * 100
      : null;

  const lessonForStation =
    selectedStation === 'pin-zn-cu'
      ? { slug: '4-pin-galvani', label: 'Mở Bài 4: Pin Galvani trên bảng 3D' }
      : selectedStation === 'dien-phan-cuso4'
        ? { slug: '6-dinh-luat-faraday', label: 'Mở Bài 6: Định luật Faraday trên bảng 3D' }
        : { slug: '5-dien-phan', label: 'Mở Bài 5: Điện phân trên bảng 3D' };

  const currentZoneLabel =
    worldZone === 'OVERVIEW'
      ? 'Toàn cảnh phòng lab'
      : worldZone === 'BOARD'
        ? `Bảng học · Bài ${BOARD_MODULES[boardModuleIndex]?.order ?? 1}`
        : worldZone === 'PRACTICE'
          ? 'Bàn luyện tập 3D'
          : worldZone === 'MICRO'
            ? `${LAB_TABLES[selectedStation].badgeLabel} · Vi mô`
            : worldZone === 'REACTION'
              ? `${LAB_TABLES[selectedStation].badgeLabel} · Góc phản ứng`
              : worldZone === 'OBJECT' && selectedObject
                ? LAB_OBJECTS[selectedObject].name
                : `${LAB_TABLES[selectedStation].badgeLabel} · Vĩ mô`;

  const showFloatingBottomDock =
    viewMode === '3d' &&
    worldZone !== 'OVERVIEW' &&
    worldZone !== 'BOARD' &&
    worldZone !== 'PRACTICE' &&
    !activeVisualQuiz;

  return (
    <section
      aria-label="Không gian học tập 3D Pin điện và Điện phân Hóa học 12"
      className="h-full w-full flex flex-col overflow-hidden bg-[#0D1619] text-[#EDF4F1]"
    >
      {/* === COMPACT SINGLE-ROW TOP HUD BAR (~48px) === */}
      <header className="shrink-0 h-12 px-2.5 sm:px-4 border-b border-[#1E2F35] bg-[#0B1417] flex items-center justify-between gap-2 z-30">
        <div className="min-w-0 flex items-center gap-1.5 sm:gap-3">
          <button
            type="button"
            onClick={handleGoOverview}
            className="font-serif text-xs sm:text-base font-semibold tracking-tight text-[#EDF4F1] hover:text-[#78D4C4] transition-colors cursor-pointer whitespace-nowrap"
          >
            ELECTROCHEMISTRY LAB
          </button>
          <span className="hidden sm:inline text-[#324A50]" aria-hidden="true">
            |
          </span>
          <span className="hidden sm:inline text-xs font-mono text-[#78D4C4] truncate">
            <ChemText text={currentZoneLabel} />
          </span>
        </div>

        {/* Minimal utility actions: Toàn cảnh | Khám phá | Hướng dẫn | Cài đặt */}
        <div className="relative flex items-center gap-1.5 shrink-0">
          {worldZone !== 'OVERVIEW' && (
            <button
              type="button"
              data-testid="lab-overview-btn"
              onClick={() => {
                setShowExploreMenu(false);
                handleGoOverview();
              }}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 rounded-md border border-[#324D54] bg-[#132227] text-xs font-medium text-[#EDF4F1] hover:border-[#78D4C4] cursor-pointer whitespace-nowrap"
            >
              <Compass className="w-3.5 h-3.5 text-[#78D4C4]" />
              <span>Toàn cảnh</span>
            </button>
          )}

          {/* Compact Zone Explorer Dropdown (replaces permanent bottom nav bar in Overview) */}
          <button
            type="button"
            data-testid="lab-explore-btn"
            aria-expanded={showExploreMenu}
            aria-haspopup="menu"
            onClick={() => {
              setShowHelpModal(false);
              setShowSettingsPopover(false);
              setShowExploreMenu((v) => !v);
            }}
            className={`min-h-[36px] inline-flex items-center gap-1.5 px-2.5 rounded-md border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              showExploreMenu
                ? 'border-[#78D4C4] bg-[#163036] text-[#78D4C4]'
                : 'border-[#324D54] bg-[#132227] text-[#EDF4F1] hover:border-[#78D4C4]'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-[#78D4C4]" />
            <span>Khám phá</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showExploreMenu ? 'rotate-180' : ''}`} />
          </button>

          <button
            type="button"
            data-testid="lab-help-btn"
            onClick={() => {
              setShowExploreMenu(false);
              setShowSettingsPopover(false);
              setShowHelpModal((v) => !v);
            }}
            aria-expanded={showHelpModal}
            className="min-h-[36px] inline-flex items-center gap-1.5 px-2.5 rounded-md border border-[#324D54] bg-[#132227] text-xs font-medium text-[#EDF4F1] hover:border-[#78D4C4] cursor-pointer whitespace-nowrap"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#78D4C4]" />
            <span className="hidden sm:inline">Hướng dẫn</span>
          </button>

          <button
            type="button"
            data-testid="lab-settings-btn"
            onClick={() => {
              setShowExploreMenu(false);
              setShowHelpModal(false);
              setShowSettingsPopover((v) => !v);
            }}
            aria-expanded={showSettingsPopover}
            className={`min-h-[36px] inline-flex items-center gap-1.5 px-2.5 rounded-md border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              showSettingsPopover
                ? 'border-[#C77B4C] bg-[#281C15] text-[#F5D3BE]'
                : 'border-[#324D54] bg-[#132227] text-[#EDF4F1] hover:border-[#C77B4C]'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-[#E3A678]" />
            <span className="hidden sm:inline">Cài đặt</span>
          </button>

          {/* Compact Zone Navigation Dropdown Menu */}
          {showExploreMenu && (
            <div
              role="menu"
              aria-label="Chọn khu vực phòng thí nghiệm 3D"
              data-testid="lab-explore-menu"
              className="absolute right-0 top-11 z-50 w-[264px] rounded-xl border border-[#78D4C4]/70 bg-[#101E22] p-2 shadow-2xl space-y-1 text-xs"
            >
              <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#78D4C4] border-b border-[#22373E]">
                Chuyển nhanh khu vực phòng lab
              </div>
              <button
                type="button"
                role="menuitem"
                data-testid="zone-tab-board"
                onClick={() => {
                  setShowExploreMenu(false);
                  handleOpenBoard();
                }}
                className="w-full min-h-[38px] px-2.5 rounded-lg text-left flex items-center justify-between gap-2 text-[#EDF4F1] hover:bg-[#193036] cursor-pointer"
              >
                <span className="inline-flex items-center gap-2 font-medium">
                  <BookOpen className="w-4 h-4 text-[#78D4C4]" />
                  Bảng học 3D (10 bài)
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-[#78D4C4]" />
              </button>

              {(['pin-zn-cu', 'dien-phan-cuso4', 'dien-phan-nacl'] as LabExperimentId[]).map((stId) => (
                <button
                  key={stId}
                  type="button"
                  role="menuitem"
                  data-testid={`station-tab-${stId}`}
                  onClick={() => {
                    setShowExploreMenu(false);
                    handleSelectStation(stId);
                  }}
                  className="w-full min-h-[38px] px-2.5 rounded-lg text-left flex items-center justify-between gap-2 text-[#EDF4F1] hover:bg-[#193036] cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2 font-medium">
                    <span className="font-mono text-[10px] text-[#78D4C4] w-5">
                      {LAB_TABLES[stId].shortCode.slice(0, 2)}
                    </span>
                    <ChemText text={LAB_TABLES[stId].badgeLabel} />
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#6D8B91]" />
                </button>
              ))}

              <button
                type="button"
                role="menuitem"
                data-testid="zone-tab-practice"
                onClick={() => {
                  setShowExploreMenu(false);
                  handleOpenPractice();
                }}
                className="w-full min-h-[38px] px-2.5 rounded-lg text-left flex items-center justify-between gap-2 text-[#F8D8BC] bg-[#241A14]/70 hover:bg-[#322219] border border-[#E3A678]/45 cursor-pointer"
              >
                <span className="inline-flex items-center gap-2 font-semibold">
                  <FileText className="w-4 h-4 text-[#F0B988]" />
                  04 · Bàn luyện tập 3D
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-[#F0B988]" />
              </button>
            </div>
          )}

          {/* Settings Popover (Graphics Quality, Sound FX, Camera Speed, Labels, Reduced Motion, 2D) */}
          {showSettingsPopover && (
            <div
              role="dialog"
              aria-label="Cài đặt phòng thí nghiệm 3D"
              data-testid="lab-settings-popover"
              className="absolute right-0 top-11 z-50 w-[290px] sm:w-[320px] rounded-xl border border-[#78D4C4]/70 bg-[#122126] p-4 shadow-2xl space-y-3 text-xs"
            >
              <div className="flex items-center justify-between border-b border-[#253B41] pb-2">
                <span className="font-semibold text-sm text-[#EDF4F1]">Cài đặt không gian 3D</span>
                <button
                  type="button"
                  onClick={() => setShowSettingsPopover(false)}
                  aria-label="Đóng cài đặt"
                  className="min-h-[30px] min-w-[30px] inline-flex items-center justify-center rounded border border-[#334C52] text-[#A2B6B5] hover:text-[#EDF4F1] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Graphics Quality Tier */}
              <div className="space-y-1.5">
                <div className="font-mono text-[11px] text-[#78D4C4]">Chất lượng đồ họa 3D</div>
                <div className="grid grid-cols-4 gap-1">
                  {(
                    [
                      { id: 'auto', label: 'Tự động' },
                      { id: 'ultra', label: 'Ultra' },
                      { id: 'high', label: 'Cao' },
                      { id: 'standard', label: 'Chuẩn' },
                    ] as { id: GraphicsQualityTier; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      data-testid={`quality-tier-${opt.id}`}
                      aria-pressed={graphicsQuality === opt.id}
                      onClick={() => setGraphicsQuality(opt.id)}
                      className={`min-h-[34px] rounded border text-[11px] font-medium cursor-pointer ${
                        graphicsQuality === opt.id
                          ? 'border-[#78D4C4] bg-[#1B353B] text-[#78D4C4] font-semibold'
                          : 'border-[#2B4147] bg-[#0F1B1F] text-[#C8D8D7] hover:border-[#78D4C4]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera transition speed */}
              <div className="space-y-1.5">
                <div className="font-mono text-[11px] text-[#78D4C4]">Tốc độ chuyển góc camera</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'fast', label: 'Nhanh' },
                      { id: 'normal', label: 'Vừa' },
                      { id: 'slow', label: 'Chậm' },
                    ] as { id: CameraSpeedMode; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={cameraSpeedMode === opt.id}
                      onClick={() => setCameraSpeedMode(opt.id)}
                      className={`min-h-[34px] rounded border text-xs font-medium cursor-pointer ${
                        cameraSpeedMode === opt.id
                          ? 'border-[#78D4C4] bg-[#1B353B] text-[#78D4C4] font-semibold'
                          : 'border-[#2B4147] bg-[#0F1B1F] text-[#C8D8D7] hover:border-[#78D4C4]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick toggles */}
              <div className="space-y-1.5">
                <button
                  type="button"
                  aria-pressed={soundEnabled}
                  onClick={() => setSoundEnabled((v) => !v)}
                  className="w-full min-h-[36px] px-3 rounded border border-[#2C434A] bg-[#0F1B1F] flex items-center justify-between text-[#EDF4F1] hover:border-[#78D4C4] cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {soundEnabled ? (
                      <Volume2 className="w-3.5 h-3.5 text-[#78D4C4]" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5 text-[#8FA5A8]" />
                    )}
                    Âm thanh phòng lab nhẹ
                  </span>
                  <span className={soundEnabled ? 'text-[#78D4C4] font-mono' : 'text-[#8FA5A8] font-mono'}>
                    {soundEnabled ? 'Bật' : 'Tắt'}
                  </span>
                </button>

                <button
                  type="button"
                  aria-pressed={showLabels}
                  onClick={() => setShowLabels((v) => !v)}
                  className="w-full min-h-[36px] px-3 rounded border border-[#2C434A] bg-[#0F1B1F] flex items-center justify-between text-[#EDF4F1] hover:border-[#78D4C4] cursor-pointer"
                >
                  <span>Nhãn &amp; chú thích 3D</span>
                  <span className={showLabels ? 'text-[#78D4C4] font-mono' : 'text-[#8FA5A8] font-mono'}>
                    {showLabels ? 'Bật' : 'Tắt'}
                  </span>
                </button>

                <button
                  type="button"
                  aria-pressed={reducedMotion}
                  onClick={() => setReducedMotion((v) => !v)}
                  className="w-full min-h-[36px] px-3 rounded border border-[#2C434A] bg-[#0F1B1F] flex items-center justify-between text-[#EDF4F1] hover:border-[#78D4C4] cursor-pointer"
                >
                  <span>Giảm chuyển động</span>
                  <span className={reducedMotion ? 'text-[#78D4C4] font-mono' : 'text-[#8FA5A8] font-mono'}>
                    {reducedMotion ? 'Bật' : 'Tắt'}
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="lab-fps-toggle-btn"
                  aria-pressed={showFpsDebug}
                  onClick={() => setShowFpsDebug((v) => !v)}
                  className="w-full min-h-[36px] px-3 rounded border border-[#2C434A] bg-[#0F1B1F] flex items-center justify-between text-[#EDF4F1] hover:border-[#78D4C4] cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-[#78D4C4]" />
                    Hiển thị FPS (Debug)
                  </span>
                  <span className={showFpsDebug ? 'text-[#78D4C4] font-mono' : 'text-[#8FA5A8] font-mono'}>
                    {showFpsDebug ? 'Bật' : 'Tắt'}
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="lab-toggle-2d-btn"
                  onClick={() => {
                    setViewMode((m) => (m === '3d' ? '2d' : '3d'));
                    setShowSettingsPopover(false);
                  }}
                  className="w-full min-h-[38px] px-3 rounded border border-[#C77B4C] bg-[#241A14] flex items-center justify-between text-[#F5D3BE] hover:bg-[#312219] cursor-pointer font-medium"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    {viewMode === '3d' ? 'Chuyển sang mô phỏng 2D' : 'Quay lại phòng lab 3D'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* === FULL-VIEWPORT MAIN STAGE (ZERO PAGE SCROLL) === */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {viewMode === '3d' ? (
          <>
            <Suspense
              fallback={
                <div className="w-full h-full bg-[#0E1619] flex items-center justify-center text-sm text-[#A2B6B5]">
                  Đang khởi tạo không gian học tập 3D…
                </div>
              }
            >
              <LazyLab3DCanvas
                ref={canvasHandleRef}
                worldZone={worldZone}
                selectedStation={isExperimentFocused ? selectedStation : null}
                selectedObject={selectedObject}
                microZone={microZone}
                microFrame={microFrame}
                microOptions={microOptions}
                macroOptions={macroOptions}
                graphicsQuality={graphicsQuality}
                practiceLampOn={practiceLampOn}
                showFpsDebug={showFpsDebug}
                trackedSpecies={trackedSpecies}
                cameraSpeedMode={cameraSpeedMode}
                practiceFlipNonce={practiceFlipNonce}
                visualQuiz={visualQuizState}
                cameraRequestNonce={cameraRequestNonce}
                showLabels={showLabels}
                reducedMotion={reducedMotion}
                isRunning={isRunning}
                visuals={lab3DVisuals}
                galvanicSnapshot={galvanicSnapshot}
                cuso4Variant={cuso4Variant}
                cuso4Params={cuso4Params}
                cuso4Snapshot={cuso4Snapshot}
                naclVariant={naclVariant}
                naclParams={naclParams}
                naclSnapshot={naclSnapshot}
                onSelectZone={handleSelectZoneFrom3D}
                onSelectStation={handleSelectStation}
                onSelectObject={handleSelectObject}
                onVisualQuizPick={handleVisualQuizPick}
                onSelectSpecies={setTrackedSpecies}
                onEnterMicro={handleEnterMicro}
                onExitMicro={handleExitMicro}
                onBackToTable={handleBackToTable}
                onOpenReactionView={handleOpenReactionView}
                onToggleRun={handlePrimaryPlayToggle}
                onTogglePinSwitch={handleTogglePinSwitch}
                onFallbackTo2D={() => setViewMode('2d')}
              >
                {/* CONTEXTUAL OVERLAY 1: 3D SMART TEACHING BOARD */}
                {worldZone === 'BOARD' && (
                  <SmartBoardPanel
                    activeModuleIndex={boardModuleIndex}
                    completedLessonSlugs={progress.completedLessonSlugs}
                    onSelectModule={(idx) => {
                      setBoardModuleIndex(idx);
                      const slug = BOARD_MODULES[idx]?.lessonSlug;
                      if (slug) {
                        onMarkCurrentLesson(slug);
                        onSyncHash?.(`#/bai/${slug}`);
                      }
                    }}
                    onToggleLessonComplete={(slug) => {
                      playLabSound('chime', soundEnabled);
                      onToggleLessonComplete(slug);
                    }}
                    onObserveModel={handleBoardObserveModel}
                    onObserveMicro={handleBoardObserveMicro}
                    onBackToRoom={handleGoOverview}
                  />
                )}

                {/* CONTEXTUAL OVERLAY 2: 3D PRACTICE DESK DOSSIER & EXAM SHEET */}
                {worldZone === 'PRACTICE' && (
                  <PracticeDeskPanel
                    session={practiceSession}
                    lastQuizResult={progress.lastQuizResult}
                    completedDeckIds={progress.completedDeckIds}
                    reducedMotion={reducedMotion}
                    practiceLampOn={practiceLampOn}
                    onTogglePracticeLamp={() => {
                      playLabSound('switch', soundEnabled);
                      setPracticeLampOn((v) => !v);
                    }}
                    onUpdateSession={setPracticeSession}
                    onTriggerPageFlip={() => {
                      playLabSound('paper', soundEnabled);
                      setPracticeFlipNonce((n) => n + 1);
                    }}
                    onObservePhenomenon={handlePracticeObservePhenomenon}
                    onStartVisual3DPick={handleStartVisual3DPick}
                    onRecordOutcome={onRecordQuestionOutcome}
                    onSaveQuizResult={(res, deckId) => {
                      playLabSound('chime', soundEnabled);
                      onSaveQuizResult(res, deckId);
                    }}
                    onBackToRoom={handleGoOverview}
                  />
                )}

                {/* CONTEXTUAL OVERLAY 3: ACTIVE 3D VISUAL-PICKING QUIZ BANNER */}
                {activeVisualQuiz && worldZone !== 'PRACTICE' && (
                  <div
                    role="region"
                    aria-label="Câu hỏi chọn trực tiếp trên mô hình 3D"
                    data-testid="visual-quiz-banner"
                    className="absolute top-3 left-3 right-3 max-w-3xl mx-auto z-30 rounded-xl border-2 border-[#E3A678] bg-[#122024]/96 px-3.5 py-2.5 shadow-2xl space-y-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#F0B988] font-semibold">
                          <Crosshair className="w-3.5 h-3.5" />
                          Chọn trực tiếp trên mô hình
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-[#EDF4F1]">
                          <ChemText text={activeVisualQuiz.prompt} />
                        </p>
                      </div>

                      <button
                        type="button"
                        data-testid="visual-quiz-confirm-btn"
                        onClick={handleFinishVisualQuizPick}
                        className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 rounded-lg bg-[#78D4C4] text-[#10191C] text-xs font-semibold hover:bg-[#94E4D6] cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Quay lại đề
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-[#9AB0B2]">Chạm trên mô hình 3D hoặc chọn nhanh:</span>
                      {activeVisualQuiz.candidateObjects.map((objId) => {
                        const picked = practiceSession.answers[activeVisualQuiz.id] === objId;
                        return (
                          <button
                            key={objId}
                            type="button"
                            data-testid={`visual-quiz-chip-${objId}`}
                            aria-pressed={picked}
                            onClick={() => handleVisualQuizPick(objId)}
                            className={`min-h-[32px] px-2.5 rounded border font-medium transition-colors cursor-pointer whitespace-nowrap ${
                              picked
                                ? 'border-[#78D4C4] bg-[#19353B] text-[#78D4C4]'
                                : 'border-[#30474D] bg-[#0E191C] text-[#DCE5E6] hover:border-[#E3A678]'
                            }`}
                          >
                            <ChemText text={LAB_OBJECTS[objId].name} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* CONTEXTUAL OVERLAY 4: RETURN TO LESSON / RETURN TO PRACTICE BANNER */}
                {returnContext &&
                  !activeVisualQuiz &&
                  worldZone !== 'BOARD' &&
                  worldZone !== 'PRACTICE' && (
                    <div className="absolute top-3 left-3 z-20">
                      <button
                        type="button"
                        data-testid="return-context-btn"
                        onClick={handleReturnToContext}
                        className="min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-lg border border-[#78D4C4] bg-[#0F1F24]/95 text-xs font-semibold text-[#78D4C4] shadow-xl hover:bg-[#173036] cursor-pointer whitespace-nowrap"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {returnContext.from === 'BOARD'
                          ? `Về Bài ${BOARD_MODULES[returnContext.moduleIndex]?.order ?? 1}`
                          : 'Quay lại bài tập'}
                      </button>
                    </div>
                  )}
              </LazyLab3DCanvas>
            </Suspense>

            {/* === CONTEXTUAL TOP-RIGHT QUICK TELEMETRY & VARIANT SWITCH (MACRO TABLE/REACTION ONLY) === */}
            {isExperimentFocused && worldZone !== 'MICRO' && !activeVisualQuiz && (
              <div className="absolute top-3 right-3 z-20 flex flex-wrap items-center justify-end gap-1.5 max-w-[calc(100%-24px)]">
                {/* Live compact readout */}
                <div
                  data-testid="sim-time-readout"
                  className="px-2.5 py-1.5 rounded-lg border border-[#2B434A] bg-[#0E1B1F]/92 text-[11px] sm:text-xs font-mono tabular-nums text-[#78D4C4] shadow-lg whitespace-nowrap"
                >
                  {selectedStation === 'pin-zn-cu' ? (
                    <>
                      t = {formatViNumber(galvanicSnapshot.timeSeconds, { maxDecimals: 1 })} s · U ={' '}
                      {formatViNumber(galvanicSnapshot.terminalVoltageV, {
                        minDecimals: 3,
                        maxDecimals: 3,
                      })}{' '}
                      V
                    </>
                  ) : (
                    <>
                      t = {formatViNumber(activeElectrolysisSnapshot.timeSeconds, { maxDecimals: 0 })}/
                      {formatViNumber(activeParams.totalTimeSeconds, { maxDecimals: 0 })} s · I ={' '}
                      {formatViNumber(activeParams.currentA, { maxDecimals: 1 })} A
                    </>
                  )}
                </div>

                {/* 1-click contextual switch / variant toggle */}
                {selectedStation === 'pin-zn-cu' && (
                  <button
                    type="button"
                    data-testid="pin-switch-btn"
                    onClick={handleTogglePinSwitch}
                    aria-pressed={galvanicState.circuitClosed}
                    className={`min-h-[32px] px-2.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shadow-lg ${
                      galvanicState.circuitClosed
                        ? 'border-[#78D4C4] bg-[#142D32]/95 text-[#78D4C4]'
                        : 'border-[#E3A678] bg-[#281B14]/95 text-[#FAD8BC]'
                    }`}
                  >
                    {galvanicState.circuitClosed ? 'Mạch: Đóng' : 'Mạch: Mở'}
                  </button>
                )}

                {selectedStation === 'dien-phan-cuso4' && (
                  <div className="inline-flex rounded-lg border border-[#2D444B] bg-[#0D181B]/95 p-0.5 shadow-lg">
                    <button
                      type="button"
                      data-testid="variant-cuso4-inert"
                      aria-pressed={cuso4Variant === 'cuso4-inert'}
                      onClick={() => handleSelectCuSO4Variant('cuso4-inert')}
                      className={`min-h-[30px] px-2 rounded text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                        cuso4Variant === 'cuso4-inert'
                          ? 'bg-[#C77B4C] text-[#10191C]'
                          : 'text-[#C8D8D7] hover:text-[#EDF4F1]'
                      }`}
                    >
                      Cực trơ
                    </button>
                    <button
                      type="button"
                      data-testid="variant-cuso4-copper"
                      aria-pressed={cuso4Variant === 'cuso4-copper'}
                      onClick={() => handleSelectCuSO4Variant('cuso4-copper')}
                      className={`min-h-[30px] px-2 rounded text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                        cuso4Variant === 'cuso4-copper'
                          ? 'bg-[#C77B4C] text-[#10191C]'
                          : 'text-[#C8D8D7] hover:text-[#EDF4F1]'
                      }`}
                    >
                      Anode Cu
                    </button>
                  </div>
                )}

                {selectedStation === 'dien-phan-nacl' && (
                  <div className="inline-flex rounded-lg border border-[#2D444B] bg-[#0D181B]/95 p-0.5 shadow-lg">
                    <button
                      type="button"
                      data-testid="variant-nacl-molten"
                      aria-pressed={naclVariant === 'nacl-molten'}
                      onClick={() => handleSelectNaClVariant('nacl-molten')}
                      className={`min-h-[30px] px-2 rounded text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                        naclVariant === 'nacl-molten'
                          ? 'bg-[#C77B4C] text-[#10191C]'
                          : 'text-[#C8D8D7] hover:text-[#EDF4F1]'
                      }`}
                    >
                      Nóng chảy
                    </button>
                    <button
                      type="button"
                      data-testid="variant-nacl-brine"
                      aria-pressed={naclVariant === 'nacl-brine'}
                      onClick={() => handleSelectNaClVariant('nacl-brine')}
                      className={`min-h-[30px] px-2 rounded text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                        naclVariant === 'nacl-brine'
                          ? 'bg-[#C77B4C] text-[#10191C]'
                          : 'text-[#C8D8D7] hover:text-[#EDF4F1]'
                      }`}
                    >
                      Có màng
                    </button>
                  </div>
                )}

                {/* Focus Reaction lighting toggle */}
                <button
                  type="button"
                  data-testid="macro-focus-reaction-btn"
                  aria-pressed={macroOptions.focusReaction}
                  onClick={() => toggleMacroOption('focusReaction')}
                  title="Tập trung ánh sáng vào vùng phản ứng"
                  className={`min-h-[32px] px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shadow-lg ${
                    macroOptions.focusReaction
                      ? 'border-[#E3A678] bg-[#291C15]/95 text-[#FAD8BC]'
                      : 'border-[#2D444B] bg-[#0E1B1F]/92 text-[#C8D8D7] hover:border-[#E3A678]'
                  }`}
                >
                  <Focus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tập trung</span>
                </button>
              </div>
            )}

            {/* === CONTEXTUAL OVERLAY SHEET ("THÊM" — IN-VIEWPORT, ZERO PAGE SCROLL) === */}
            {drawerOpen && isExperimentFocused && !activeVisualQuiz && (
              <div
                role="dialog"
                aria-label="Tùy chọn mở rộng và công cụ khoa học"
                data-testid="lab-more-sheet"
                className="absolute bottom-[68px] left-1/2 -translate-x-1/2 z-30 w-[min(96vw,880px)] max-h-[64vh] flex flex-col rounded-xl border border-[#78D4C4]/75 bg-[#101E22]/96 text-[#EDF4F1] shadow-2xl overflow-hidden"
              >
                {/* Sheet Header + Compact Tabs */}
                <div className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-[#24393F] bg-[#0B1518]">
                  <div
                    role="tablist"
                    aria-label="Mục khoa học và tùy chỉnh"
                    className="flex items-center gap-1 overflow-x-auto"
                  >
                    {(
                      [
                        { id: 'display', label: 'Hiển thị & Tua' },
                        { id: 'steps', label: '10 bước' },
                        { id: 'results', label: 'Kết quả & PT' },
                        { id: 'params', label: 'Faraday & Đồ thị' },
                        { id: 'compare', label: 'Trước / Sau' },
                      ] as { id: DrawerTab; label: string }[]
                    ).map((tab) => {
                      const active = drawerTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          data-testid={`drawer-tab-${tab.id}`}
                          aria-selected={active}
                          onClick={() => setDrawerTab(tab.id)}
                          className={`min-h-[34px] px-2.5 rounded-md border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            active
                              ? 'border-[#78D4C4] bg-[#173036] text-[#78D4C4] font-semibold'
                              : 'border-transparent text-[#B3C5C6] hover:text-[#EDF4F1] hover:bg-[#142429]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Đóng bảng mở rộng"
                    className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded border border-[#324B52] text-[#A2B6B5] hover:text-[#EDF4F1] cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Sheet Body (internal scroll only) */}
                <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-4">
                  {/* TAB: DISPLAY LAYERS, TIMELINE SCRUBBER, SPEED & APPARATUS */}
                  {drawerTab === 'display' && (
                    <div className="space-y-4">
                      {/* Time Scrubber + Step Back/Forward + Speed Presets */}
                      <div className="rounded-lg border border-[#24393F] bg-[#0C1619] p-3 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              data-testid="step-back-btn"
                              onClick={() => handleStepTime(-1)}
                              className="min-h-[34px] inline-flex items-center gap-1 px-2.5 rounded border border-[#324A50] bg-[#122024] text-xs text-[#EDF4F1] hover:border-[#78D4C4] cursor-pointer whitespace-nowrap"
                            >
                              <StepBack className="w-3.5 h-3.5 text-[#78D4C4]" />
                              Lùi 1 bước
                            </button>
                            <button
                              type="button"
                              data-testid="step-forward-btn"
                              onClick={() => handleStepTime(1)}
                              className="min-h-[34px] inline-flex items-center gap-1 px-2.5 rounded border border-[#324A50] bg-[#122024] text-xs text-[#EDF4F1] hover:border-[#78D4C4] cursor-pointer whitespace-nowrap"
                            >
                              <StepForward className="w-3.5 h-3.5 text-[#78D4C4]" />
                              Tiến 1 bước
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-[#9AB0B2] mr-1">Tốc độ:</span>
                            {SPEED_PRESETS.map((spd) => (
                              <button
                                key={spd}
                                type="button"
                                data-testid={`speed-btn-${spd}`}
                                aria-pressed={playbackSpeed === spd}
                                onClick={() => setPlaybackSpeed(spd)}
                                className={`min-h-[30px] px-2 text-xs font-mono rounded border cursor-pointer ${
                                  playbackSpeed === spd
                                    ? 'border-[#78D4C4] bg-[#1A353B] text-[#78D4C4] font-semibold'
                                    : 'border-[#273C42] bg-[#101C20] text-[#A2B6B5] hover:text-[#EDF4F1]'
                                }`}
                              >
                                {formatViNumber(spd, { maxDecimals: 2 })}×
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="relative flex items-center">
                          <label htmlFor="lab-time-scrubber" className="sr-only">
                            Thanh tua thời gian mô phỏng
                          </label>
                          <input
                            id="lab-time-scrubber"
                            type="range"
                            min={0}
                            max={
                              selectedStation === 'pin-zn-cu'
                                ? galvanicSnapshot.totalTimeSeconds
                                : Math.max(activeParams.totalTimeSeconds, 1)
                            }
                            step={
                              selectedStation === 'pin-zn-cu'
                                ? 0.5
                                : activeParams.totalTimeSeconds > 200
                                  ? 1
                                  : 0.1
                            }
                            value={
                              selectedStation === 'pin-zn-cu'
                                ? galvanicSnapshot.timeSeconds
                                : activeElectrolysisSnapshot.timeSeconds
                            }
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setIsRunning(false);
                              if (selectedStation === 'pin-zn-cu') {
                                setGalvanicState((prev) => ({ ...prev, timeSeconds: val }));
                              } else {
                                setTimeByVariant((prev) => ({
                                  ...prev,
                                  [activeElectrolysisVariant]: val,
                                }));
                              }
                            }}
                            className="w-full accent-[#78D4C4] h-2 cursor-pointer"
                          />
                          {depletionPercent !== null && (
                            <div
                              className="pointer-events-none absolute top-0 bottom-0 flex items-center"
                              style={{ left: `${depletionPercent}%`, transform: 'translateX(-50%)' }}
                            >
                              <div className="w-0.5 h-5 bg-[#C77B4C]" />
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#A2B6B5]">
                          <span>
                            <ChemText
                              text={
                                selectedStation === 'pin-zn-cu'
                                  ? galvanicSnapshot.stageTitle
                                  : activeElectrolysisSnapshot.stageLabel
                              }
                            />
                          </span>
                          {depletionPercent !== null && depletionTime !== null && (
                            <button
                              type="button"
                              data-testid="cuso4-depletion-btn"
                              onClick={() => {
                                setIsRunning(false);
                                setTimeByVariant((prev) => ({
                                  ...prev,
                                  [activeElectrolysisVariant]: depletionTime,
                                }));
                              }}
                              className="text-[#E8B17E] hover:underline font-medium cursor-pointer"
                            >
                              Mốc hết Cu²⁺: {formatViNumber(depletionTime, { maxDecimals: 1 })} s (nhảy tới)
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Contextual Layer Controls: Macro OR Micro */}
                      {worldZone === 'MICRO' ? (
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <div className="text-xs font-mono text-[#78D4C4]">Vùng quan sát vi mô</div>
                            <div className="flex flex-wrap gap-1.5">
                              {microZonesForStation.map((z) => {
                                const active = microZone === z.id;
                                return (
                                  <button
                                    key={z.id}
                                    type="button"
                                    data-testid={`micro-zone-${z.id}`}
                                    aria-pressed={active}
                                    onClick={() => {
                                      setMicroZone(z.id);
                                      setTrackedSpecies(null);
                                      setCameraRequestNonce((n) => n + 1);
                                    }}
                                    className={`min-h-[34px] px-2.5 rounded border text-xs font-medium cursor-pointer whitespace-nowrap ${
                                      active
                                        ? 'border-[#78D4C4] bg-[#19353B] text-[#78D4C4] font-semibold'
                                        : 'border-[#2D4349] bg-[#0F1B1E] text-[#C8D8D7] hover:border-[#78D4C4]'
                                    }`}
                                  >
                                    <ChemText text={z.shortLabel} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-1.5" data-testid="micro-options-bar">
                            <div className="text-xs font-mono text-[#78D4C4]">Lớp hiển thị vi mô</div>
                            <div className="flex flex-wrap gap-1.5 text-xs">
                              {(
                                [
                                  { key: 'showIonLabels', label: 'Tên ion' },
                                  { key: 'showArrows', label: 'Mũi tên chuyển động' },
                                  { key: 'showEquations', label: 'Phương trình' },
                                  { key: 'showReactionZone', label: 'Vùng phản ứng' },
                                  { key: 'showHydration', label: 'Lớp hydrat hóa' },
                                  { key: 'cutaway', label: 'Cắt lớp bình' },
                                ] as { key: keyof MicroDisplayOptions; label: string }[]
                              ).map((opt) => (
                                <button
                                  key={opt.key}
                                  type="button"
                                  data-testid={`micro-opt-${opt.key}`}
                                  aria-pressed={microOptions[opt.key]}
                                  onClick={() => toggleMicroOption(opt.key)}
                                  className={`min-h-[32px] px-2.5 rounded border font-medium transition-colors cursor-pointer ${
                                    microOptions[opt.key]
                                      ? 'border-[#78D4C4] bg-[#163036] text-[#78D4C4]'
                                      : 'border-[#2A3F45] bg-[#0F191C] text-[#8EA4A7] hover:text-[#EDF4F1]'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-1.5" data-testid="macro-options-bar">
                            <div className="text-xs font-mono text-[#78D4C4]">
                              Lớp quan sát Vĩ mô (bật / tắt hiện tượng)
                            </div>
                            <div className="flex flex-wrap gap-1.5 text-xs">
                              {(
                                [
                                  { key: 'showElectronFlow', label: 'Hướng electron' },
                                  { key: 'showIonFlow', label: 'Hướng ion' },
                                  { key: 'showReactionZone', label: 'Vùng phản ứng' },
                                  { key: 'showPolarityLabels', label: 'Chú thích cực' },
                                  { key: 'showSolutionLabels', label: 'Tên dung dịch' },
                                  { key: 'showProductLabels', label: 'Sản phẩm' },
                                  { key: 'focusReaction', label: 'Tập trung hiện tượng' },
                                ] as { key: keyof MacroDisplayOptions; label: string }[]
                              ).map((opt) => (
                                <button
                                  key={opt.key}
                                  type="button"
                                  data-testid={`macro-opt-${opt.key}`}
                                  aria-pressed={macroOptions[opt.key]}
                                  onClick={() => toggleMacroOption(opt.key)}
                                  className={`min-h-[32px] px-2.5 rounded border font-medium transition-colors cursor-pointer ${
                                    macroOptions[opt.key]
                                      ? 'border-[#78D4C4] bg-[#163036] text-[#78D4C4]'
                                      : 'border-[#2A3F45] bg-[#0F191C] text-[#8EA4A7] hover:text-[#EDF4F1]'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="text-xs font-mono text-[#9AB0B2]">
                              Soi cận cảnh dụng cụ trên bàn
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {stationObjects.map((obj) => {
                                const active = selectedObject === obj.id && worldZone === 'OBJECT';
                                return (
                                  <button
                                    key={obj.id}
                                    type="button"
                                    data-testid={`object-chip-${obj.id}`}
                                    onClick={() => {
                                      setDrawerOpen(false);
                                      handleSelectObject(obj.id);
                                    }}
                                    className={`min-h-[32px] px-2.5 rounded border text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
                                      active
                                        ? 'border-[#78D4C4] bg-[#173036] text-[#78D4C4]'
                                        : 'border-[#2D4349] bg-[#0F1B1E] text-[#C8D8D7] hover:border-[#78D4C4]'
                                    }`}
                                  >
                                    <ChemText text={obj.name} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB: 10-STEP GUIDED STORYBOARD */}
                  {drawerTab === 'steps' && (
                    <LabStepGallery
                      guideKey={activeGuideKey}
                      activeStepNumber={stepByGuide[activeGuideKey] ?? 1}
                      thumbnails={stepThumbnails}
                      onSelectStep={(step, observeIn3D) => {
                        handleApplyGuidedStep(step, observeIn3D);
                        if (observeIn3D) setDrawerOpen(false);
                      }}
                    />
                  )}

                  {/* TAB: HALF-REACTIONS, LIVE PRODUCTS & LESSON JUMP */}
                  {drawerTab === 'results' && (
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-3 gap-3">
                        {selectedStation === 'pin-zn-cu' ? (
                          <>
                            <div className="rounded border border-[#2B4249] bg-[#0E181B] p-3 space-y-1">
                              <div className="text-xs font-mono text-[#78D4C4]">Anode (−) · Oxi hóa</div>
                              <div className="text-sm sm:text-base font-medium text-[#EDF4F1]">
                                <ChemText text={galvanicSnapshot.anodeEquation} />
                              </div>
                              <p className="text-xs text-[#A2B6B5]">
                                Thanh Zn mòn dần ({formatViNumber(galvanicSnapshot.znDissolvedMg, { maxDecimals: 1 })} mg minh họa).
                              </p>
                            </div>
                            <div className="rounded border border-[#2B4249] bg-[#0E181B] p-3 space-y-1">
                              <div className="text-xs font-mono text-[#E3A678]">Cathode (+) · Khử</div>
                              <div className="text-sm sm:text-base font-medium text-[#EDF4F1]">
                                <ChemText text={galvanicSnapshot.cathodeEquation} />
                              </div>
                              <p className="text-xs text-[#A2B6B5]">
                                Đồng bám lên thanh Cu ({formatViNumber(galvanicSnapshot.cuDepositedMg, { maxDecimals: 1 })} mg minh họa).
                              </p>
                            </div>
                            <div className="rounded border border-[#2B4249] bg-[#0E181B] p-3 space-y-1">
                              <div className="text-xs font-mono text-[#A2B6B5]">Phản ứng tổng &amp; Điện áp</div>
                              <div className="text-sm sm:text-base font-medium text-[#EDF4F1]">
                                <ChemText text={galvanicSnapshot.overallEquation} />
                              </div>
                              <p className="text-xs font-mono text-[#78D4C4] tabular-nums">
                                E°pin = 1,103 V · U ={' '}
                                {formatViNumber(galvanicSnapshot.terminalVoltageV, {
                                  minDecimals: 3,
                                  maxDecimals: 3,
                                })}{' '}
                                V
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="rounded border border-[#2B4249] bg-[#0E181B] p-3 space-y-1">
                              <div className="text-xs font-mono text-[#78D4C4]">Cathode (−) · Khử</div>
                              <div className="text-sm sm:text-base font-medium text-[#EDF4F1]">
                                <ChemText text={activeElectrolysisSnapshot.cathodeEquation} />
                              </div>
                            </div>
                            <div className="rounded border border-[#2B4249] bg-[#0E181B] p-3 space-y-1">
                              <div className="text-xs font-mono text-[#E3A678]">Anode (+) · Oxi hóa</div>
                              <div className="text-sm sm:text-base font-medium text-[#EDF4F1]">
                                <ChemText text={activeElectrolysisSnapshot.anodeEquation} />
                              </div>
                            </div>
                            <div className="rounded border border-[#2B4249] bg-[#0E181B] p-3 space-y-1">
                              <div className="text-xs font-mono text-[#A2B6B5]">Phương trình tổng</div>
                              <div className="text-sm font-medium text-[#EDF4F1]">
                                <ChemText text={activeElectrolysisSnapshot.overallEquation} />
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {selectedStation === 'dien-phan-cuso4' && cuso4Variant === 'cuso4-inert' && (
                        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-sm font-mono tabular-nums">
                          <div className="rounded bg-[#0E181B] p-2.5 border border-[#23373D]">
                            <dt className="font-sans text-xs text-[#A2B6B5]">Cu bám cathode</dt>
                            <dd className="text-[#E3A678] font-semibold mt-0.5">
                              {formatViNumber(cuso4Snapshot.cuPlatedG, { minDecimals: 3, maxDecimals: 3 })} g
                            </dd>
                          </div>
                          <div className="rounded bg-[#0E181B] p-2.5 border border-[#23373D]">
                            <dt className="font-sans text-xs text-[#A2B6B5]">
                              <ChemText text="Cu²⁺ còn lại" />
                            </dt>
                            <dd className="text-[#EDF4F1] font-semibold mt-0.5">
                              {formatViNumber(cuso4Snapshot.cu2RemainingMol, { minDecimals: 4, maxDecimals: 4 })} mol
                            </dd>
                          </div>
                          <div className="rounded bg-[#0E181B] p-2.5 border border-[#23373D]">
                            <dt className="font-sans text-xs text-[#A2B6B5]">
                              <ChemText text="Khí O₂ (anode +)" />
                            </dt>
                            <dd className="text-[#78D4C4] font-semibold mt-0.5">
                              {formatViNumber(cuso4Snapshot.o2Mol, { minDecimals: 4, maxDecimals: 4 })} mol
                            </dd>
                          </div>
                          <div className="rounded bg-[#0E181B] p-2.5 border border-[#23373D]">
                            <dt className="font-sans text-xs text-[#A2B6B5]">
                              <ChemText text="Khí H₂ (cathode −)" />
                            </dt>
                            <dd className="text-[#EDF4F1] font-semibold mt-0.5">
                              {formatViNumber(cuso4Snapshot.h2Mol, { minDecimals: 4, maxDecimals: 4 })} mol
                            </dd>
                          </div>
                        </dl>
                      )}

                      {selectedStation === 'dien-phan-cuso4' && cuso4Variant === 'cuso4-copper' && (
                        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-sm font-mono tabular-nums">
                          <div className="rounded bg-[#0E181B] p-2.5 border border-[#23373D]">
                            <dt className="font-sans text-xs text-[#A2B6B5]">Cu tan ở anode (+)</dt>
                            <dd className="text-[#78D4C4] font-semibold mt-0.5">
                              {formatViNumber(cuso4Snapshot.cuLostAtAnodeG, { minDecimals: 3, maxDecimals: 3 })} g
                            </dd>
                          </div>
                          <div className="rounded bg-[#0E181B] p-2.5 border border-[#23373D]">
                            <dt className="font-sans text-xs text-[#A2B6B5]">Cu bám cathode (−)</dt>
                            <dd className="text-[#E3A678] font-semibold mt-0.5">
                              {formatViNumber(cuso4Snapshot.cuPlatedG, { minDecimals: 3, maxDecimals: 3 })} g
                            </dd>
                          </div>
                          <div className="rounded bg-[#0E181B] p-2.5 border border-[#23373D]">
                            <dt className="font-sans text-xs text-[#A2B6B5]">Thanh Cu anode còn lại</dt>
                            <dd className="text-[#EDF4F1] font-semibold mt-0.5">
                              {formatViNumber(cuso4Snapshot.anodeCuRemainingG, { minDecimals: 3, maxDecimals: 3 })} /{' '}
                              {formatViNumber(ANODE_COPPER_INITIAL_G, { minDecimals: 1, maxDecimals: 1 })} g
                            </dd>
                          </div>
                        </dl>
                      )}

                      {selectedStation === 'dien-phan-nacl' && (
                        <>
                          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-sm font-mono tabular-nums">
                            {naclVariant === 'nacl-molten' ? (
                              <div className="rounded bg-[#0E181B] p-2.5 border border-[#23373D]">
                                <dt className="font-sans text-xs text-[#A2B6B5]">Na lỏng (cathode −)</dt>
                                <dd className="text-[#E3A678] font-semibold mt-0.5">
                                  {formatViNumber(naclSnapshot.naProducedG, { minDecimals: 3, maxDecimals: 3 })} g
                                </dd>
                              </div>
                            ) : (
                              <>
                                <div className="rounded bg-[#0E181B] p-2.5 border border-[#23373D]">
                                  <dt className="font-sans text-xs text-[#A2B6B5]">
                                    <ChemText text="Khí H₂ (cathode −)" />
                                  </dt>
                                  <dd className="text-[#78D4C4] font-semibold mt-0.5">
                                    {formatViNumber(naclSnapshot.h2Mol, { minDecimals: 4, maxDecimals: 4 })} mol
                                  </dd>
                                </div>
                                <div className="rounded bg-[#0E181B] p-2.5 border border-[#23373D]">
                                  <dt className="font-sans text-xs text-[#A2B6B5]">
                                    <ChemText text="NaOH / OH⁻ (ngăn cathode)" />
                                  </dt>
                                  <dd className="text-[#EDF4F1] font-semibold mt-0.5">
                                    {formatViNumber(naclSnapshot.ohProducedMol, { minDecimals: 4, maxDecimals: 4 })} mol
                                  </dd>
                                </div>
                              </>
                            )}
                            <div className="rounded bg-[#0E181B] p-2.5 border border-[#23373D]">
                              <dt className="font-sans text-xs text-[#A2B6B5]">
                                <ChemText text="Khí Cl₂ (anode +)" />
                              </dt>
                              <dd className="text-[#C8DF78] font-semibold mt-0.5">
                                {formatViNumber(naclSnapshot.cl2Mol, { minDecimals: 4, maxDecimals: 4 })} mol
                              </dd>
                            </div>
                          </dl>

                          <p className="text-xs text-[#E8C5A5] bg-[#221914] border border-[#5B3D2C] rounded px-3 py-2">
                            Ghi chú an toàn khoa học: Khí <ChemText text="Cl₂" /> độc, kim loại Na hoạt động hóa học mạnh và dung dịch NaOH ăn mòn. Mô phỏng này chỉ phục vụ học tập kiến thức Hóa học 12.
                          </p>
                        </>
                      )}

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleOpenBoard(getBoardModuleIndexForSlug(lessonForStation.slug))}
                          className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 rounded-lg border border-[#C77B4C] bg-[#241A14] text-xs font-medium text-[#F5D3BE] hover:bg-[#312219] cursor-pointer"
                        >
                          <BookOpen className="w-4 h-4" />
                          {lessonForStation.label}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TAB: FARADAY PARAMETERS & QUANTITATIVE CHART */}
                  {drawerTab === 'params' && (
                    <div className="space-y-4">
                      {selectedStation === 'pin-zn-cu' ? (
                        <div className="grid md:grid-cols-2 gap-3 text-sm">
                          <div className="rounded border border-[#283E44] bg-[#0E181B] p-3.5 space-y-2">
                            <h3 className="font-serif text-base font-semibold" style={{ color: '#EDF4F1' }}>
                              Mô hình vôn kế Pin Zn–Cu
                            </h3>
                            <p className="text-xs sm:text-sm text-[#C8D8D7]">
                              Sức điện động chuẩn:{' '}
                              <ChemText text="E°pin = E°(Cu²⁺/Cu) − E°(Zn²⁺/Zn) = (+0,340) − (−0,763) = 1,103 V" />.
                            </p>
                            <div className="font-mono text-xs sm:text-sm text-[#78D4C4] bg-[#132227] p-2.5 rounded border border-[#243B42]">
                              U tải = 1,103 × 100 / (100 + 2) ≈ <strong>1,081 V</strong>
                              <br />I = 1,103 / 102 ≈ <strong>10,81 mA</strong>
                            </div>
                          </div>
                          <div className="rounded border border-[#283E44] bg-[#0E181B] p-3.5 space-y-2">
                            <h3 className="font-serif text-base font-semibold" style={{ color: '#EDF4F1' }}>
                              Cân bằng điện tích qua cầu muối <ChemText text="KNO₃" />
                            </h3>
                            <ul className="space-y-1 text-xs sm:text-sm text-[#C8D8D7]">
                              <li>• Electron chạy theo dây ngoài từ Zn (−) sang Cu (+).</li>
                              <li>
                                • Ion <ChemText text="NO₃⁻" /> về ngăn Zn; ion <ChemText text="K⁺" /> về ngăn Cu.
                              </li>
                            </ul>
                          </div>
                        </div>
                      ) : (
                        <>
                          <form onSubmit={handleApplyParams} className="space-y-3">
                            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                              <div>
                                <label htmlFor="sim-input-current" className="block text-xs text-[#C8D8D7] mb-1">
                                  Cường độ dòng điện I (A)
                                </label>
                                <input
                                  id="sim-input-current"
                                  type="text"
                                  inputMode="decimal"
                                  disabled={isRunning}
                                  value={activeRawInput.currentStr}
                                  onChange={(e) => handleRawInputChange('currentStr', e.target.value)}
                                  className="w-full min-h-[40px] px-3 rounded border border-[#30474D] bg-[#0E181B] text-[#EDF4F1] text-sm font-mono disabled:opacity-60"
                                />
                                {inputErrors.current && (
                                  <p role="alert" className="mt-1 text-xs text-[#F5A882]">
                                    {inputErrors.current}
                                  </p>
                                )}
                              </div>

                              <div>
                                <label htmlFor="sim-input-time" className="block text-xs text-[#C8D8D7] mb-1">
                                  Thời gian điện phân t
                                </label>
                                <div className="flex gap-1.5">
                                  <input
                                    id="sim-input-time"
                                    type="text"
                                    inputMode="decimal"
                                    disabled={isRunning}
                                    value={activeRawInput.timeStr}
                                    onChange={(e) => handleRawInputChange('timeStr', e.target.value)}
                                    className="w-full min-h-[40px] px-3 rounded border border-[#30474D] bg-[#0E181B] text-[#EDF4F1] text-sm font-mono disabled:opacity-60"
                                  />
                                  <select
                                    aria-label="Đơn vị thời gian"
                                    disabled={isRunning}
                                    value={activeRawInput.timeUnit}
                                    onChange={(e) => handleRawInputChange('timeUnit', e.target.value as TimeUnit)}
                                    className="min-h-[40px] px-2 rounded border border-[#30474D] bg-[#0E181B] text-[#EDF4F1] text-xs disabled:opacity-60"
                                  >
                                    <option value="s">s</option>
                                    <option value="min">phút</option>
                                    <option value="h">giờ</option>
                                  </select>
                                </div>
                                {inputErrors.time && (
                                  <p role="alert" className="mt-1 text-xs text-[#F5A882]">
                                    {inputErrors.time}
                                  </p>
                                )}
                              </div>

                              {activeElectrolysisVariant === 'cuso4-inert' && (
                                <div>
                                  <label htmlFor="sim-input-cu2" className="block text-xs text-[#C8D8D7] mb-1">
                                    <ChemText text="Số mol Cu²⁺ ban đầu (mol)" />
                                  </label>
                                  <input
                                    id="sim-input-cu2"
                                    type="text"
                                    inputMode="decimal"
                                    disabled={isRunning}
                                    value={activeRawInput.initialCu2MolStr}
                                    onChange={(e) => handleRawInputChange('initialCu2MolStr', e.target.value)}
                                    className="w-full min-h-[40px] px-3 rounded border border-[#30474D] bg-[#0E181B] text-[#EDF4F1] text-sm font-mono disabled:opacity-60"
                                  />
                                  {inputErrors.initialCu2Mol && (
                                    <p role="alert" className="mt-1 text-xs text-[#F5A882]">
                                      {inputErrors.initialCu2Mol}
                                    </p>
                                  )}
                                </div>
                              )}

                              <div className="flex items-end gap-2">
                                <button
                                  type="submit"
                                  disabled={isRunning}
                                  className="min-h-[40px] px-3.5 rounded bg-[#78D4C4] text-[#10191C] font-semibold text-xs hover:bg-[#93E3D5] disabled:opacity-50 cursor-pointer"
                                >
                                  Áp dụng
                                </button>
                                <button
                                  type="button"
                                  onClick={handleRestoreDefaultParams}
                                  className="min-h-[40px] px-3 rounded border border-[#30474D] text-xs text-[#C8D8D7] hover:border-[#78D4C4] cursor-pointer"
                                >
                                  Mặc định
                                </button>
                              </div>
                            </div>
                          </form>

                          <div className="rounded border border-[#263B41] bg-[#0E181B] p-3 space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-mono text-xs sm:text-sm tabular-nums text-[#EDF4F1]">
                                Q = {formatViNumber(activeElectrolysisSnapshot.chargeC, { maxDecimals: 1 })} C ·{' '}
                                <ChemText text="nₑ" /> ={' '}
                                <span className="text-[#78D4C4] font-semibold">
                                  {formatViNumber(activeElectrolysisSnapshot.electronMol, {
                                    minDecimals: 4,
                                    maxDecimals: 4,
                                  })}{' '}
                                  mol
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowDerivation((v) => !v)}
                                aria-expanded={showDerivation}
                                className="min-h-[34px] px-2.5 rounded border border-[#78D4C4]/70 text-xs font-medium text-[#78D4C4] hover:bg-[#172D32] cursor-pointer"
                              >
                                {showDerivation ? 'Ẩn lời giải' : 'Xem cách tính Faraday'}
                              </button>
                            </div>

                            {showDerivation && (
                              <ol className="pt-2 border-t border-[#1E3035] space-y-1.5 text-xs">
                                {derivationSteps.map((st, i) => (
                                  <li key={i} className="rounded bg-[#132024] p-2 border border-[#243940]">
                                    <div className="font-semibold text-[#EDF4F1]">
                                      <ChemText text={st.title} />
                                    </div>
                                    <div className="font-mono text-[#C8D8D7] mt-0.5">
                                      <ChemText text={st.formula} /> ⇒ <ChemText text={st.substitution} /> ={' '}
                                      <strong className="text-[#78D4C4]">
                                        <ChemText text={st.result} />
                                      </strong>
                                    </div>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>

                          <ElectrochemChart params={activeParams} snapshot={activeElectrolysisSnapshot} />

                          {milestones.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              <span className="text-[#9AB0B2]">Mốc nhanh:</span>
                              {milestones.map((m) => (
                                <button
                                  key={`${m.label}-${m.timeSeconds}`}
                                  type="button"
                                  onClick={() => {
                                    setIsRunning(false);
                                    setTimeByVariant((prev) => ({
                                      ...prev,
                                      [activeElectrolysisVariant]: m.timeSeconds,
                                    }));
                                  }}
                                  className="min-h-[32px] px-2.5 rounded border border-[#2C4248] bg-[#0F191C] text-[#C8D8D7] hover:border-[#78D4C4] cursor-pointer"
                                >
                                  <ChemText text={m.label} />
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* TAB: BEFORE / AFTER & POLARITY COMPARISON */}
                  {drawerTab === 'compare' && (
                    <div className="space-y-3.5">
                      <div className="overflow-x-auto rounded-lg border border-[#253B41] bg-[#0C1619] p-3">
                        <table className="w-full text-left border-collapse text-xs sm:text-sm">
                          <thead>
                            <tr className="border-b border-[#294047] text-[#9AB0B2]">
                              <th className="py-1.5 pr-3 font-medium">Đại lượng / Hiện tượng</th>
                              <th className="py-1.5 px-3 font-medium">Ban đầu (t = 0 s)</th>
                              <th className="py-1.5 pl-3 font-medium text-[#78D4C4]">Hiện tại</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1E3137]">
                            {beforeAfterRows.map((row) => (
                              <tr key={row.label}>
                                <td className="py-2 pr-3 font-medium text-[#EDF4F1]">
                                  <ChemText text={row.label} />
                                </td>
                                <td className="py-2 px-3 font-mono text-[#B7C7C9]">
                                  <ChemText text={row.beforeText} />
                                </td>
                                <td className="py-2 pl-3 font-mono font-semibold text-[#78D4C4]">
                                  <ChemText text={row.afterText} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="rounded-lg border border-[#78D4C4]/45 bg-[#122429] p-3 text-xs sm:text-sm text-[#D8E7E6]">
                        Quy tắc dấu cực: <strong className="text-[#78D4C4]">Anode luôn xảy ra oxi hóa</strong>,{' '}
                        <strong className="text-[#E3A678]">Cathode luôn xảy ra khử</strong>. Pin Galvani: Anode (−), Cathode (+). Bình điện phân: Anode (+), Cathode (−).
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* === CONTEXTUAL FLOATING BOTTOM DOCK (EXPERIMENT FOCUSED ONLY — ZERO BAR IN OVERVIEW) === */}
            {showFloatingBottomDock && (
              <div
                data-testid="lab-bottom-dock"
                className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 max-w-[calc(100%-16px)]"
              >
                <div
                  role="toolbar"
                  aria-label="Điều khiển thí nghiệm 3D"
                  className="flex items-center gap-1.5 rounded-xl border border-[#2B434A] bg-[#0D1A1E]/95 p-1.5 shadow-2xl overflow-x-auto"
                >
                    {/* 1. Phát / Tạm dừng */}
                    <button
                      type="button"
                      data-testid="play-pause-btn"
                      onClick={handlePrimaryPlayToggle}
                      className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 rounded-lg bg-[#78D4C4] text-[#10191C] font-semibold text-xs sm:text-sm hover:bg-[#93E3D5] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {primaryButtonLabel}
                    </button>

                    {/* 2. Tốc độ (1-tap cycle) */}
                    <button
                      type="button"
                      data-testid="speed-cycle-btn"
                      onClick={handleCycleSpeed}
                      title="Đổi tốc độ mô phỏng"
                      className="min-h-[40px] px-2.5 rounded-lg border border-[#30484F] bg-[#132227] text-xs font-mono font-semibold text-[#EDF4F1] hover:border-[#78D4C4] cursor-pointer whitespace-nowrap tabular-nums"
                    >
                      {formatViNumber(playbackSpeed, { maxDecimals: 2 })}×
                    </button>

                    {/* 3. Vĩ mô / Vi mô */}
                    <div
                      role="group"
                      aria-label="Chuyển đổi Vĩ mô và Vi mô"
                      className="inline-flex items-center gap-0.5 rounded-lg border border-[#2F464C] bg-[#0A1316] p-0.5 shrink-0"
                    >
                      <button
                        type="button"
                        data-testid="mode-macro-btn"
                        aria-pressed={worldZone !== 'MICRO'}
                        onClick={handleEnterMacro}
                        className={`min-h-[34px] px-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          worldZone !== 'MICRO'
                            ? 'bg-[#78D4C4] text-[#10191C]'
                            : 'text-[#C8D8D7] hover:bg-[#19292E]'
                        }`}
                      >
                        Vĩ mô
                      </button>
                      <button
                        type="button"
                        data-testid="mode-micro-btn"
                        aria-pressed={worldZone === 'MICRO'}
                        onClick={() => handleEnterMicro()}
                        className={`min-h-[34px] inline-flex items-center gap-1 px-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          worldZone === 'MICRO'
                            ? 'bg-[#78D4C4] text-[#10191C]'
                            : 'text-[#78D4C4] hover:bg-[#19292E]'
                        }`}
                      >
                        <Microscope className="w-3.5 h-3.5" />
                        Vi mô
                      </button>
                    </div>

                    {/* 4. Contextual view toggle: Góc phản ứng (Macro) OR Cắt lớp (Micro) */}
                    {worldZone === 'MICRO' ? (
                      <button
                        type="button"
                        data-testid="cutaway-toggle-btn"
                        aria-pressed={microOptions.cutaway}
                        onClick={() => toggleMicroOption('cutaway')}
                        className={`min-h-[40px] inline-flex items-center gap-1 px-2.5 rounded-lg border text-xs font-medium cursor-pointer whitespace-nowrap ${
                          microOptions.cutaway
                            ? 'border-[#78D4C4] bg-[#163036] text-[#78D4C4]'
                            : 'border-[#30484F] bg-[#132227] text-[#C8D8D7] hover:border-[#78D4C4]'
                        }`}
                      >
                        <Scissors className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Cắt lớp</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-testid="reaction-focus-btn"
                        aria-pressed={worldZone === 'REACTION'}
                        onClick={() =>
                          worldZone === 'REACTION' ? handleBackToTable() : handleOpenReactionView()
                        }
                        className={`min-h-[40px] inline-flex items-center gap-1 px-2.5 rounded-lg border text-xs font-medium cursor-pointer whitespace-nowrap ${
                          worldZone === 'REACTION'
                            ? 'border-[#E3A678] bg-[#291C15] text-[#FAD8BC]'
                            : 'border-[#30484F] bg-[#132227] text-[#EDF4F1] hover:border-[#E3A678]'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Góc phản ứng</span>
                      </button>
                    )}

                    {/* 5. Đặt lại */}
                    <button
                      type="button"
                      data-testid="reset-sim-btn"
                      onClick={handleReset}
                      aria-label="Đặt lại thí nghiệm"
                      title="Đặt lại thí nghiệm"
                      className="min-h-[40px] inline-flex items-center gap-1 px-2.5 rounded-lg border border-[#30484F] bg-[#132227] text-xs font-medium text-[#EDF4F1] hover:border-[#C77B4C] cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#E3A678]" />
                      <span className="hidden md:inline">Đặt lại</span>
                    </button>

                    {/* 6. Thêm (Contextual Overlay Sheet) */}
                    <button
                      type="button"
                      data-testid="more-options-btn"
                      aria-expanded={drawerOpen}
                      onClick={() => setDrawerOpen((v) => !v)}
                      className={`min-h-[40px] inline-flex items-center gap-1.5 px-3 rounded-lg border text-xs font-semibold cursor-pointer whitespace-nowrap ${
                        drawerOpen
                          ? 'border-[#78D4C4] bg-[#173036] text-[#78D4C4]'
                          : 'border-[#30484F] bg-[#132227] text-[#EDF4F1] hover:border-[#78D4C4]'
                      }`}
                    >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#78D4C4]" />
                    Thêm
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* === COMPLETE 2D / WEBGL FALLBACK MODE (INTERNAL SCROLL INSIDE VIEWPORT) === */
          <div
            data-testid="lab-2d-fallback"
            className="h-full overflow-y-auto bg-[#0C1316] p-3 sm:p-5"
          >
            <div className="max-w-5xl mx-auto space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E2E34] pb-2.5">
                <div role="tablist" aria-label="Chế độ dự phòng 2D" className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'sim', label: 'Mô phỏng 2D' },
                      { id: 'board', label: 'Bài học (10 mô-đun)' },
                      { id: 'practice', label: 'Luyện tập & Đề thi' },
                    ] as { id: Fallback2DTab; label: string }[]
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      data-testid={`fallback-2d-tab-${t.id}`}
                      aria-selected={fallback2DTab === t.id}
                      onClick={() => setFallback2DTab(t.id)}
                      className={`min-h-[38px] px-3 rounded border text-xs sm:text-sm font-medium cursor-pointer ${
                        fallback2DTab === t.id
                          ? 'border-[#78D4C4] bg-[#173036] text-[#78D4C4] font-semibold'
                          : 'border-[#2D4349] bg-[#101B1E] text-[#C8D8D7] hover:border-[#78D4C4]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setViewMode('3d')}
                  className="min-h-[38px] px-3 rounded border border-[#78D4C4]/70 text-xs sm:text-sm font-medium text-[#78D4C4] hover:bg-[#172B30] cursor-pointer"
                >
                  Quay lại phòng lab 3D
                </button>
              </div>

              {fallback2DTab === 'sim' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(['pin-zn-cu', 'dien-phan-cuso4', 'dien-phan-nacl'] as LabExperimentId[]).map((stId) => (
                        <button
                          key={stId}
                          type="button"
                          onClick={() => handleSelectStation(stId)}
                          className={`min-h-[36px] px-3 rounded border text-xs font-medium cursor-pointer ${
                            selectedStation === stId
                              ? 'border-[#78D4C4] bg-[#78D4C4] text-[#10191C] font-semibold'
                              : 'border-[#30474D] bg-[#101B1E] text-[#EDF4F1]'
                          }`}
                        >
                          <ChemText text={LAB_TABLES[stId].title} />
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handlePrimaryPlayToggle}
                        className="min-h-[36px] px-3 rounded bg-[#78D4C4] text-[#10191C] text-xs font-semibold cursor-pointer inline-flex items-center gap-1"
                      >
                        {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {primaryButtonLabel}
                      </button>
                      <button
                        type="button"
                        onClick={handleReset}
                        className="min-h-[36px] px-2.5 rounded border border-[#30474D] text-xs text-[#EDF4F1] cursor-pointer"
                      >
                        Đặt lại
                      </button>
                    </div>
                  </div>

                  {selectedStation === 'pin-zn-cu' && (
                    <LabZnCuSvg
                      circuitClosed={galvanicState.circuitClosed}
                      progress={galvanicSnapshot.progress}
                      isRunning={isRunning}
                      playbackSpeed={playbackSpeed}
                      showConventionalCurrent={galvanicState.showConventionalCurrent}
                      reducedMotion={reducedMotion}
                      activeHotspotId={activeHotspot2D?.id ?? null}
                      onSelectHotspot={setActiveHotspot2D}
                      onToggleCircuit={handleTogglePinSwitch}
                    />
                  )}

                  {selectedStation === 'dien-phan-cuso4' && (
                    <LabCuSO4Svg
                      snapshot={cuso4Snapshot}
                      isRunning={isRunning}
                      currentA={cuso4Params.currentA}
                      playbackSpeed={playbackSpeed}
                      reducedMotion={reducedMotion}
                      activeHotspotId={activeHotspot2D?.id ?? null}
                      onSelectHotspot={setActiveHotspot2D}
                    />
                  )}

                  {selectedStation === 'dien-phan-nacl' && (
                    <LabNaClSvg
                      snapshot={naclSnapshot}
                      isRunning={isRunning}
                      currentA={naclParams.currentA}
                      playbackSpeed={playbackSpeed}
                      reducedMotion={reducedMotion}
                      activeHotspotId={activeHotspot2D?.id ?? null}
                      onSelectHotspot={setActiveHotspot2D}
                    />
                  )}

                  {activeHotspot2D && (
                    <div
                      role="dialog"
                      aria-label={activeHotspot2D.title}
                      className="rounded border border-[#78D4C4] bg-[#13252A] p-3 text-sm flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-[#EDF4F1]">
                          <ChemText text={activeHotspot2D.title} />
                        </div>
                        <div className="text-xs font-mono text-[#78D4C4]">
                          <ChemText text={activeHotspot2D.role} />
                        </div>
                        <p className="text-[#C8D8D7]">
                          <ChemText text={activeHotspot2D.detail} />
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveHotspot2D(null)}
                        className="min-h-[36px] px-3 rounded border border-[#365056] text-[#EDF4F1] cursor-pointer"
                      >
                        Đóng
                      </button>
                    </div>
                  )}
                </div>
              )}

              {fallback2DTab === 'board' && (
                <div className="relative h-[620px] rounded-lg overflow-hidden bg-[#0E181B]">
                  <SmartBoardPanel
                    activeModuleIndex={boardModuleIndex}
                    completedLessonSlugs={progress.completedLessonSlugs}
                    onSelectModule={(idx) => {
                      setBoardModuleIndex(idx);
                      const slug = BOARD_MODULES[idx]?.lessonSlug;
                      if (slug) onMarkCurrentLesson(slug);
                    }}
                    onToggleLessonComplete={onToggleLessonComplete}
                    onObserveModel={(t) => {
                      handleBoardObserveModel(t);
                      setFallback2DTab('sim');
                    }}
                    onObserveMicro={(t) => {
                      handleBoardObserveMicro(t);
                      setFallback2DTab('sim');
                    }}
                    onBackToRoom={() => setFallback2DTab('sim')}
                  />
                </div>
              )}

              {fallback2DTab === 'practice' && (
                <div className="relative h-[640px] rounded-lg overflow-hidden bg-[#0E181B]">
                  <PracticeDeskPanel
                    session={practiceSession}
                    lastQuizResult={progress.lastQuizResult}
                    completedDeckIds={progress.completedDeckIds}
                    reducedMotion={reducedMotion}
                    onUpdateSession={setPracticeSession}
                    onTriggerPageFlip={() => setPracticeFlipNonce((n) => n + 1)}
                    onObservePhenomenon={(t) => {
                      handlePracticeObservePhenomenon(t);
                      setFallback2DTab('sim');
                    }}
                    onStartVisual3DPick={(q) => {
                      setViewMode('3d');
                      handleStartVisual3DPick(q);
                    }}
                    onRecordOutcome={onRecordQuestionOutcome}
                    onSaveQuizResult={onSaveQuizResult}
                    onBackToRoom={() => setFallback2DTab('sim')}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* === HELP & SYLLABUS MODAL === */}
      {showHelpModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Hướng dẫn tương tác phòng thí nghiệm 3D"
          className="fixed inset-0 z-50 bg-[#070E11]/78 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-xl rounded-xl border border-[#78D4C4]/75 bg-[#122024] text-[#EDF4F1] shadow-2xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-[#243B41] flex items-center justify-between gap-2 bg-[#0C1619]">
              <h2 className="font-serif text-base font-semibold" style={{ color: '#78D4C4' }}>
                Hướng dẫn học trong Phòng thí nghiệm 3D
              </h2>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                aria-label="Đóng hướng dẫn"
                className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded border border-[#365056] text-[#C8D8D7] hover:text-[#EDF4F1] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-3 text-xs sm:text-sm text-[#D1E0DF]">
              <ul className="space-y-2 leading-relaxed">
                <li>
                  • <strong>Bảng học 3D (tường trái):</strong> Học trọn bộ 10 bài lý thuyết Chương 5 và nhảy thẳng sang mô hình hoặc chế độ Vi mô.
                </li>
                <li>
                  • <strong>Ba bàn thí nghiệm trung tâm:</strong> Chạy Pin Zn–Cu, Điện phân CuSO₄ và NaCl; dùng <strong>Vĩ mô</strong> để quan sát dòng e⁻, ion, sản phẩm, hoặc bật <strong>Vi mô</strong> để nhìn sâu cấp độ hạt.
                </li>
                <li>
                  • <strong>Bàn luyện tập 3D (góc phải):</strong> Chọn bộ đề trong tập tài liệu trên bàn, làm trắc nghiệm hoặc chọn trực tiếp điện cực ngay trên mô hình 3D.
                </li>
                <li>
                  • <strong>Điều khiển:</strong> Kéo chuột để xoay camera, cuộn để thu phóng, phím <strong>Escape</strong> để đóng bảng nổi hoặc thoát cận cảnh.
                </li>
              </ul>
              <div className="pt-2.5 border-t border-[#22373D] text-[11px] text-[#95ACAE]">
                Pin điện &amp; Điện phân · Hóa học 12 · Chương 5 · Nguồn đề cương đầy đủ: trang 1, 2, 3, 4, 6, 7, 9 (trang 5 và 8 chưa đầy đủ).
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
