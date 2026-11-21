import React, { useState } from 'react';
import { X, Lock, Unlock, Download, CheckCircle2, AlertCircle, FileText, Settings, ShieldCheck, Mail } from 'lucide-react';
import { ColorAdjustments, LutData } from '../types';
import { generateGradedCubeText, downloadCubeFile, EXPORT_LUT_PASSWORD } from '../utils/lutExporter';
import { stepToKelvin, stepToTint, tintToStep } from './ColorGradingPanel';

interface ExportLutModalProps {
  isOpen: boolean;
  onClose: () => void;
  adjustments: ColorAdjustments;
  activeLut: LutData | null;
  lutEnabled: boolean;
}

export const ExportLutModal: React.FC<ExportLutModalProps> = ({
  isOpen,
  onClose,
  adjustments,
  activeLut,
  lutEnabled
}) => {
  const [passcode, setPasscode] = useState<string>('');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>(() => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `Nikon_ZR_Grade_${dateStr}`;
  });
  const [lutSize, setLutSize] = useState<number>(33); // 17, 33, or 65
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleVerifyPasscode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passcode.trim() === EXPORT_LUT_PASSWORD) {
      setIsUnlocked(true);
      setPasscodeError(null);
    } else {
      setPasscodeError('Incorrect passcode. Please enter the 10-digit passcode.');
    }
  };

  const handleExport = () => {
    if (!isUnlocked) return;
    setIsExporting(true);

    setTimeout(() => {
      try {
        const cleanTitle = filename.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'Nikon_ZR_Grade';
        const cubeText = generateGradedCubeText({
          baseLut: activeLut,
          lutEnabled,
          adjustments,
          lutSize,
          title: cleanTitle
        });

        downloadCubeFile(cubeText, `${cleanTitle}.cube`);
        setExportSuccess(true);
        setTimeout(() => setExportSuccess(false), 5000);
      } catch (err: any) {
        alert(`Export error: ${err.message}`);
      } finally {
        setIsExporting(false);
      }
    }, 60);
  };

  const currentKelvin = stepToKelvin(Math.round(adjustments.temperature));
  const currentTint = stepToTint(tintToStep(adjustments.tint));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#12141c] border border-[#2e3448] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222736] bg-[#161a24]">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              isUnlocked
                ? 'bg-emerald-950/80 border-emerald-700/80 text-emerald-400'
                : 'bg-[#292015] border-[#6b4e23] text-[#e5b96f]'
            }`}>
              {isUnlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#f1f5f9] flex items-center gap-2">
                <span>Export Baked .CUBE 3D LUT</span>
                {isUnlocked ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Unlocked
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#312516] text-[#e5b96f] border border-[#6b4e23] font-semibold">
                    UI Lock
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-[#8e95a5]">
                Generate an industry-standard 3D LUT for DaVinci Resolve, Premiere Pro & in-camera
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#8e95a5] hover:text-[#f1f5f9] p-1.5 rounded-lg hover:bg-[#202534] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* STEP 1: Passcode Verification (If Locked) */}
          {!isUnlocked ? (
            <div className="flex flex-col gap-3">
              <div className="p-3.5 bg-[#171a25] rounded-xl border border-[#2b3245] flex items-start gap-3">
                <Lock className="w-4 h-4 text-[#e5b96f] shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1 text-xs">
                  <span className="font-semibold text-[#f1f5f9]">Passcode Required</span>
                  <span className="text-[11px] text-[#9ba1b2] leading-relaxed">
                    This feature generates and exports calibrated production .CUBE LUT files. Enter the passcode to unlock it. This is a UI lock only and does not protect the app or its files.
                  </span>
                </div>
              </div>

              <form onSubmit={handleVerifyPasscode} className="flex flex-col gap-2.5">
                <label className="text-xs font-semibold text-[#c5cbd6] flex items-center justify-between">
                  <span>Enter Passcode:</span>
                  <span className="text-[10px] font-mono text-[#788194]">10-digit PIN</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    autoFocus
                    placeholder="Enter passcode..."
                    value={passcode}
                    onChange={(e) => {
                      setPasscode(e.target.value);
                      setPasscodeError(null);
                      // Instant auto-unlock when matching
                      if (e.target.value.trim() === EXPORT_LUT_PASSWORD) {
                        setIsUnlocked(true);
                      }
                    }}
                    className="flex-1 bg-[#0b0d13] border border-[#2e3549] focus:border-[#e5b96f] rounded-lg px-3.5 py-2 text-sm font-mono tracking-widest text-[#f1f5f9] focus:outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#e5b96f] hover:bg-[#f0c883] text-[#14120c] font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <span>Unlock</span>
                  </button>
                </div>

                {passcodeError && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-400 font-mono mt-1 animate-fade-in">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{passcodeError}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-[#222736] flex items-center justify-between text-xs">
                  <a
                    href="mailto:shyju7896@gmail.com?subject=Passcode%20Request%20for%20Nikon%20ZR%20LUT%20Export&body=Hi%20developer%2C%0A%0APlease%20provide%20the%20passcode%20to%20unlock%20the%20.CUBE%20LUT%20export%20feature.%0A%0AThank%20you!"
                    className="text-[#e5b96f] hover:text-[#f2cd8c] hover:underline flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Request for passcode via email to developer</span>
                  </a>
                </div>
              </form>
            </div>
          ) : (
            /* STEP 2: LUT Configuration & Export Controls (When Unlocked) */
            <div className="flex flex-col gap-4">
              {/* Filename Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#c5cbd6] flex items-center justify-between">
                  <span>LUT File Name:</span>
                  <span className="text-[10px] font-mono text-[#788194]">.cube format</span>
                </label>
                <div className="flex items-center bg-[#0b0d13] border border-[#2e3549] rounded-lg px-3 py-2 text-sm">
                  <input
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    className="flex-1 bg-transparent text-[#f1f5f9] font-mono text-xs focus:outline-none"
                    placeholder="LUT name..."
                  />
                  <span className="text-xs font-mono text-[#677083]">.cube</span>
                </div>
              </div>

              {/* Grid Resolution / Lattice Size */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#c5cbd6]">
                  3D Lattice Grid Resolution:
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setLutSize(17)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      lutSize === 17
                        ? 'bg-[#292218] border-[#e5b96f] text-[#e5b96f] ring-1 ring-[#e5b96f]/40 font-bold'
                        : 'bg-[#161a25] border-[#293043] text-[#9ba1b2] hover:bg-[#1e2333]'
                    }`}
                  >
                    <div className="font-bold">17 × 17 × 17</div>
                    <div className="text-[10px] text-[#717a8e] mt-0.5">Camera / Monitor</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLutSize(33)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      lutSize === 33
                        ? 'bg-[#292218] border-[#e5b96f] text-[#e5b96f] ring-1 ring-[#e5b96f]/40 font-bold'
                        : 'bg-[#161a25] border-[#293043] text-[#9ba1b2] hover:bg-[#1e2333]'
                    }`}
                  >
                    <div className="font-bold">33 × 33 × 33</div>
                    <div className="text-[10px] text-[#717a8e] mt-0.5">DaVinci / Premiere</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLutSize(65)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      lutSize === 65
                        ? 'bg-[#292218] border-[#e5b96f] text-[#e5b96f] ring-1 ring-[#e5b96f]/40 font-bold'
                        : 'bg-[#161a25] border-[#293043] text-[#9ba1b2] hover:bg-[#1e2333]'
                    }`}
                  >
                    <div className="font-bold">65 × 65 × 65</div>
                    <div className="text-[10px] text-[#717a8e] mt-0.5">High Precision</div>
                  </button>
                </div>
              </div>

              {/* Baked Parameters Summary */}
              <div className="p-3 bg-[#161924] rounded-xl border border-[#272e40] flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9ba1b2] flex items-center justify-between">
                  <span>Parameters to be Baked:</span>
                  <span className="text-[10px] font-mono text-[#677083]">
                    {lutSize * lutSize * lutSize} RGB nodes
                  </span>
                </span>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-mono pt-1 border-t border-[#232938]">
                  <div className="flex justify-between text-[#8b95a8]">
                    <span>Base 3D LUT:</span>
                    <span className="text-[#f1f5f9] truncate max-w-[140px]" title={activeLut?.name}>
                      {lutEnabled && activeLut ? activeLut.name.split(' ')[0] : 'None'}
                    </span>
                  </div>

                  <div className="flex justify-between text-[#8b95a8]">
                    <span>LUT Mix:</span>
                    <span className="text-[#e5b96f]">
                      {lutEnabled && activeLut ? `${Math.round(adjustments.lutStrength * 100)}%` : '0%'}
                    </span>
                  </div>

                  <div className="flex justify-between text-[#8b95a8]">
                    <span>Exposure:</span>
                    <span className="text-[#f1f5f9]">
                      {adjustments.exposure > 0 ? `+${adjustments.exposure.toFixed(2)}` : adjustments.exposure.toFixed(2)} EV
                    </span>
                  </div>

                  <div className="flex justify-between text-[#8b95a8]">
                    <span>Contrast:</span>
                    <span className="text-[#f1f5f9]">{Math.round(adjustments.contrast * 100)}%</span>
                  </div>

                  <div className="flex justify-between text-[#8b95a8]">
                    <span>Temperature:</span>
                    <span className="text-[#e5b96f]">
                      {currentKelvin >= 0 ? `+${currentKelvin}` : currentKelvin} K
                    </span>
                  </div>

                  <div className="flex justify-between text-[#8b95a8]">
                    <span>Tint:</span>
                    <span className="text-[#38bdf8]">
                      {currentTint >= 0 ? `+${currentTint.toFixed(2)}` : currentTint.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between text-[#8b95a8]">
                    <span>Highlights:</span>
                    <span className="text-[#f1f5f9]">
                      {adjustments.highlights > 0 ? `+${adjustments.highlights}` : adjustments.highlights}
                    </span>
                  </div>

                  <div className="flex justify-between text-[#8b95a8]">
                    <span>Shadows:</span>
                    <span className="text-[#f1f5f9]">
                      {adjustments.shadows > 0 ? `+${adjustments.shadows}` : adjustments.shadows}
                    </span>
                  </div>
                </div>
              </div>

              {exportSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 text-xs font-mono flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>✓ LUT file exported and downloaded successfully!</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#222736] bg-[#141722]">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-[#202534] hover:bg-[#2b3245] text-[#9ba1b2] hover:text-[#f1f5f9] text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {isUnlocked && (
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#e5b96f] to-[#f0c883] hover:from-[#dcb065] hover:to-[#e5b96f] text-[#14120c] font-bold text-xs flex items-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Generating .CUBE...' : 'Download .CUBE LUT'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
