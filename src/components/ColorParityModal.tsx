import React, { useState } from 'react';
import {
  X,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Sparkles,
  Info,
  Check,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import {
  ParityAuditReport,
  runFullColorParitySuite
} from '../color/tests/colorParityTest';

interface ColorParityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ColorParityModal: React.FC<ColorParityModalProps> = ({ isOpen, onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<ParityAuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedOperation, setSelectedOperation] = useState<string>('all');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleRunAudit = async () => {
    setIsRunning(true);
    setError(null);
    try {
      // Yield to allow UI repaint
      await new Promise((r) => setTimeout(r, 50));
      const result = await runFullColorParitySuite();
      setReport(result);
    } catch (err: any) {
      console.error('Parity Audit execution error:', err);
      setError(err?.message || 'Failed to complete parity audit');
    } finally {
      setIsRunning(false);
    }
  };

  const filteredCases = report
    ? selectedOperation === 'all'
      ? report.testCases
      : report.testCases.filter((tc) => tc.operation === selectedOperation)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-150">
      <div className="bg-[#12141a] border border-[#2b2f3d] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222530] bg-[#161822]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Color Pipeline Parity Audit
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-md">
                  CPU ↔ GPU Strict Parity
                </span>
              </div>
              <p className="text-[11px] text-[#8e94a4]">
                Automated numerical verification between JavaScript CPU and GLSL GPU shader pipelines
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8e94a4] hover:text-white hover:bg-[#222532] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Audit Controls & Status Banner */}
          <div className="bg-[#181a24] border border-[#262a38] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-[#f0f2f8] flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Function-by-Function Color Mathematics Verification
              </h4>
              <p className="text-[11px] text-[#858c9f] max-w-xl leading-relaxed">
                Executes identical calibrated RGB test vectors through both the CPU mathematical pipeline
                and the GPU WebGL shader pipeline. Compares exposure, linear chromatic white balance, highlights/shadows,
                contrast, saturation, LUT strength, domain mapping, and trilinear vs tetrahedral interpolation.
              </p>
            </div>
            <button
              onClick={handleRunAudit}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-xl shadow-lg shadow-amber-500/15 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Running Audit...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-black" />
                  Run Full Parity Audit
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-xl text-xs text-red-400 flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Test Report Display */}
          {report ? (
            <div className="space-y-6">
              {/* Summary Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#161822] border border-[#242836] p-3.5 rounded-xl">
                  <div className="text-[10px] uppercase font-mono text-[#787f92]">Audit Status</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {report.passed ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-sm font-bold text-emerald-400">100% PARITY</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        <span className="text-sm font-bold text-red-400">FAILED</span>
                      </>
                    )}
                  </div>
                  <div className="text-[10px] text-[#6d7486] mt-0.5 font-mono">
                    {report.passedTests} of {report.totalTests} tests passed
                  </div>
                </div>

                <div className="bg-[#161822] border border-[#242836] p-3.5 rounded-xl">
                  <div className="text-[10px] uppercase font-mono text-[#787f92]">Max Delta (Peak)</div>
                  <div className="text-sm font-bold font-mono text-[#e6e9f2] mt-1">
                    {(report.overallMaxDelta * 255).toFixed(2)}
                    <span className="text-xs text-[#787f92] font-normal"> / 255</span>
                  </div>
                  <div className="text-[10px] text-[#6d7486] mt-0.5 font-mono">
                    {(report.overallMaxDelta * 100).toFixed(3)}% max discrepancy
                  </div>
                </div>

                <div className="bg-[#161822] border border-[#242836] p-3.5 rounded-xl">
                  <div className="text-[10px] uppercase font-mono text-[#787f92]">Avg Delta (Mean)</div>
                  <div className="text-sm font-bold font-mono text-[#e6e9f2] mt-1">
                    {(report.overallAvgDelta * 255).toFixed(2)}
                    <span className="text-xs text-[#787f92] font-normal"> / 255</span>
                  </div>
                  <div className="text-[10px] text-[#6d7486] mt-0.5 font-mono">
                    Sub-pixel floating point precision
                  </div>
                </div>

                <div className="bg-[#161822] border border-[#242836] p-3.5 rounded-xl">
                  <div className="text-[10px] uppercase font-mono text-[#787f92]">Tolerance Limit</div>
                  <div className="text-sm font-bold font-mono text-amber-400 mt-1">
                    {(report.tolerance * 255).toFixed(1)}
                    <span className="text-xs text-[#787f92] font-normal"> / 255</span>
                  </div>
                  <div className="text-[10px] text-[#6d7486] mt-0.5 font-mono">
                    Strict 8-bit readback threshold
                  </div>
                </div>
              </div>

              {/* Function-by-Function Operations Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-[#f0f2f8] flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Audited Color Operations
                  </h4>
                  <span className="text-[11px] text-[#787f92] font-mono">
                    GPU: {report.gpuRenderer}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {report.operations.map((op) => (
                    <button
                      key={op.operation}
                      onClick={() =>
                        setSelectedOperation(
                          selectedOperation === op.operation ? 'all' : op.operation
                        )
                      }
                      className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        selectedOperation === op.operation
                          ? 'bg-[#202432] border-amber-500/50 shadow-md'
                          : 'bg-[#151720] border-[#242836] hover:bg-[#1a1d28]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#dce0ec] capitalize">
                          {op.operation}
                        </span>
                        {op.passed ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" /> PASS
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
                            <AlertTriangle className="w-3 h-3" /> FAIL
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2 text-[10px] text-[#80889c] font-mono">
                        <span>{op.testCount} vectors</span>
                        <span>
                          Max Δ: {(op.maxDelta * 255).toFixed(2)}/255
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Detailed Test Vectors Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-[#f0f2f8]">
                    Test Vectors & Numerical Comparison
                    {selectedOperation !== 'all' && (
                      <span className="ml-2 text-[11px] text-amber-400 font-normal">
                        (Filtered: {selectedOperation})
                      </span>
                    )}
                  </h4>
                  {selectedOperation !== 'all' && (
                    <button
                      onClick={() => setSelectedOperation('all')}
                      className="text-[11px] text-amber-400 hover:underline cursor-pointer"
                    >
                      Show All Vectors
                    </button>
                  )}
                </div>

                <div className="bg-[#14161f] border border-[#242836] rounded-xl overflow-hidden text-xs">
                  <div className="max-h-64 overflow-y-auto divide-y divide-[#1f2230]">
                    {filteredCases.slice(0, 100).map((tc, idx) => {
                      const isExpanded = expandedRow === idx;
                      return (
                        <div key={idx} className="p-2.5 hover:bg-[#191c28] transition-colors">
                          <div
                            onClick={() => setExpandedRow(isExpanded ? null : idx)}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-[#72798e]" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-[#72798e]" />
                              )}
                              <span className="font-medium text-[#d8dce8]">
                                {tc.vectorName}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 font-mono text-[11px]">
                              <span className="text-[#8890a4]">
                                Max Δ: {(tc.maxDelta * 255).toFixed(2)}/255
                              </span>
                              {tc.passed ? (
                                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                  <Check className="w-3 h-3" /> PASS
                                </span>
                              ) : (
                                <span className="text-red-400 font-semibold flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> FAIL
                                </span>
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-2.5 pt-2.5 border-t border-[#222534] grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] font-mono">
                              <div className="bg-[#101218] p-2 rounded-lg border border-[#1e212c]">
                                <span className="text-[#6c7386] block text-[10px] uppercase">
                                  Input RGB
                                </span>
                                <span className="text-blue-300">
                                  [
                                  {tc.inputRgb.map((v) => (v * 255).toFixed(0)).join(', ')}
                                  ]
                                </span>
                              </div>
                              <div className="bg-[#101218] p-2 rounded-lg border border-[#1e212c]">
                                <span className="text-[#6c7386] block text-[10px] uppercase">
                                  CPU Output
                                </span>
                                <span className="text-amber-300">
                                  [
                                  {tc.cpuRgb.map((v) => (v * 255).toFixed(1)).join(', ')}
                                  ]
                                </span>
                              </div>
                              <div className="bg-[#101218] p-2 rounded-lg border border-[#1e212c]">
                                <span className="text-[#6c7386] block text-[10px] uppercase">
                                  GPU Output
                                </span>
                                <span className="text-emerald-300">
                                  [
                                  {tc.gpuRgb.map((v) => (v * 255).toFixed(1)).join(', ')}
                                  ]
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#1a1d28] border border-[#282d3e] flex items-center justify-center text-amber-400">
                <Sliders className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#f0f2f8]">
                  Automated Parity Audit Ready
                </h4>
                <p className="text-xs text-[#7e8598] max-w-sm mt-1">
                  Click the button above to run mathematical verification across all 12 color operations
                  and 18 calibrated gamut test vectors.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#222530] bg-[#161822] text-xs">
          <div className="flex items-center gap-1.5 text-[11px] text-[#7e8598]">
            <Info className="w-3.5 h-3.5" />
            <span>
              Preview Player, CPU Exporter, and Hardware Exporter share identical GLSL shader code
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#252936] hover:bg-[#303546] text-[#e8ebf4] font-medium rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
