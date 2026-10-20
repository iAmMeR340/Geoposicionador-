import React, { useState } from 'react';
import { TacticalMessage, Soldier } from '../types';
import { 
  Radio, 
  Send, 
  X, 
  Lock, 
  ShieldAlert, 
  Volume2, 
  Mic, 
  MicOff, 
  CheckCheck,
  User
} from 'lucide-react';
import { tacticalAudio } from '../utils/audioAlerts';

interface TacticalCommsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: TacticalMessage[];
  soldiers: Soldier[];
  onSendMessage: (msg: { text: string; recipient: string; priority: 'RUTINA' | 'PRIORITARIO' | 'FLASH_OPERACIONAL' }) => void;
}

export const TacticalCommsDrawer: React.FC<TacticalCommsDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  soldiers,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState('TODAS LAS ESCUADRAS');
  const [selectedPriority, setSelectedPriority] = useState<'RUTINA' | 'PRIORITARIO' | 'FLASH_OPERACIONAL'>('PRIORITARIO');
  const [isPttActive, setIsPttActive] = useState(false);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    onSendMessage({
      text: inputText.trim(),
      recipient: selectedRecipient,
      priority: selectedPriority,
    });
    setInputText('');
    tacticalAudio.playRadioRoger();
  };

  const handlePttToggle = () => {
    if (!isPttActive) {
      tacticalAudio.playRadioRoger();
      setIsPttActive(true);
    } else {
      tacticalAudio.playRadioRoger();
      setIsPttActive(false);
      onSendMessage({
        text: `[TRANSMISIÓN DE VOZ CIFRADA PTT] Orden táctica transmitida por canal seguro a ${selectedRecipient}`,
        recipient: selectedRecipient,
        priority: 'PRIORITARIO',
      });
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-slate-900/98 border-l border-slate-700 shadow-2xl flex flex-col backdrop-blur-lg animate-slide-left">
      
      {/* Header */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-tactical text-base font-bold text-slate-100 flex items-center gap-2">
              <span>CANAL TÁCTICO CIFRADO</span>
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
            </h3>
            <p className="text-[11px] text-slate-400 font-mono-military">
              Frecuencia HF-E2EE &bull; Salto FHSS Activo
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Push To Talk Quick Bar */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="text-xs font-mono-military text-slate-400">
          <span>DESTINATARIO:</span>
          <select
            value={selectedRecipient}
            onChange={(e) => setSelectedRecipient(e.target.value)}
            className="block mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono-military focus:outline-none focus:border-cyan-500"
          >
            <option value="TODAS LAS ESCUADRAS">TODAS LAS ESCUADRAS (BROADCAST)</option>
            <option value="Escuadra Alfa (Vanguardia)">Escuadra Alfa (Vanguardia)</option>
            <option value="Escuadra Cóndor (Reconocimiento)">Escuadra Cóndor (Reconocimiento)</option>
            <option value="Escuadra Centinela (Perímetro)">Escuadra Centinela (Perímetro)</option>
            <option value="Unidad MEDEVAC Táctica">Unidad MEDEVAC Táctica</option>
            {soldiers.map((s) => (
              <option key={s.id} value={s.callsign}>
                {s.callsign} ({s.name})
              </option>
            ))}
          </select>
        </div>

        <button
          id="btn-ptt-toggle"
          onClick={handlePttToggle}
          className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl border font-mono-military text-[10px] font-bold transition-all ${
            isPttActive
              ? 'bg-red-600 text-white border-red-400 animate-pulse shadow-lg shadow-red-950'
              : 'bg-cyan-950 text-cyan-300 border-cyan-700 hover:bg-cyan-900'
          }`}
          title="Mantener presionado o pulsar para hablar"
        >
          {isPttActive ? <Mic className="w-5 h-5 mb-0.5" /> : <MicOff className="w-5 h-5 mb-0.5" />}
          <span>{isPttActive ? 'TRANSMITIENDO' : 'PTT VOZ'}</span>
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 font-mono-military text-xs">
        {messages.map((msg) => {
          const isMe = msg.sender.includes('C4I') || msg.sender.includes('MANDO');
          return (
            <div
              key={msg.id}
              className={`p-3 rounded-xl border ${
                isMe
                  ? 'bg-slate-950/90 border-slate-800 ml-4'
                  : 'bg-cyan-950/30 border-cyan-800/60 mr-4'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-bold text-emerald-400 text-[11px] flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {msg.sender}
                </span>
                <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
              </div>
              <p className="text-slate-200 text-xs leading-relaxed mb-1.5">{msg.text}</p>
              <div className="flex justify-between items-center text-[9px] text-slate-400 pt-1 border-t border-slate-800/60">
                <span className="text-cyan-400">Para: {msg.recipient}</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <Lock className="w-2.5 h-2.5" /> E2EE OK
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
        <div className="flex gap-2">
          <input
            id="input-comms-text"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Escribir directriz táctica..."
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono-military"
          />
          <button
            id="btn-send-comms"
            type="submit"
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-lg font-bold transition-colors flex items-center justify-center"
            title="Enviar mensaje encriptado"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-between items-center text-[10px] font-mono-military text-slate-400">
          <span>PRIORIDAD:</span>
          <div className="flex gap-1">
            {(['RUTINA', 'PRIORITARIO', 'FLASH_OPERACIONAL'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedPriority(p)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  selectedPriority === p
                    ? 'bg-slate-800 text-cyan-300 font-bold border border-cyan-600'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {p === 'FLASH_OPERACIONAL' ? 'Flash' : p === 'PRIORITARIO' ? 'Prioritario' : 'Rutina'}
              </button>
            ))}
          </div>
        </div>
      </form>

    </div>
  );
};
