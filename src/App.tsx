import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { Viewport } from './components/Viewport';
import { TransportBar } from './components/TransportBar';
import { ColorGradingPanel } from './components/ColorGradingPanel';
import { LutLibraryPanel } from './components/LutLibraryPanel';
import { ScopesPanel } from './components/ScopesPanel';
import { ColorCheckerPanel } from './components/ColorCheckerPanel';
import { PlaylistPanel } from './components/PlaylistPanel';
import { ExportPanel } from './components/ExportPanel';
import { PlaybackDiagnosticsModal } from './components/PlaybackDiagnosticsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { ContactDeveloperModal } from './components/ContactDeveloperModal';
import { ColorParityModal } from './components/ColorParityModal';
import { ActiveTab, PlaylistItem } from './types';
import { useVideoPlayer } from './hooks/useVideoPlayer';
import { usePlaylist } from './hooks/usePlaylist';
import { useLutManager } from './hooks/useLutManager';
import { useColorGrading } from './hooks/useColorGrading';
import { useColorChecker } from './hooks/useColorChecker';
import { usePlaybackDiagnostics } from './hooks/usePlaybackDiagnostics';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Sliders, Layers, BarChart2, Grid, Download } from 'lucide-react';

export default function App() {
  // Navigation & Modals
  const [currentTab, setCurrentTab] = useState<ActiveTab>('grading');
  const [isContactModalOpen, setIsContactModalOpen] = useState<boolean>(false);
  const [isParityModalOpen, setIsParityModalOpen] = useState<boolean>(false);

  // 1. Video Player & WebGL Canvas Engine
  const {
    canvasRef,
    playerRef,
    videoRef,
    videoLoaded,
    videoMeta,
    isPlaying,
    setIsPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    speed,
    isLooping,
    splitMode,
    setSplitMode,
    splitPos,
    setSplitPos,
    playbackRes,
    setPlaybackRes,
    gpuInfo,
    loadVideoFile,
    handlePlayToggle,
    handleStop,
    handleSeek,
    handleStepFrame,
    handleVolumeChange,
    handleToggleMute,
    handleSpeedChange,
    handleToggleLoop,
    handleSnapshot,
    handleToggleFullscreen
  } = useVideoPlayer({
    onEnded: () => {
      const pl = playlistRef.current;
      const idx = currentClipIndexRef.current;
      if (autoPlayNextRef.current && pl.length > 1) {
        if (idx < pl.length - 1) {
          handlePlayClipIndex(idx + 1);
        } else if (isLooping) {
          handlePlayClipIndex(0);
        } else {
          setIsPlaying(false);
        }
      } else if (isLooping) {
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(() => {});
        }
      } else {
        setIsPlaying(false);
      }
    }
  });

  // 2. Playlist & Sequential Folder Queue
  const {
    playlist,
    currentClipIndex,
    autoPlayNext,
    setAutoPlayNext,
    playlistRef,
    currentClipIndexRef,
    autoPlayNextRef,
    handlePlayClipIndex,
    handleNextClip,
    handlePrevClip,
    handleLoadFolder,
    handleAddFilesToPlaylist,
    handleClearPlaylist,
    handleLoadSingleVideo
  } = usePlaylist({
    onSelectClip: (item: PlaylistItem) => {
      loadVideoFile(item.file);
    },
    isLooping
  });

  // 3. LUT Manager (Tetrahedral & Trilinear)
  const {
    activeLut,
    setActiveLut,
    lutEnabled,
    setLutEnabled,
    handleToggleLut,
    customLuts,
    setCustomLuts,
    interpolationMode,
    setInterpolationMode,
    handleLoadCubeText
  } = useLutManager(playerRef);

  // 4. Primary Color Grading Parameters
  const { adjustments, setAdjustments } = useColorGrading(playerRef);

  // 5. ColorChecker & Skin Area Analysis
  const {
    colorCheckerActive,
    setColorCheckerActive,
    chartType,
    setChartType,
    chartCorners,
    setChartCorners,
    colorCheckerAnalysis,
    checkerSampleSource,
    setCheckerSampleSource,
    isSelectingSkinArea,
    skinSelectionRect,
    skinSelectionStats,
    handleToggleColorChecker,
    handleAutoDetectChartCorners,
    handleResetChartCorners,
    handleStartSkinSelection,
    handleCancelSkinSelection,
    handleSkinAreaSelected,
    handleClearSkinSelection
  } = useColorChecker({
    videoLoaded,
    currentTab,
    playerRef,
    videoRef,
    canvasRef
  });

  // 6. Playback Diagnostics Benchmark
  const {
    isDiagnosticsOpen,
    setIsDiagnosticsOpen,
    testResult,
    isRunningTest,
    handleRunPlaybackTest
  } = usePlaybackDiagnostics();

  // 7. Global Keyboard Shortcuts
  const { isShortcutsOpen, setIsShortcutsOpen } = useKeyboardShortcuts({
    onPlayToggle: handlePlayToggle,
    onPrevClip: handlePrevClip,
    onNextClip: handleNextClip,
    onSeekRelative: (sec) => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(
          0,
          Math.min(videoRef.current.duration || Infinity, videoRef.current.currentTime + sec)
        );
      }
    },
    onStepFrame: handleStepFrame,
    onSpeedMultiply: (factor) => {
      if (videoRef.current) {
        const newRate =
          factor < 1
            ? Math.max(0.25, videoRef.current.playbackRate * factor)
            : Math.min(4, videoRef.current.playbackRate * factor);
        handleSpeedChange(newRate);
        if (factor > 1 && videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        }
      }
    },
    onPause: () => {
      if (videoRef.current) videoRef.current.pause();
    },
    onToggleLut: handleToggleLut,
    onCycleSplitMode: () => {
      setSplitMode((prev) =>
        prev === 'off' ? 'vertical' : prev === 'vertical' ? 'side-by-side' : 'off'
      );
    },
    onSnapshot: handleSnapshot,
    onToggleFullscreen: handleToggleFullscreen,
    onSeekToStart: () => {
      if (videoRef.current) videoRef.current.currentTime = 0;
    }
  });

  // Unified File Drag & Drop Handling
  const handleDropFile = useCallback(
    (file: File, allFiles?: File[]) => {
      if (allFiles && allFiles.length > 1) {
        handleLoadFolder(allFiles);
        return;
      }

      const name = file.name.toLowerCase();
      if (name.endsWith('.cube')) {
        file.text().then((text) => {
          try {
            handleLoadCubeText(text, file.name);
          } catch (err: any) {
            alert(`Error reading .cube: ${err.message}`);
          }
        });
      } else {
        handleLoadSingleVideo(file);
      }
    },
    [handleLoadFolder, handleLoadCubeText, handleLoadSingleVideo]
  );

  // Global window drag & drop
  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => e.preventDefault();
    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (files && files.length > 1) {
        handleLoadFolder(files);
      } else if (files && files.length === 1) {
        handleDropFile(files[0]);
      }
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [handleDropFile, handleLoadFolder]);

  return (
    <div className="min-h-screen bg-[#0e1014] text-[#eceef2] flex flex-col justify-between">
      {/* Clean Top Bar with Display Resolution Toggle & Utilities */}
      <Header
        onOpenVideoFile={handleLoadSingleVideo}
        onOpenFolder={handleLoadFolder}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onOpenContact={() => setIsContactModalOpen(true)}
        fileName={videoMeta?.name}
        playbackResolution={playbackRes}
        onResolutionChange={setPlaybackRes}
        onOpenExport={() => setCurrentTab('export')}
      />

      {/* Main Workspace: 2-Column Side-by-Side Studio Layout */}
      <main className="max-w-[1920px] w-full mx-auto px-2 sm:px-3 py-2 flex flex-row gap-3 sm:gap-4 flex-1 min-h-0 overflow-x-auto">
        {/* Left Stage: Video Viewport & Transport Timeline */}
        <div className="flex-1 min-w-[340px] flex flex-col gap-2.5 sm:gap-3">
          <Viewport
            canvasRef={canvasRef}
            videoLoaded={videoLoaded}
            onOpenVideoClick={() => {
              const el = document.querySelector('input[type="file"][accept*="video"]') as HTMLInputElement;
              el?.click();
            }}
            onOpenFolderClick={() => {
              const el = document.querySelector('input[type="file"][webkitdirectory]') as HTMLInputElement;
              el?.click();
            }}
            onOpenLutLibrary={() => setCurrentTab('lut')}
            onOpenScopes={() => setCurrentTab('scopes')}
            onDropFile={handleDropFile}
            onSnapshot={handleSnapshot}
            splitMode={splitMode}
            splitPos={splitPos}
            onSplitPosChange={setSplitPos}
            playbackResolution={playbackRes}
            lutName={activeLut?.name}
            lutEnabled={lutEnabled}
            onToggleFullscreen={handleToggleFullscreen}
            isSelectingSkinArea={isSelectingSkinArea}
            onStartSkinSelection={() => {
              if (videoRef.current) videoRef.current.pause();
              setIsPlaying(false);
              setCurrentTab('scopes');
              handleStartSkinSelection();
            }}
            onCancelSkinSelection={handleCancelSkinSelection}
            skinSelectionRect={skinSelectionRect}
            skinSelectionStats={skinSelectionStats}
            onSkinAreaSelected={(rect, stats) => {
              handleSkinAreaSelected(rect, stats, () => setCurrentTab('scopes'));
            }}
            onClearSkinSelection={handleClearSkinSelection}
            colorCheckerActive={colorCheckerActive}
            onToggleColorChecker={() => handleToggleColorChecker(() => setCurrentTab('checker'))}
            chartType={chartType}
            chartCorners={chartCorners}
            onChangeChartCorners={setChartCorners}
            colorCheckerAnalysis={colorCheckerAnalysis}
            onAutoDetectChartCorners={handleAutoDetectChartCorners}
            onResetChartCorners={handleResetChartCorners}
            videoWidth={videoMeta?.width || 1920}
            videoHeight={videoMeta?.height || 1080}
          />

          <TransportBar
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            onPlayToggle={handlePlayToggle}
            onStop={handleStop}
            onSeek={handleSeek}
            onStepFrame={handleStepFrame}
            isLooping={isLooping}
            onToggleLoop={handleToggleLoop}
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={handleVolumeChange}
            onToggleMute={handleToggleMute}
            speed={speed}
            onSpeedChange={handleSpeedChange}
            splitMode={splitMode}
            onSplitModeChange={setSplitMode}
            splitPos={splitPos}
            onSplitPosChange={setSplitPos}
            onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
            playbackResolution={playbackRes}
            onResolutionChange={setPlaybackRes}
            onNextClip={handleNextClip}
            onPrevClip={handlePrevClip}
            playlistCount={playlist.length}
            currentClipIndex={currentClipIndex}
            disabled={!videoLoaded}
          />

          <PlaylistPanel
            playlist={playlist}
            currentIndex={currentClipIndex}
            onSelectClip={handlePlayClipIndex}
            onNextClip={handleNextClip}
            onPrevClip={handlePrevClip}
            onOpenFolder={handleLoadFolder}
            onAddFiles={handleAddFilesToPlaylist}
            onClearPlaylist={handleClearPlaylist}
            autoPlayNext={autoPlayNext}
            onToggleAutoPlayNext={() => setAutoPlayNext((prev) => !prev)}
          />
        </div>

        {/* Right Stage: Studio Control Sidebar */}
        <div className="w-[360px] sm:w-[420px] lg:w-[480px] xl:w-[520px] shrink-0 flex flex-col gap-2.5">
          <div className="flex items-center justify-between bg-[#14161d] p-1.5 rounded-xl border border-[#262934] shadow-sm shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto w-full no-scrollbar">
              <button
                onClick={() => setCurrentTab('grading')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                  currentTab === 'grading'
                    ? 'bg-[#292218] text-[#e5b96f] border border-[#7d5d2e] ring-1 ring-[#e5b96f]/40 shadow-sm'
                    : 'text-[#9ba1ad] hover:text-[#eceef2] hover:bg-[#1f222b]'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-[#e5b96f]" />
                <span>Color Grading</span>
              </button>

              <button
                onClick={() => setCurrentTab('lut')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                  currentTab === 'lut'
                    ? 'bg-[#292218] text-[#e5b96f] border border-[#7d5d2e] ring-1 ring-[#e5b96f]/40 shadow-sm'
                    : 'text-[#9ba1ad] hover:text-[#eceef2] hover:bg-[#1f222b]'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-[#e5b96f]" />
                <span>LUT Library</span>
              </button>

              <button
                onClick={() => setCurrentTab('scopes')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                  currentTab === 'scopes'
                    ? 'bg-[#292218] text-[#e5b96f] border border-[#7d5d2e] ring-1 ring-[#e5b96f]/40 shadow-sm'
                    : 'text-[#9ba1ad] hover:text-[#eceef2] hover:bg-[#1f222b]'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5 text-[#e5b96f]" />
                <span>Scopes & Skin Tone</span>
              </button>

              <button
                onClick={() => {
                  setCurrentTab('checker');
                  setColorCheckerActive(true);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                  currentTab === 'checker'
                    ? 'bg-[#14232c] text-cyan-300 border border-cyan-700/80 ring-1 ring-cyan-400/40 shadow-sm'
                    : 'text-[#9ba1ad] hover:text-[#eceef2] hover:bg-[#1f222b]'
                }`}
              >
                <Grid className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  {chartType === 'video'
                    ? 'Calibrate Video Target'
                    : chartType === 'spyder24'
                    ? 'Calibrate SpyderCheckr 24'
                    : 'Calibrate ColorChecker Classic'}
                </span>
              </button>

              <button
                onClick={() => setCurrentTab('export')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                  currentTab === 'export'
                    ? 'bg-[#292218] text-[#e5b96f] border border-[#7d5d2e] ring-1 ring-[#e5b96f]/40 shadow-sm'
                    : 'text-[#9ba1ad] hover:text-[#eceef2] hover:bg-[#1f222b]'
                }`}
              >
                <Download className="w-3.5 h-3.5 text-[#e5b96f]" />
                <span>Export video</span>
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 lg:max-h-[calc(100vh-140px)] overflow-y-auto pr-0.5">
            {currentTab === 'grading' && (
              <ColorGradingPanel
                adjustments={adjustments}
                onChange={setAdjustments}
                lutEnabled={lutEnabled}
                onLutEnabledChange={setLutEnabled}
                activeLutName={activeLut?.name}
                activeLut={activeLut}
                interpolationMode={interpolationMode}
                onInterpolationModeChange={setInterpolationMode}
                onOpenParityModal={() => setIsParityModalOpen(true)}
              />
            )}

            {currentTab === 'lut' && (
              <LutLibraryPanel
                currentLut={activeLut}
                onSelectLut={setActiveLut}
                onCustomLutLoaded={(newLut) => {
                  setCustomLuts((prev) => [newLut, ...prev.filter((l) => l.name !== newLut.name)]);
                  setActiveLut(newLut);
                }}
                customLuts={customLuts}
              />
            )}

            {currentTab === 'scopes' && (
              <ScopesPanel
                canvasRef={canvasRef}
                videoRef={videoRef}
                playerRef={playerRef}
                videoLoaded={videoLoaded}
                lutName={activeLut?.name}
                lutEnabled={lutEnabled}
                adjustments={adjustments}
                onAdjustmentsChange={setAdjustments}
                isSelectingSkinArea={isSelectingSkinArea}
                onStartSkinSelection={() => {
                  if (videoRef.current) videoRef.current.pause();
                  setIsPlaying(false);
                  handleStartSkinSelection();
                }}
                onClearSkinSelection={handleClearSkinSelection}
                skinSelectionRect={skinSelectionRect}
                skinSelectionStats={skinSelectionStats}
                sampleSource={checkerSampleSource}
                onToggleSampleSource={() =>
                  setCheckerSampleSource((prev) => (prev === 'graded' ? 'raw' : 'graded'))
                }
              />
            )}

            {currentTab === 'checker' && (
              <ColorCheckerPanel
                analysis={colorCheckerAnalysis}
                corners={chartCorners}
                onChangeCorners={setChartCorners}
                overlayActive={colorCheckerActive}
                onToggleOverlay={() => setColorCheckerActive((prev) => !prev)}
                onAutoDetect={handleAutoDetectChartCorners}
                onResetCorners={handleResetChartCorners}
                adjustments={adjustments}
                onAdjustmentsChange={setAdjustments}
                videoLoaded={videoLoaded}
                sampleSource={checkerSampleSource}
                onToggleSampleSource={() =>
                  setCheckerSampleSource((prev) => (prev === 'graded' ? 'raw' : 'graded'))
                }
                chartType={chartType}
                onChartTypeChange={setChartType}
              />
            )}

            {currentTab === 'export' && (
              <ExportPanel
                videoElement={videoRef.current}
                sourceFile={playlist[currentClipIndex]?.file || null}
                videoMetadata={videoMeta}
                adjustments={adjustments}
                activeLut={activeLut}
                lutEnabled={lutEnabled}
                onNavigateToGrading={() => setCurrentTab('grading')}
                onNavigateToLut={() => setCurrentTab('lut')}
              />
            )}
          </div>
        </div>
      </main>

      {/* Clean Unboxed Footer */}
      <footer className="max-w-[1880px] w-full mx-auto px-5 py-2.5 border-t border-[#1f222b] text-xs text-[#757b8b] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span>Nikon ZR Colorist Suite</span>
          <span aria-hidden="true">·</span>
          <span>WebGL 3D LUT Engine</span>
          <span aria-hidden="true">·</span>
          <span>Folder Queue Playback</span>
          <span aria-hidden="true">·</span>
          <span>100% Client-Side Local Processing</span>
        </div>

        <div className="flex items-center gap-3">
          <span>GPU: {gpuInfo.renderer.split('(')[0].trim()}</span>
          <span aria-hidden="true">·</span>
          <button
            onClick={() => setIsShortcutsOpen(true)}
            className="hover:text-[#eceef2] transition-colors"
          >
            Hotkeys Guide
          </button>
        </div>
      </footer>

      {/* Modals */}
      <PlaybackDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        videoElement={videoRef.current}
        currentMode={playbackRes}
        onSelectMode={setPlaybackRes}
        gpuInfo={gpuInfo}
        testResult={testResult}
        onRunTest={() => handleRunPlaybackTest(videoRef.current, gpuInfo, setPlaybackRes)}
        isRunningTest={isRunningTest}
        onOpenParityAudit={() => setIsParityModalOpen(true)}
      />

      <ColorParityModal
        isOpen={isParityModalOpen}
        onClose={() => setIsParityModalOpen(false)}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <ContactDeveloperModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />
    </div>
  );
}
