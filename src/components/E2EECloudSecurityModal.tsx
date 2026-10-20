import React, { useState } from 'react';
import { E2EEPacket, Soldier } from '../types';
import { 
  Lock, 
  ShieldCheck, 
  Database, 
  Server, 
  Key, 
  RefreshCw, 
  FileCode, 
  CheckCircle2, 
  Wifi, 
  Eye, 
  EyeOff, 
  Copy, 
  Cpu
} from 'lucide-react';

interface E2EECloudSecurityModalProps {
  packets: E2EEPacket[];
  soldiers: Soldier[];
  onTriggerManualKeyRotation: () => void;
}

export const E2EECloudSecurityModal: React.FC<E2EECloudSecurityModalProps> = ({
  packets,
  soldiers,
  onTriggerManualKeyRotation,
}) => {
  const [selectedPacketIndex, setSelectedPacketIndex] = useState<number>(0);
  const [showPlaintext, setShowPlaintext] = useState<boolean>(false);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const currentPacket = packets[selectedPacketIndex] || packets[0];

  const handleRotate = () => {
    setIsRotating(true);
    setTimeout(() => {
      onTriggerManualKeyRotation();
      setIsRotating(false);
    }, 1200);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Top Architecture Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="font-tactical text-lg font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>ARQUITECTURA DE ENCRIPTACIÓN DE EXTREMO A EXTREMO (E2EE)</span>
            </h2>
            <p className="text-xs text-slate-400">
              Conexión centralizada en la nube bajo protocolo Zero-Trust con cifrado de grado militar
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-rotate-keys"
              onClick={handleRotate}
              disabled={isRotating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700 text-xs font-mono-military font-bold transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
              <span>{isRotating ? 'Rotando Claves...' : 'Rotación Dinámica de Claves'}</span>
            </button>
          </div>
        </div>

        {/* Visual E2EE Data Flow Pipeline */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          
          {/* Step 1: Wearable Device */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
              <Cpu className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold font-mono-military text-slate-200">1. VESTIBLE Mk-IV</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Captura signos vitales (BPM, SpO2, Temp, GPS). Encripta en chip con clave de sesión.
            </p>
            <span className="mt-2 text-[9px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono-military border border-emerald-800">
              AES-GCM-256
            </span>
          </div>

          {/* Step 2: Wireless Mesh Relay */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-2">
              <Wifi className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold font-mono-military text-slate-200">2. ENLACE TÁCTICO</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Transmisión por Red Malla o Satélite. Cifrado en tránsito TLS 1.3 con salto de canal.
            </p>
            <span className="mt-2 text-[9px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono-military border border-cyan-800">
              TLS 1.3 + Salto FHSS
            </span>
          </div>

          {/* Step 3: Central Cloud Database */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-2">
              <Database className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold font-mono-military text-slate-200">3. BASE EN LA NUBE</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Almacenamiento ciego: la nube solo aloja texto cifrado opaco sin acceso a claves privadas.
            </p>
            <span className="mt-2 text-[9px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 font-mono-military border border-purple-800">
              Zero-Knowledge DB
            </span>
          </div>

          {/* Step 4: Command Post Terminal */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
              <Server className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold font-mono-military text-slate-200">4. TERMINAL C4I</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Desencriptación exclusiva en el puesto de mando autorizado con autenticación HSM.
            </p>
            <span className="mt-2 text-[9px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono-military border border-emerald-800">
              Validación HMAC OK
            </span>
          </div>

        </div>
      </div>

      {/* Live Cryptographic Packet Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Packet Stream List */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
          <h3 className="font-tactical text-sm font-bold text-slate-100 flex items-center gap-2 mb-3">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <span>TRAMAS CRIPTOGRÁFICAS EN VIVO</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono-military">
              {packets.length} PAQUETES
            </span>
          </h3>

          <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1">
            {packets.map((pkt, index) => {
              const isSelected = index === selectedPacketIndex;
              return (
                <div
                  key={pkt.packetId}
                  onClick={() => setSelectedPacketIndex(index)}
                  className={`p-2.5 rounded-lg border text-xs font-mono-military cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-200">{pkt.packetId}</span>
                    <span className="text-[10px] text-slate-500">{pkt.timestamp}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-emerald-400">{pkt.soldierCallsign}</span>
                    <span className="text-cyan-400">{pkt.latencyMs}ms latencia</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Packet Deep Inspection */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-tactical text-sm font-bold text-slate-100 flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                <span>INSPECCIÓN DE ENVOLTURA CIPHERTEXT</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono-military">
                Paquete: {currentPacket ? currentPacket.packetId : '---'} &bull; Origen: {currentPacket ? currentPacket.sourceDevice : '---'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPlaintext(!showPlaintext)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono-military flex items-center gap-1.5 transition-colors"
              >
                {showPlaintext ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{showPlaintext ? 'Ocultar Texto Claro' : 'Desencriptar en Terminal'}</span>
              </button>
            </div>
          </div>

          {currentPacket ? (
            <div className="space-y-3 font-mono-military text-xs">
              
              {/* Cipher Suite & IV Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block mb-0.5">ALGORITMO / SUITE:</span>
                  <span className="text-emerald-400 font-bold">{currentPacket.cipherSuite}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block mb-0.5">VECTOR INICIALIZACIÓN (IV):</span>
                  <span className="text-cyan-300">{currentPacket.iv}</span>
                </div>
              </div>

              {/* Authentication Tag (GMAC) */}
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 text-[11px]">TAG DE AUTENTICACIÓN (HMAC / GMAC):</span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3 h-3" /> VERIFICADO
                  </span>
                </div>
                <p className="text-slate-300 break-all text-xs">{currentPacket.authTag}</p>
              </div>

              {/* Raw Ciphertext Payload */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-slate-400 font-bold text-xs flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-400" />
                    PAYLOAD ENCRIPTADO (ALMACENADO EN NUBE):
                  </span>
                  <button
                    onClick={() => copyToClipboard(currentPacket.encryptedPayload)}
                    className="text-[10px] text-slate-400 hover:text-emerald-400 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copied ? 'Copiado' : 'Copiar Hex'}</span>
                  </button>
                </div>
                <div className="bg-slate-900/90 p-2.5 rounded border border-slate-800 text-amber-300 break-all text-[11px] leading-relaxed">
                  {currentPacket.encryptedPayload}
                </div>
              </div>

              {/* Decrypted Payload (Terminal View) */}
              {showPlaintext && (
                <div className="bg-emerald-950/20 p-3 rounded-lg border border-emerald-500/40 animate-fade-in">
                  <span className="text-emerald-400 font-bold text-xs block mb-1.5">
                    PAYLOAD DESENCRIPTADO EN TERMINAL C4I AUTORIZADO:
                  </span>
                  <pre className="bg-slate-950 p-2.5 rounded border border-emerald-900/60 text-emerald-300 text-[11px] overflow-x-auto">
                    {JSON.stringify(
                      {
                        indicativo: currentPacket.soldierCallsign,
                        coordenadas: {
                          latitud: currentPacket.decryptedData.lat,
                          longitud: currentPacket.decryptedData.lng,
                        },
                        signosVitales: {
                          bpm: currentPacket.decryptedData.hr,
                          temp: `${currentPacket.decryptedData.temp}°C`,
                          spo2: `${currentPacket.decryptedData.spo2}%`,
                        },
                        integridad: 'AES_GCM_VERIFICADO_100%',
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}

            </div>
          ) : (
            <div className="text-slate-500 text-center py-10 font-mono-military">
              Esperando paquetes de telemetría...
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
