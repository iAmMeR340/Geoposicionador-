import React, { useState } from 'react';
import { Soldier, TacticalZone } from '../types';
import { UserPlus, X, Shield, Radio, Activity } from 'lucide-react';
import { BASE_CENTER } from '../data/tacticalData';

interface DeployOperatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  zones: TacticalZone[];
  onDeploy: (newSoldier: Soldier) => void;
}

export const DeployOperatorModal: React.FC<DeployOperatorModalProps> = ({
  isOpen,
  onClose,
  zones,
  onDeploy,
}) => {
  const [callsign, setCallsign] = useState('');
  const [name, setName] = useState('');
  const [rank, setRank] = useState<Soldier['rank']>('Soldado Profesional');
  const [squad, setSquad] = useState<Soldier['squad']>('Escuadra Alfa (Vanguardia)');
  const [role, setRole] = useState<Soldier['role']>('Centinela Perimetral');
  const [zoneId, setZoneId] = useState<string>(zones[0]?.id || 'zone-hq');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!callsign.trim() || !name.trim()) return;

    const targetZone = zones.find((z) => z.id === zoneId) || zones[0];
    const offsetLat = (Math.random() - 0.5) * 0.002;
    const offsetLng = (Math.random() - 0.5) * 0.002;

    const newSoldier: Soldier = {
      id: `soldier-${Date.now()}`,
      callsign: callsign.toUpperCase(),
      name,
      rank,
      squad,
      role,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      location: {
        lat: targetZone.center[0] + offsetLat,
        lng: targetZone.center[1] + offsetLng,
        altitude: 350 + Math.floor(Math.random() * 30),
        speed: 1.2,
        heading: Math.floor(Math.random() * 360),
        accuracy: 0.6,
        lastUpdate: 'Justo ahora',
      },
      vitals: {
        heartRate: 75 + Math.floor(Math.random() * 15),
        temperature: 36.6,
        oxygenSaturation: 98,
        fatigueLevel: 15,
        stressLevel: 'BAJO',
        steps: 1200,
        fallDetected: false,
        impactGForce: 1.0,
        ecgStatus: 'NORMAL',
      },
      device: {
        model: 'TacticalBand Mk-IV Pro',
        batteryLevel: 100,
        signalStrength: -60,
        connectionType: 'ENLACE SATELITAL',
        encryptionStatus: 'AES-GCM-256 (ACTIVO)',
        lastSync: 'En tiempo real',
        encryptionKeyHash: `0x${Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase()}...SEC`,
        firmwareVersion: 'v4.18.2-SEC',
      },
      status: 'OPERATIVO',
      currentZoneId: targetZone.id,
      routeHistory: [
        {
          lat: targetZone.center[0] + offsetLat,
          lng: targetZone.center[1] + offsetLng,
          timestamp: new Date().toLocaleTimeString().slice(0, 5),
          hr: 76,
          spo2: 98,
        },
      ],
    };

    onDeploy(newSoldier);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-tactical text-base font-bold text-slate-100">
                DESPLEGAR NUEVO OPERADOR TÁCTICO
              </h3>
              <p className="text-xs text-slate-400 font-mono-military">
                Vinculación de vestible Mk-IV y enlace E2EE a la red C4I
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3 font-mono-military text-xs">
          <div>
            <label className="block text-slate-400 mb-1">INDICATIVO TÁCTICO (CALLSIGN):</label>
            <input
              type="text"
              required
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
              placeholder="Ej: ALFA-3 (EXPLORADOR)"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">NOMBRE Y APELLIDO:</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Cabo Juan Perez"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">RANGO MILITAR:</label>
              <select
                value={rank}
                onChange={(e) => setRank(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="Capitán">Capitán</option>
                <option value="Teniente">Teniente</option>
                <option value="Sargento Primero">Sargento Primero</option>
                <option value="Sargento Segundo">Sargento Segundo</option>
                <option value="Cabo Primero">Cabo Primero</option>
                <option value="Soldado Profesional">Soldado Profesional</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">ESCUADRA:</label>
              <select
                value={squad}
                onChange={(e) => setSquad(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="Escuadra Alfa (Vanguardia)">Escuadra Alfa (Vanguardia)</option>
                <option value="Escuadra Cóndor (Reconocimiento)">Escuadra Cóndor (Reconocimiento)</option>
                <option value="Escuadra Centinela (Perímetro)">Escuadra Centinela (Perímetro)</option>
                <option value="Unidad MEDEVAC Táctica">Unidad MEDEVAC Táctica</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">ROL TÁCTICO:</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="Comandante de Pelotón">Comandante de Pelotón</option>
                <option value="Líder de Patrulla">Líder de Patrulla</option>
                <option value="Tirador Designado">Tirador Designado</option>
                <option value="Médico de Combate">Médico de Combate</option>
                <option value="Operador C4I & Drones">Operador C4I & Drones</option>
                <option value="Centinela Perimetral">Centinela Perimetral</option>
                <option value="Especialista EOD">Especialista EOD</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">SECTOR DE DESPLIEGUE:</label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition-all flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Desplegar y Sincronizar E2EE</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
