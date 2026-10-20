import React, { useState, useEffect } from 'react';
import { ShieldAlert, Check, X, ShieldX, Clock } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  criticalText: string;
  severity?: 'warning' | 'danger';
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  criticalText,
  severity = 'warning',
}) => {
  const [isChecked, setIsChecked] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [isCounting, setIsCounting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsChecked(false);
      setCountdown(3);
      setIsCounting(true);
    } else {
      setIsCounting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isCounting || countdown <= 0) return;
    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, isCounting]);

  if (!isOpen) return null;

  const isButtonDisabled = !isChecked || countdown > 0;
  const isDanger = severity === 'danger';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
      <div 
        id="tactical-confirmation-dialog"
        className={`w-full max-w-md bg-slate-900 border ${
          isDanger ? 'border-red-500/50 shadow-red-950/30' : 'border-amber-500/50 shadow-amber-950/30'
        } rounded-2xl shadow-2xl overflow-hidden flex flex-col font-mono-military text-slate-100`}
      >
        {/* Warning Accent Header Strip */}
        <div className={`h-1.5 w-full ${isDanger ? 'bg-red-500' : 'bg-amber-500'}`} />

        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDanger ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
              {isDanger ? <ShieldX className="w-6 h-6 animate-pulse" /> : <ShieldAlert className="w-6 h-6 animate-pulse" />}
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wider text-slate-100 uppercase">
                {title}
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">
                PROTOCOLO DE CONFIRMACIÓN CRÍTICA
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-2 leading-relaxed">
            <p className="font-semibold text-slate-200">
              {description}
            </p>
            <div className="pt-2 border-t border-slate-900 flex items-start gap-1.5 text-[11px] text-slate-400">
              <span className="text-red-400 font-bold">ADVERTENCIA:</span>
              <span>Esta acción transmite órdenes directas a través de los sistemas cifrados de AegisBase. No se puede revertir tras su ejecución.</span>
            </div>
          </div>

          {/* Verification Checkbox */}
          <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 flex items-start gap-2.5">
            <input
              id="chk-authorize-action"
              type="checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              className={`mt-0.5 w-4.5 h-4.5 rounded border-slate-700 focus:ring-offset-0 focus:ring-0 cursor-pointer ${
                isDanger ? 'text-red-500 accent-red-500' : 'text-amber-500 accent-amber-500'
              }`}
            />
            <label 
              htmlFor="chk-authorize-action" 
              className="text-[11px] text-slate-300 font-medium cursor-pointer select-none leading-normal"
            >
              Autorizo formalmente la ejecución de esta acción crítica en el panel de mando táctico.
            </label>
          </div>

          {/* Dynamic Action Buttons */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              id="btn-confirm-cancel"
              onClick={onClose}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>Abortar</span>
            </button>

            <button
              id="btn-confirm-authorize"
              onClick={() => {
                if (!isButtonDisabled) {
                  onConfirm();
                  onClose();
                }
              }}
              disabled={isButtonDisabled}
              className={`flex-[1.5] py-2 px-3 rounded-xl text-slate-950 text-xs font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-1.5 ${
                isButtonDisabled
                  ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-800'
                  : isDanger
                    ? 'bg-red-500 hover:bg-red-400 shadow-lg shadow-red-950/50 text-slate-950'
                    : 'bg-amber-500 hover:bg-amber-400 shadow-lg shadow-amber-950/50 text-slate-950'
              }`}
            >
              {countdown > 0 ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>BLOQUEO ({countdown}s)</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{criticalText}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
