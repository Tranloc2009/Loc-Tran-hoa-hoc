import React, { useCallback, useEffect, useState } from 'react';
import { SimulationLab, WorldLaunchRoute } from './components/SimulationLab';
import { getBoardModuleIndexForSlug } from './utils/labWorldState';
import {
  LearningProgress,
  QuizResultSummary,
  loadProgress,
  markDeckCompleted,
  recordWrongQuestion,
  saveProgress,
  toggleLessonCompletion,
} from './utils/storage';

let routeNonceCounter = 1;

function parseWorldRouteFromLocation(): WorldLaunchRoute {
  const rawHash = window.location.hash.replace(/^#/, '');
  const isFileProtocol = window.location.protocol === 'file:';
  const candidate = rawHash || (isFileProtocol ? '/' : window.location.pathname);
  const [pathPart, queryPart = ''] = candidate.split('?');
  const normalizedPath = pathPart.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(queryPart);

  const base: WorldLaunchRoute = {
    nonce: ++routeNonceCounter,
    worldZone: 'OVERVIEW',
    station: 'pin-zn-cu',
    cuso4Variant: 'cuso4-inert',
    naclVariant: 'nacl-brine',
    boardModuleIndex: 0,
    practiceDeckId: null,
    openDrawerParams: false,
  };

  // Legacy Lesson deep-link -> 3D Smart Teaching Board
  if (normalizedPath.startsWith('/bai/')) {
    const slug = normalizedPath.slice('/bai/'.length);
    return {
      ...base,
      worldZone: 'BOARD',
      boardModuleIndex: getBoardModuleIndexForSlug(slug),
    };
  }

  // Legacy Practice deep-link -> 3D Practice Desk
  if (normalizedPath === '/luyen-tap') {
    const baiParam = Number(params.get('bai') || '0');
    const modeParam = params.get('mode');
    let deckId: string | null = null;
    if (modeParam === 'de-nhanh') {
      deckId = 'deck-balanced-12';
    } else if (baiParam === 1 || baiParam === 3) {
      deckId = 'deck-theory-redox';
    } else if (baiParam === 2 || baiParam === 4) {
      deckId = 'deck-emf-pin';
    } else if (baiParam === 5) {
      deckId = 'deck-electrolysis';
    } else if (baiParam === 6) {
      deckId = 'deck-faraday';
    }
    return {
      ...base,
      worldZone: 'PRACTICE',
      practiceDeckId: deckId,
    };
  }

  // Legacy Simulation deep-links -> Specific 3D Table & Variant
  if (normalizedPath === '/mo-phong') {
    const tabParam = params.get('tab');
    if (tabParam === 'faraday') {
      return {
        ...base,
        worldZone: 'TABLE',
        station: 'dien-phan-cuso4',
        cuso4Variant: 'cuso4-inert',
        openDrawerParams: true,
      };
    }
    if (tabParam === 'dien-phan-cuso4') {
      return {
        ...base,
        worldZone: 'TABLE',
        station: 'dien-phan-cuso4',
        cuso4Variant: 'cuso4-inert',
      };
    }
    if (tabParam === 'nacl-nong-chay') {
      return {
        ...base,
        worldZone: 'TABLE',
        station: 'dien-phan-nacl',
        naclVariant: 'nacl-molten',
      };
    }
    if (tabParam === 'dien-phan-nacl') {
      return {
        ...base,
        worldZone: 'TABLE',
        station: 'dien-phan-nacl',
        naclVariant: 'nacl-brine',
      };
    }
    if (tabParam === 'pin-zn-cu') {
      return {
        ...base,
        worldZone: 'TABLE',
        station: 'pin-zn-cu',
      };
    }
    return base;
  }

  // Default entry: Unified 3D Lab Overview
  return base;
}

export default function App() {
  const [launchRoute, setLaunchRoute] = useState<WorldLaunchRoute>(() =>
    parseWorldRouteFromLocation()
  );
  const [progress, setProgress] = useState<LearningProgress>(() => loadProgress());

  useEffect(() => {
    const onHashChange = () => {
      setLaunchRoute(parseWorldRouteFromLocation());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleSyncHash = useCallback((nextHash: string) => {
    if (window.location.hash !== nextHash) {
      try {
        window.history.replaceState(null, '', nextHash);
      } catch {
        // Fallback for strict file:// origins where history.replaceState may be restricted
        window.location.hash = nextHash;
      }
    }
  }, []);

  const handleMarkCurrentLesson = useCallback((slug: string) => {
    setProgress((prev) => {
      if (prev.currentLessonSlug === slug) return prev;
      const next = { ...prev, currentLessonSlug: slug };
      saveProgress(next);
      return next;
    });
  }, []);

  const handleToggleLessonComplete = useCallback((slug: string) => {
    setProgress((prev) => {
      const next = toggleLessonCompletion(prev, slug);
      saveProgress(next);
      return next;
    });
  }, []);

  const handleRecordQuestionOutcome = useCallback((questionId: string, isCorrect: boolean) => {
    setProgress((prev) => {
      const next = recordWrongQuestion(prev, questionId, isCorrect);
      saveProgress(next);
      return next;
    });
  }, []);

  const handleSaveQuizResult = useCallback((result: QuizResultSummary, deckId?: string) => {
    setProgress((prev) => {
      const mergedWrong = Array.from(
        new Set([...prev.wrongQuestionIds, ...result.wrongQuestionIds])
      );
      const withResult: LearningProgress = {
        ...prev,
        lastQuizResult: result,
        wrongQuestionIds: mergedWrong,
      };
      const next = deckId ? markDeckCompleted(withResult, deckId) : withResult;
      saveProgress(next);
      return next;
    });
  }, []);

  return (
    <div className="h-[100dvh] w-screen overflow-hidden flex flex-col bg-[#0D1619] text-[#EDF4F1]">
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <SimulationLab
          launchRoute={launchRoute}
          progress={progress}
          onToggleLessonComplete={handleToggleLessonComplete}
          onMarkCurrentLesson={handleMarkCurrentLesson}
          onRecordQuestionOutcome={handleRecordQuestionOutcome}
          onSaveQuizResult={handleSaveQuizResult}
          onSyncHash={handleSyncHash}
        />
      </main>
    </div>
  );
}
