import React, { useState } from 'react';
import { X, Mail, Check, Copy, ExternalLink, MessageSquare } from 'lucide-react';

interface ContactDeveloperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactDeveloperModal: React.FC<ContactDeveloperModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const developerEmail = 'shyju7896@gmail.com';

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(developerEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback if clipboard API is restricted
      const textArea = document.createElement('textarea');
      textArea.value = developerEmail;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none"
      onClick={onClose}
    >
      <div
        className="bg-[#15171f] border border-[#2e3240] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#242734]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#272118] border border-[#523e21] flex items-center justify-center text-[#e5b96f]">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#f4f6fa] tracking-tight">Contact the Developer</h3>
              <p className="text-[11px] text-[#8e94a4]">Support, feedback & custom LUT requests</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8e94a4] hover:text-[#eceef2] hover:bg-[#222530] transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-[#1b1e27] border border-[#282d3b]">
            <MessageSquare className="w-4 h-4 text-[#e5b96f] shrink-0 mt-0.5" />
            <p className="text-xs text-[#a9b0c2] leading-relaxed">
              Have feedback, a feature request, or need custom camera profile LUTs for your workflow? Reach out via email:
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#111318] border border-[#262a36] flex flex-col gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#798194]">
              Developer Email
            </span>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-mono text-sm sm:text-base font-semibold text-[#e5b96f] select-all break-all">
                {developerEmail}
              </span>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg bg-[#1f232e] hover:bg-[#2b3040] text-[#eceef2] text-xs font-medium border border-[#373d4e] transition-colors flex items-center gap-1.5 shrink-0"
                title="Copy email to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#a6adb8]" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <a
              href={`mailto:${developerEmail}?subject=Nikon%20ZR%20Player%20Feedback`}
              className="flex-1 py-2 px-3 rounded-lg bg-[#e5b96f] hover:bg-[#f0c883] text-[#14120c] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Send Email</span>
            </a>
            <button
              onClick={onClose}
              className="py-2 px-4 rounded-lg bg-[#1b1e27] hover:bg-[#252936] text-[#b3b9c8] text-xs font-medium border border-[#2d3240] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
