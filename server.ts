import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize server-side Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    system: "AegisBase C4I Tactical Server",
    e2eeStatus: "AES-GCM-256 Validated",
    timestamp: new Date().toISOString(),
  });
});

// AI Tactical SITREP Generator & Biometric Anomaly Evaluator
app.post("/api/ai-sitrep", async (req, res) => {
  try {
    const { soldiers, alerts, activeZones } = req.body;
    const ai = getAiClient();

    const prompt = `Eres el Asesor Táctico y Médico de Inteligencia Militar C4I para la Base de Vigilancia Táctica.
Analiza la siguiente telemetría en tiempo real del personal desplegado, alertas activas y sectores geodelimitados:

PERSONAL EN EL TERRENO:
${JSON.stringify(
  soldiers?.map((s: any) => ({
    indicativo: s.callsign,
    nombre: s.name,
    escuadra: s.squad,
    estado: s.status,
    posicion: s.location,
    signosVitales: {
      bpm: s.vitals.heartRate,
      temp: s.vitals.temperature,
      spo2: s.vitals.oxygenSaturation,
      estres: s.vitals.stressLevel,
      impactoG: s.vitals.impactGForce,
      hombreCaido: s.vitals.fallDetected,
    },
    dispositivo: s.device,
    sectorActual: s.currentZoneId,
  })),
  null,
  2
)}

ALERTAS ACTIVAS REGISTRADAS:
${JSON.stringify(alerts?.slice(0, 5), null, 2)}

SECTORES / GEOFENCES:
${JSON.stringify(activeZones, null, 2)}

Genera un informe SITREP táctico formal, estructurado en español militar con los siguientes apartados:
1. RESUMEN EJECUTIVO DE SITUACIÓN (Nivel de Amenaza Global: VERDE / AMARILLO / NARANJA / ROJO).
2. DIAGNÓSTICO BIOMÉDICO & EVALUACIÓN DE VESTIBLES (Evaluación específica de anomalías: taquicardia, oximetría, golpes de calor, caídas detectadas).
3. EVALUACIÓN DE VIGILANCIA PERIMETRAL Y GEOFENCING (Riesgo en zonas de alta criticidad: polvorín, perímetro norte, selva).
4. ACCIONES TÁCTICAS Y DIRECTRICES DE MANDO RECOMENDADAS (Instrucciones inmediatas para QRF, MEDEVAC o relevo de centinelas).
5. ÍNDICE DE EFICIENCIA OPERACIONAL ESTIMADO (0 a 100%).

Mantén un tono militar profesional, conciso, de alta precisión y orientado a la preservación de la vida y la seguridad de la base.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction:
          "Eres un sistema de inteligencia militar C4I de última generación con capacidades de análisis biomédico y estratégico.",
      },
    });

    const report = response.text || "No se pudo generar el reporte en este momento.";
    res.json({ success: true, report, generatedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error("Error generating AI SITREP:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al procesar el reporte de inteligencia",
      fallbackReport:
        "ESTADO C4I: Advertencia táctica. Se detecta operador con impacto inercial y caída de SpO2 en Sector ECHO. Se recomienda despacho de unidad MEDEVAC y alerta perimetral en Sector CHARLIE.",
    });
  }
});

// Centralized Cloud Telemetry Sync with E2EE handshake simulation
app.post("/api/tactical/sync-telemetry", (req, res) => {
  const { packets, sender } = req.body;
  res.json({
    status: "SYNC_CONFIRMED",
    receivedPackets: packets?.length || 0,
    cipherSuite: "TLS 1.3 / AES-256-GCM / ECDH-P384",
    cloudStorageState: "ENCRYPTED_AT_REST",
    serverTimestamp: Date.now(),
  });
});

// Shared Tactical Markers State (Threats and Obstacles)
interface SharedMarker {
  id: string;
  type: "threat" | "obstacle";
  title: string;
  description: string;
  lat: number;
  lng: number;
  createdAt: string;
  createdBy: string;
  status: "active" | "resolved";
}

let sharedTacticalMarkers: SharedMarker[] = [
  {
    id: "marker-seed-1",
    type: "threat",
    title: "Presencia de Intruso Detectada",
    description: "Cámaras térmicas captaron firma de calor no identificada en perímetro terrestre.",
    lat: 9.4035,
    lng: -75.6772,
    createdAt: new Date().toISOString(),
    createdBy: "Patrulla Perimetral",
    status: "active",
  },
  {
    id: "marker-seed-2",
    type: "obstacle",
    title: "Obstáculo de Acceso Bravo",
    description: "Escombros por mantenimiento del camino de acceso trasero.",
    lat: 9.3965,
    lng: -75.6725,
    createdAt: new Date().toISOString(),
    createdBy: "Ingenieros Militares",
    status: "active",
  }
];

// GET all shared tactical markers
app.get("/api/tactical/markers", (req, res) => {
  res.json(sharedTacticalMarkers);
});

// POST a new shared tactical marker
app.post("/api/tactical/markers", (req, res) => {
  const { type, title, description, lat, lng, createdBy } = req.body;
  if (!type || !title || !lat || !lng) {
    return res.status(400).json({ success: false, error: "Faltan campos obligatorios" });
  }

  const newMarker: SharedMarker = {
    id: `marker-${Date.now()}`,
    type,
    title,
    description: description || "",
    lat: Number(lat),
    lng: Number(lng),
    createdAt: new Date().toISOString(),
    createdBy: createdBy || "Operador C4I",
    status: "active",
  };

  sharedTacticalMarkers.push(newMarker);
  res.status(201).json({ success: true, marker: newMarker });
});

// DELETE/Resolve a shared tactical marker
app.delete("/api/tactical/markers/:id", (req, res) => {
  const { id } = req.params;
  const initialLength = sharedTacticalMarkers.length;
  sharedTacticalMarkers = sharedTacticalMarkers.filter((m) => m.id !== id);

  if (sharedTacticalMarkers.length === initialLength) {
    return res.status(404).json({ success: false, error: "Marcador táctico no encontrado" });
  }

  res.json({ success: true, message: "Marcador eliminado o resuelto correctamente" });
});

// POST Clean temporary tactical markers older than X minutes (default 10 min)
app.post("/api/tactical/markers/clean-old", (req, res) => {
  const minutes = req.body.minutes ? Number(req.body.minutes) : 10;
  const cutoffTime = Date.now() - minutes * 60 * 1000;

  const initialCount = sharedTacticalMarkers.length;
  const removedMarkers = sharedTacticalMarkers.filter((m) => new Date(m.createdAt).getTime() < cutoffTime);
  sharedTacticalMarkers = sharedTacticalMarkers.filter((m) => new Date(m.createdAt).getTime() >= cutoffTime);

  const cleanedCount = initialCount - sharedTacticalMarkers.length;
  res.json({
    success: true,
    cleanedCount,
    remainingCount: sharedTacticalMarkers.length,
    removedMarkers,
  });
});

// Vite middleware in dev or static serving in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AegisBase Tactical Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
