import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { Soldier, TacticalZone, TacticalAlert, TacticalMarker, TacticalPatrol } from '../types';
import { 
  Mountain, 
  Globe, 
  Compass, 
  Eye, 
  Layers, 
  Sun, 
  Flame, 
  ShieldAlert, 
  Activity, 
  Heart, 
  Battery, 
  Maximize2, 
  RotateCcw, 
  Sliders, 
  Sparkles, 
  MapPin, 
  Crosshair, 
  Radio, 
  Zap, 
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Users,
  Navigation,
  Info,
  Thermometer,
  Moon,
  Tv,
  Target,
  LocateFixed,
  Satellite,
  Waves,
  Building2,
  Wind
} from 'lucide-react';
import { latLngToMGRS } from '../utils/cryptoUtils';

interface Tactical3DMapViewProps {
  soldiers: Soldier[];
  zones: TacticalZone[];
  alerts: TacticalAlert[];
  selectedSoldierId: string | null;
  onSelectSoldier: (id: string) => void;
  baseCenter: [number, number];
  sharedMarkers?: TacticalMarker[];
  patrols?: TacticalPatrol[];
  onUpdatePatrols?: (patrols: TacticalPatrol[]) => void;
}

type MapMode3D = 'terrain' | 'globe';
type RenderStyle3D = 'topo' | 'flir' | 'nightvision' | 'wireframe';

// Procedural Canvas Texture for High-Def Tactical Globe
const createTacticalGlobeTexture = (style: RenderStyle3D): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  // Base Ocean background
  let oceanColor = '#060d1a';
  let landFill = '#0e243a';
  let landStroke = '#0ea5e9';
  let gridColor = 'rgba(14, 165, 233, 0.15)';

  if (style === 'nightvision') {
    oceanColor = '#01140b';
    landFill = '#06381e';
    landStroke = '#10b981';
    gridColor = 'rgba(16, 185, 129, 0.2)';
  } else if (style === 'flir') {
    oceanColor = '#120224';
    landFill = '#3b0764';
    landStroke = '#c084fc';
    gridColor = 'rgba(192, 132, 252, 0.2)';
  } else if (style === 'wireframe') {
    oceanColor = '#020617';
    landFill = '#091e30';
    landStroke = '#00f2fe';
    gridColor = 'rgba(0, 242, 254, 0.25)';
  }

  ctx.fillStyle = oceanColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Tactical Coordinate Graticule (Lat / Long Lines)
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;

  // Longitude Meridians
  for (let x = 0; x <= canvas.width; x += canvas.width / 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // Latitude Parallels
  for (let y = 0; y <= canvas.height; y += canvas.height / 12) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw Stylized Continents (Approximated geometric polygons for global theater)
  ctx.fillStyle = landFill;
  ctx.strokeStyle = landStroke;
  ctx.lineWidth = 2;

  const drawPolygon = (pts: [number, number][]) => {
    ctx.beginPath();
    pts.forEach(([px, py], i) => {
      const x = (px / 360 + 0.5) * canvas.width;
      const y = (0.5 - py / 180) * canvas.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  // South America (Detailed around Colombia / Caribbean)
  drawPolygon([
    [-77, 12], [-71, 12], [-60, 9], [-50, 0], [-35, -5], [-38, -13],
    [-48, -28], [-53, -33], [-65, -45], [-68, -55], [-74, -52], [-73, -40],
    [-71, -30], [-76, -14], [-81, -5], [-80, 2], [-77, 8], [-77, 12]
  ]);

  // North America
  drawPolygon([
    [-165, 65], [-140, 70], [-100, 70], [-60, 60], [-65, 45], [-75, 35],
    [-80, 25], [-97, 26], [-90, 20], [-83, 10], [-90, 15], [-105, 23],
    [-118, 33], [-124, 48], [-140, 58], [-165, 60]
  ]);

  // Europe & Mediterranean
  drawPolygon([
    [-9, 36], [-9, 43], [2, 51], [10, 55], [20, 60], [30, 70],
    [40, 65], [35, 45], [26, 40], [15, 38], [0, 37], [-9, 36]
  ]);

  // Africa
  drawPolygon([
    [-17, 15], [-5, 36], [10, 37], [32, 31], [43, 12], [51, 10],
    [40, -10], [33, -28], [26, -34], [18, -34], [12, -15], [9, 4],
    [-15, 11], [-17, 15]
  ]);

  // Asia
  drawPolygon([
    [40, 65], [60, 75], [100, 77], [140, 70], [170, 65], [140, 50],
    [130, 35], [120, 23], [105, 10], [80, 13], [70, 25], [50, 25],
    [40, 38], [40, 65]
  ]);

  // Australia
  drawPolygon([
    [114, -22], [123, -15], [136, -12], [148, -20], [153, -28],
    [150, -37], [138, -36], [116, -35], [114, -22]
  ]);

  // Highlight Colombia Tactical AO on Globe
  const colX = (-75.68 / 360 + 0.5) * canvas.width;
  const colY = (0.5 - 9.4 / 180) * canvas.height;

  // Radar ping on C4I Base
  ctx.strokeStyle = '#10b981';
  ctx.fillStyle = '#10b981';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(colX, colY, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(colX, colY, 18, 0, Math.PI * 2);
  ctx.stroke();

  // Label Base
  ctx.font = 'bold 18px monospace';
  ctx.fillStyle = '#34d399';
  ctx.fillText('BASE C4I COVEÑAS', colX + 22, colY + 6);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
};

export const Tactical3DMapView: React.FC<Tactical3DMapViewProps> = ({
  soldiers,
  zones,
  alerts,
  selectedSoldierId,
  onSelectSoldier,
  baseCenter,
  sharedMarkers = [],
  patrols = [],
  onUpdatePatrols
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Controls state
  const [mode3D, setMode3D] = useState<MapMode3D>('terrain');
  const [renderStyle, setRenderStyle] = useState<RenderStyle3D>('topo');
  const [elevationScale, setElevationScale] = useState<number>(2.2); // Elevation exaggeration factor
  const [timeOfDay, setTimeOfDay] = useState<'noon' | 'dusk' | 'night'>('noon');
  const [showWireframe, setShowWireframe] = useState<boolean>(true);
  const [showZones3D, setShowZones3D] = useState<boolean>(true);
  const [showTrails3D, setShowTrails3D] = useState<boolean>(true);
  const [showBaseStructures, setShowBaseStructures] = useState<boolean>(true);
  const [showSatellites, setShowSatellites] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [isFollowOperator, setIsFollowOperator] = useState<boolean>(false);
  const [hoveredSoldier, setHoveredSoldier] = useState<Soldier | null>(null);
  const [cameraView, setCameraView] = useState<'perspective' | 'top' | 'close' | 'cinematic'>('perspective');
  const [fps, setFps] = useState<number>(60);

  // Selected soldier full object
  const selectedSoldier = useMemo(() => {
    return soldiers.find(s => s.id === selectedSoldierId) || null;
  }, [soldiers, selectedSoldierId]);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const reqIdRef = useRef<number | null>(null);
  const terrainMeshRef = useRef<THREE.Mesh | null>(null);
  const waterMeshRef = useRef<THREE.Mesh | null>(null);
  const radarDishRef = useRef<THREE.Group | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const satellitesGroupRef = useRef<THREE.Group | null>(null);
  const unitsGroupRef = useRef<THREE.Group | null>(null);
  const zonesGroupRef = useRef<THREE.Group | null>(null);
  const trailsGroupRef = useRef<THREE.Group | null>(null);
  const baseStructuresGroupRef = useRef<THREE.Group | null>(null);
  const lightRef = useRef<THREE.DirectionalLight | null>(null);

  // Mouse / Interaction State for custom Orbiting
  const isDraggingRef = useRef<boolean>(false);
  const previousMousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Camera animation & damping state
  const targetAngleRef = useRef<{ theta: number; phi: number; radius: number; target: THREE.Vector3 }>({
    theta: Math.PI / 4,
    phi: Math.PI / 3.2,
    radius: 130,
    target: new THREE.Vector3(0, 0, 0)
  });
  const currentAngleRef = useRef<{ theta: number; phi: number; radius: number; target: THREE.Vector3 }>({
    theta: Math.PI / 4,
    phi: Math.PI / 3.2,
    radius: 130,
    target: new THREE.Vector3(0, 0, 0)
  });
  const dragVelocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchStartDistRef = useRef<number | null>(null);

  // Raycaster for 3D picking & clicking
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mousePosRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // Compass Heading readout state (degrees 0-360)
  const [compassHeading, setCompassHeading] = useState<number>(45);

  // Calculate terrain height algorithmically representing coastal/hilly topography around Coveñas & San Antero
  const getElevation = useCallback((lat: number, lng: number): number => {
    const dLat = (lat - baseCenter[0]) * 111000; // meters approx
    const dLng = (lng - baseCenter[1]) * 111000 * Math.cos((baseCenter[0] * Math.PI) / 180);
    
    // Coveñas has the Caribbean Sea to the West/Northwest (dLng < -800)
    const coastalDistance = dLng + 600;
    if (coastalDistance < 0) {
      // In the Gulf / Sea: 0 elevation
      return 0.5;
    }

    // Coastal plain (Coveñas littoral): gently rising 2m to 25m
    const coastalPlain = Math.min(25, coastalDistance * 0.02);

    // Cordillera de San Jerónimo / Montes de María foothills to the East/Southeast
    const hills1 = Math.sin(dLat * 0.0018 + dLng * 0.0012) * 32;
    const hills2 = Math.cos(dLng * 0.0025 - dLat * 0.0015) * 22;
    const ridge = Math.pow(Math.max(0, Math.sin(dLat * 0.0009 + 0.5)), 2) * 45;
    
    const elevation = Math.max(1.0, coastalPlain + hills1 + hills2 + ridge);
    return Math.min(135, elevation);
  }, [baseCenter]);

  // Main Three.js Scene Setup & Render Loop
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Background color based on mode/style
    if (renderStyle === 'nightvision') {
      scene.background = new THREE.Color(0x011308);
      scene.fog = new THREE.FogExp2(0x011308, 0.0035);
    } else if (renderStyle === 'flir') {
      scene.background = new THREE.Color(0x080014);
      scene.fog = new THREE.FogExp2(0x080014, 0.0028);
    } else if (renderStyle === 'wireframe') {
      scene.background = new THREE.Color(0x020617);
      scene.fog = new THREE.FogExp2(0x020617, 0.002);
    } else if (timeOfDay === 'night') {
      scene.background = new THREE.Color(0x030712); // slate-950
      scene.fog = new THREE.FogExp2(0x030712, 0.0022);
    } else if (timeOfDay === 'dusk') {
      scene.background = new THREE.Color(0x190c2a);
      scene.fog = new THREE.FogExp2(0x190c2a, 0.0018);
    } else {
      scene.background = new THREE.Color(0x071122); // Deep Tactical Navy
      scene.fog = new THREE.FogExp2(0x071122, 0.0015);
    }

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 3500);
    cameraRef.current = camera;
    
    // Position camera based on current spherical angles
    const updateCameraFromAngles = () => {
      const cur = currentAngleRef.current;
      camera.position.x = cur.target.x + cur.radius * Math.sin(cur.phi) * Math.sin(cur.theta);
      camera.position.y = cur.target.y + cur.radius * Math.cos(cur.phi);
      camera.position.z = cur.target.z + cur.radius * Math.sin(cur.phi) * Math.cos(cur.theta);
      camera.lookAt(cur.target);
    };
    updateCameraFromAngles();

    // 3. Lights
    const ambientLight = new THREE.AmbientLight(
      renderStyle === 'nightvision' ? 0x22c55e : renderStyle === 'flir' ? 0xd946ef : 0xffffff,
      timeOfDay === 'night' ? 0.35 : 0.85
    );
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, timeOfDay === 'night' ? 0.6 : 1.3);
    if (timeOfDay === 'dusk') {
      dirLight.color.setHex(0xff9944);
      dirLight.position.set(-140, 50, -100);
    } else if (timeOfDay === 'night') {
      dirLight.color.setHex(0x5577cc);
      dirLight.position.set(60, 100, 60);
    } else {
      dirLight.position.set(120, 180, 100);
    }
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);
    lightRef.current = dirLight;

    // 4. Renderer with WebGL context resilience
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      powerPreference: 'high-performance',
      alpha: false 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    const domElement = renderer.domElement;
    containerRef.current.appendChild(domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('[3D Map] WebGL context lost');
    };
    const onContextRestored = () => {
      console.info('[3D Map] WebGL context restored');
    };
    domElement.addEventListener('webglcontextlost', onContextLost);
    domElement.addEventListener('webglcontextrestored', onContextRestored);

    // Groups
    const unitsGroup = new THREE.Group();
    const zonesGroup = new THREE.Group();
    const trailsGroup = new THREE.Group();
    const baseStructuresGroup = new THREE.Group();
    const satellitesGroup = new THREE.Group();

    unitsGroupRef.current = unitsGroup;
    zonesGroupRef.current = zonesGroup;
    trailsGroupRef.current = trailsGroup;
    baseStructuresGroupRef.current = baseStructuresGroup;
    satellitesGroupRef.current = satellitesGroup;

    scene.add(unitsGroup);
    scene.add(zonesGroup);
    scene.add(trailsGroup);
    scene.add(baseStructuresGroup);
    scene.add(satellitesGroup);

    // BUILD MODE SPECIFIC GRAPHICS
    if (mode3D === 'terrain') {
      buildTerrain3D(scene, renderStyle, elevationScale, showWireframe, baseCenter);
      buildBaseStructures3D(baseStructuresGroup);
    } else {
      buildGlobe3D(scene, renderStyle, satellitesGroup);
    }

    // ANIMATION & RENDER LOOP WITH VELOCITY DAMPING
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let headingThrottle = 0;

    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);

      const now = performance.now();
      frameCount++;
      if (now - lastFrameTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastFrameTime)));
        frameCount = 0;
        lastFrameTime = now;
      }

      // Smooth inertia & damping for camera orbit
      if (!isDraggingRef.current) {
        // Apply remaining velocity
        targetAngleRef.current.theta += dragVelocityRef.current.x;
        targetAngleRef.current.phi = Math.max(
          0.08,
          Math.min(Math.PI / 2 - 0.04, targetAngleRef.current.phi + dragVelocityRef.current.y)
        );
        // Decay velocity
        dragVelocityRef.current.x *= 0.90;
        dragVelocityRef.current.y *= 0.90;
      }

      // Smooth lerp current angles toward target angles
      const cur = currentAngleRef.current;
      const tgt = targetAngleRef.current;
      cur.theta += (tgt.theta - cur.theta) * 0.12;
      cur.phi += (tgt.phi - cur.phi) * 0.12;
      cur.radius += (tgt.radius - cur.radius) * 0.14;
      cur.target.lerp(tgt.target, 0.12);

      updateCameraFromAngles();

      // Update compass heading display throttled
      headingThrottle++;
      if (headingThrottle % 6 === 0) {
        let deg = Math.round(((-cur.theta * 180) / Math.PI) % 360);
        if (deg < 0) deg += 360;
        setCompassHeading(deg);
      }

      // Rotate Military Radar Dish in 3D Base
      if (radarDishRef.current) {
        radarDishRef.current.rotation.y += 0.025;
      }

      // Rotate Satellites in Globe Mode
      if (satellitesGroupRef.current) {
        satellitesGroupRef.current.rotation.y += 0.004;
      }

      // Auto rotation in Globe mode or cinematic terrain
      if (autoRotate) {
        if (mode3D === 'globe' && globeGroupRef.current) {
          globeGroupRef.current.rotation.y += 0.003;
        } else if (mode3D === 'terrain') {
          targetAngleRef.current.theta += 0.002;
        }
      }

      // Water Shimmer Animation
      if (waterMeshRef.current && (waterMeshRef.current.material as THREE.MeshPhongMaterial)) {
        const mat = waterMeshRef.current.material as THREE.MeshPhongMaterial;
        mat.opacity = 0.68 + Math.sin(now * 0.0025) * 0.08;
      }

      // Pulse beacon rings for active soldiers and threat zones
      if (unitsGroupRef.current) {
        unitsGroupRef.current.children.forEach(child => {
          const ring = child.getObjectByName('pulseRing');
          if (ring) {
            const scale = 1 + (Math.sin(now * 0.0045) * 0.28);
            ring.scale.set(scale, scale, scale);
          }
          const radarSweep = child.getObjectByName('radarSweep');
          if (radarSweep) {
            radarSweep.rotation.z += 0.04;
          }
        });
      }

      // Globe beacon pulse
      if (globeGroupRef.current) {
        const globeRing = globeGroupRef.current.getObjectByName('pulseRing');
        if (globeRing) {
          const scale = 1 + (Math.sin(now * 0.004) * 0.35);
          globeRing.scale.set(scale, scale, scale);
        }
      }

      // Smooth follow operator camera
      if (isFollowOperator && selectedSoldier && selectedSoldier.location && typeof selectedSoldier.location.lat === 'number' && typeof selectedSoldier.location.lng === 'number' && mode3D === 'terrain') {
        const targetX = (selectedSoldier.location.lng - baseCenter[1]) * 12000;
        const targetZ = -(selectedSoldier.location.lat - baseCenter[0]) * 12000;
        const targetY = (selectedSoldier.location.altitude || getElevation(selectedSoldier.location.lat, selectedSoldier.location.lng)) * 0.15 * elevationScale;
        
        targetAngleRef.current.target.set(targetX, targetY, targetZ);
      }

      renderer.render(scene, camera);
    };
    animate();

    // Window Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      domElement.removeEventListener('webglcontextlost', onContextLost);
      domElement.removeEventListener('webglcontextrestored', onContextRestored);
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
        rendererRef.current.dispose();
      }
    };
  }, [mode3D, renderStyle, elevationScale, timeOfDay, showWireframe, autoRotate, baseCenter, getElevation]);

  // BUILD 3D TERRAIN TOPOGRAPHY MESH WITH ELEVATION & HYPSOMETRIC COLORING
  const buildTerrain3D = (
    scene: THREE.Scene, 
    style: RenderStyle3D, 
    elevScale: number, 
    wireframe: boolean,
    center: [number, number]
  ) => {
    const size = 200;
    const segments = 140;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2); // Horizontal plane

    const posAttr = geometry.attributes.position;
    const colors = [];

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);

      // Convert local mesh plane X/Z back to Lat/Lng
      const lat = center[0] - vz / 12000;
      const lng = center[1] + vx / 12000;

      const alt = getElevation(lat, lng);
      const vy = alt * 0.15 * elevScale;
      posAttr.setY(i, vy);

      // Color mapping according to terrain height and tactical style
      const normHeight = Math.min(1, Math.max(0, alt / 120));

      if (style === 'flir') {
        // FLIR thermal color ramp: violet -> magenta -> red -> orange -> yellow -> white
        const c = new THREE.Color();
        if (normHeight < 0.1) c.setHex(0x18002e);
        else if (normHeight < 0.35) c.setHex(0x700060);
        else if (normHeight < 0.65) c.setHex(0xe11d48);
        else if (normHeight < 0.85) c.setHex(0xf97316);
        else c.setHex(0xfef08a);
        colors.push(c.r, c.g, c.b);
      } else if (style === 'nightvision') {
        // Monochromatic military phosphor green CRT
        const c = new THREE.Color().setHSL(0.38, 0.95, 0.12 + normHeight * 0.55);
        colors.push(c.r, c.g, c.b);
      } else if (style === 'wireframe') {
        // Cyber Grid Slate Teal
        const c = new THREE.Color().setHSL(0.55, 0.8, 0.15 + normHeight * 0.4);
        colors.push(c.r, c.g, c.b);
      } else {
        // Military Topographic Color Ramp
        const c = new THREE.Color();
        if (normHeight < 0.08) c.setHex(0x0f343a); // Sea littoral beach edge
        else if (normHeight < 0.3) c.setHex(0x064e3b); // Coastal Mangrove Green
        else if (normHeight < 0.6) c.setHex(0x1e3a1e); // Lowland Savannah / Brush
        else if (normHeight < 0.85) c.setHex(0x78350f); // Hill Ridge Earth / Ochre
        else c.setHex(0x38bdf8); // High Crest Radar Altitude Line
        colors.push(c.r, c.g, c.b);
      }
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      flatShading: true,
      shininess: style === 'flir' ? 40 : 12,
      side: THREE.DoubleSide
    });

    const terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    terrainMeshRef.current = terrainMesh;
    scene.add(terrainMesh);

    // 2. Realistic Ocean Plane (Golfo de Morrosquillo water plane)
    const waterGeom = new THREE.PlaneGeometry(size, size);
    waterGeom.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshPhongMaterial({
      color: style === 'nightvision' ? 0x022c22 : style === 'flir' ? 0x1f0038 : 0x0369a1,
      emissive: style === 'nightvision' ? 0x011b13 : 0x082f49,
      transparent: true,
      opacity: 0.72,
      shininess: 90,
      specular: 0x38bdf8
    });
    const waterMesh = new THREE.Mesh(waterGeom, waterMat);
    waterMesh.position.y = 0.8;
    waterMeshRef.current = waterMesh;
    scene.add(waterMesh);

    // 3. Wireframe Topo Contour Overlay
    if (wireframe || style === 'wireframe') {
      const wireframeGeom = new THREE.WireframeGeometry(geometry);
      let wireColor = 0x10b981; // Emerald
      if (style === 'nightvision') wireColor = 0x22c55e;
      if (style === 'flir') wireColor = 0xf43f5e;
      if (style === 'wireframe') wireColor = 0x00f2fe;

      const wireframeMat = new THREE.LineBasicMaterial({ 
        color: wireColor, 
        transparent: true, 
        opacity: style === 'wireframe' ? 0.85 : 0.22 
      });
      const wireframeMesh = new THREE.LineSegments(wireframeGeom, wireframeMat);
      wireframeMesh.position.y += 0.08;
      scene.add(wireframeMesh);
    }
  };

  // BUILD 3D BASE STRUCTURES (HQ Bunker, Helipad, Tactical Radar Tower)
  const buildBaseStructures3D = (group: THREE.Group) => {
    if (!showBaseStructures) return;

    // Clear previous
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    // 1. Helipad (At base origin)
    const helipadGeom = new THREE.CylinderGeometry(8, 8, 0.4, 32);
    const helipadMat = new THREE.MeshPhongMaterial({ color: 0x1e293b, shininess: 20 });
    const helipadMesh = new THREE.Mesh(helipadGeom, helipadMat);
    helipadMesh.position.set(0, 2.5, 0);
    group.add(helipadMesh);

    // Helipad Yellow Perimeter Ring
    const heliRingGeom = new THREE.RingGeometry(7.2, 7.8, 32);
    const heliRingMat = new THREE.MeshBasicMaterial({ color: 0xeab308, side: THREE.DoubleSide });
    const heliRingMesh = new THREE.Mesh(heliRingGeom, heliRingMat);
    heliRingMesh.rotation.x = Math.PI / 2;
    heliRingMesh.position.set(0, 2.8, 0);
    group.add(heliRingMesh);

    // Helipad "H" Crossbars
    const hBarGeom = new THREE.BoxGeometry(0.8, 0.1, 4.5);
    const hMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hBarLeft = new THREE.Mesh(hBarGeom, hMat);
    hBarLeft.position.set(-1.8, 2.82, 0);
    const hBarRight = new THREE.Mesh(hBarGeom, hMat);
    hBarRight.position.set(1.8, 2.82, 0);
    const hBarMid = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 0.8), hMat);
    hBarMid.position.set(0, 2.82, 0);
    group.add(hBarLeft);
    group.add(hBarRight);
    group.add(hBarMid);

    // 2. Command HQ Bunker Complex
    const bunkerGeom = new THREE.BoxGeometry(16, 5, 12);
    const bunkerMat = new THREE.MeshPhongMaterial({ color: 0x0f172a, flatShading: true });
    const bunkerMesh = new THREE.Mesh(bunkerGeom, bunkerMat);
    bunkerMesh.position.set(-18, 5, -8);
    group.add(bunkerMesh);

    // Bunker Roof Edge Light Strips (Emerald LED)
    const bunkerLightGeom = new THREE.BoxGeometry(16.2, 0.3, 0.3);
    const bunkerLightMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const bunkerLight = new THREE.Mesh(bunkerLightGeom, bunkerLightMat);
    bunkerLight.position.set(-18, 7.6, -2);
    group.add(bunkerLight);

    // 3. Communications Radar Tower
    const towerPillarGeom = new THREE.CylinderGeometry(0.6, 1.8, 22, 8);
    const towerMat = new THREE.MeshPhongMaterial({ color: 0x334155 });
    const towerPillar = new THREE.Mesh(towerPillarGeom, towerMat);
    towerPillar.position.set(16, 13, -12);
    group.add(towerPillar);

    // Rotating Radar Dish Group
    const radarDishGroup = new THREE.Group();
    radarDishGroup.position.set(16, 24, -12);

    const dishGeom = new THREE.SphereGeometry(3, 16, 16, 0, Math.PI);
    const dishMat = new THREE.MeshPhongMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const dishMesh = new THREE.Mesh(dishGeom, dishMat);
    dishMesh.rotation.x = Math.PI / 4;
    radarDishGroup.add(dishMesh);

    const hornGeom = new THREE.CylinderGeometry(0.1, 0.2, 2.5);
    const hornMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const hornMesh = new THREE.Mesh(hornGeom, hornMat);
    hornMesh.rotation.x = Math.PI / 4;
    hornMesh.position.z = 1.2;
    radarDishGroup.add(hornMesh);

    radarDishRef.current = radarDishGroup;
    group.add(radarDishGroup);
  };

  // BUILD 3D GLOBE WITH TACTICAL SATCOM, GRATICULE & CONTINENTAL THEATER
  const buildGlobe3D = (scene: THREE.Scene, style: RenderStyle3D, satellitesGroup: THREE.Group) => {
    const globeGroup = new THREE.Group();
    globeGroupRef.current = globeGroup;

    // 1. Earth Sphere with Procedural Tactical Canvas Texture
    const radius = 42;
    const geometry = new THREE.SphereGeometry(radius, 64, 64);
    const globeTexture = createTacticalGlobeTexture(style);

    const material = new THREE.MeshPhongMaterial({
      map: globeTexture,
      shininess: style === 'flir' ? 45 : 25,
      specular: style === 'nightvision' ? 0x065f46 : 0x0284c7
    });
    const globeMesh = new THREE.Mesh(geometry, material);
    globeGroup.add(globeMesh);

    // 2. Graticule Ring Geometry
    const gridGeom = new THREE.WireframeGeometry(new THREE.SphereGeometry(radius + 0.15, 24, 24));
    const gridMat = new THREE.LineBasicMaterial({ 
      color: style === 'nightvision' ? 0x10b981 : style === 'flir' ? 0xd946ef : 0x0ea5e9, 
      transparent: true, 
      opacity: 0.22 
    });
    const gridMesh = new THREE.LineSegments(gridGeom, gridMat);
    globeGroup.add(gridMesh);

    // 3. Atmosphere Scattering Glow Outer Shell
    const atmoGeom = new THREE.SphereGeometry(radius + 2.0, 32, 32);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: style === 'flir' ? 0xa855f7 : style === 'nightvision' ? 0x10b981 : 0x38bdf8,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide
    });
    const atmoMesh = new THREE.Mesh(atmoGeom, atmoMat);
    globeGroup.add(atmoMesh);

    // 4. Pin C4I Military Base on Globe (Coveñas: 9.4061° N, 75.6867° W)
    const latRad = (baseCenter[0] * Math.PI) / 180;
    const lngRad = (baseCenter[1] * Math.PI) / 180;

    const bx = radius * Math.cos(latRad) * Math.cos(lngRad);
    const by = radius * Math.sin(latRad);
    const bz = -radius * Math.cos(latRad) * Math.sin(lngRad);

    const basePinGeom = new THREE.SphereGeometry(1.4, 16, 16);
    const basePinMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const basePin = new THREE.Mesh(basePinGeom, basePinMat);
    basePin.position.set(bx, by, bz);
    globeGroup.add(basePin);

    // Base Pulsing Beacon
    const beaconRingGeom = new THREE.RingGeometry(1.6, 2.6, 24);
    const beaconRingMat = new THREE.MeshBasicMaterial({ color: 0x34d399, side: THREE.DoubleSide });
    const beaconRing = new THREE.Mesh(beaconRingGeom, beaconRingMat);
    beaconRing.position.set(bx, by, bz);
    beaconRing.lookAt(0, 0, 0);
    beaconRing.name = 'pulseRing';
    globeGroup.add(beaconRing);

    // 5. Arcs from Base to Active Operators around Globe
    soldiers.forEach(soldier => {
      if (!soldier || !soldier.location || typeof soldier.location.lat !== 'number' || typeof soldier.location.lng !== 'number') return;
      const sLatRad = (soldier.location.lat * Math.PI) / 180;
      const sLngRad = (soldier.location.lng * Math.PI) / 180;

      const sx = (radius + 0.6) * Math.cos(sLatRad) * Math.cos(sLngRad);
      const sy = (radius + 0.6) * Math.sin(sLatRad);
      const sz = -(radius + 0.6) * Math.cos(sLatRad) * Math.sin(sLngRad);

      const isSelected = soldier.id === selectedSoldierId;
      const pinColor = soldier.status === 'CRITICO' || soldier.vitals.heartRate > 150 
        ? 0xef4444 
        : soldier.status === 'ADVERTENCIA' 
        ? 0xf59e0b 
        : 0x10b981;

      const sPinGeom = new THREE.OctahedronGeometry(isSelected ? 1.8 : 1.2, 0);
      const sPinMat = new THREE.MeshPhongMaterial({ 
        color: pinColor, 
        emissive: pinColor, 
        emissiveIntensity: isSelected ? 0.9 : 0.45 
      });
      const sPin = new THREE.Mesh(sPinGeom, sPinMat);
      sPin.position.set(sx, sy, sz);
      sPin.userData = { soldierId: soldier.id, soldier };
      globeGroup.add(sPin);

      // Selected halo beacon on globe
      if (isSelected) {
        const sRingGeom = new THREE.RingGeometry(1.6, 2.2, 24);
        const sRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
        const sRing = new THREE.Mesh(sRingGeom, sRingMat);
        sRing.position.set(sx, sy, sz);
        sRing.lookAt(0, 0, 0);
        sRing.name = 'pulseRing';
        globeGroup.add(sRing);
      }

      // Orbital Beam Arc Curve
      const midPoint = new THREE.Vector3().addVectors(
        new THREE.Vector3(bx, by, bz), 
        new THREE.Vector3(sx, sy, sz)
      ).multiplyScalar(0.55);
      midPoint.setLength(radius + 7);

      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(bx, by, bz),
        midPoint,
        new THREE.Vector3(sx, sy, sz)
      );

      const curvePoints = curve.getPoints(24);
      const curveGeom = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const curveMat = new THREE.LineBasicMaterial({ 
        color: isSelected ? 0x38bdf8 : soldier.vitals.heartRate > 130 ? 0xf87171 : 0x10b981, 
        transparent: true, 
        opacity: isSelected ? 0.95 : 0.6 
      });
      const arcLine = new THREE.Line(curveGeom, curveMat);
      globeGroup.add(arcLine);
    });

    // 6. Military Geostationary Satellites (SATCOM-MIL-01 & SAR-RADAR-02)
    while (satellitesGroup.children.length > 0) {
      satellitesGroup.remove(satellitesGroup.children[0]);
    }

    if (showSatellites) {
      const satAngles = [0, Math.PI * 0.7, Math.PI * 1.4];
      satAngles.forEach((angle, idx) => {
        const satRadius = radius + 22;
        const satX = Math.cos(angle) * satRadius;
        const satZ = Math.sin(angle) * satRadius;
        const satY = Math.sin(angle * 2) * 8;

        const satGroup = new THREE.Group();
        satGroup.position.set(satX, satY, satZ);

        // Satellite Main Body
        const satBody = new THREE.Mesh(
          new THREE.BoxGeometry(1.8, 1.2, 1.2),
          new THREE.MeshPhongMaterial({ color: 0x94a3b8, shininess: 80 })
        );
        satGroup.add(satBody);

        // Solar Arrays
        const panelMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
        const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 1.0), panelMat);
        leftPanel.position.set(-2.8, 0, 0);
        const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 1.0), panelMat);
        rightPanel.position.set(2.8, 0, 0);
        satGroup.add(leftPanel);
        satGroup.add(rightPanel);

        // Satcom Downlink Beam to Base
        const satBeamGeom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(bx - satX, by - satY, bz - satZ)
        ]);
        const satBeam = new THREE.Line(satBeamGeom, new THREE.LineBasicMaterial({
          color: idx === 0 ? 0x10b981 : 0x0ea5e9,
          transparent: true,
          opacity: 0.35
        }));
        satGroup.add(satBeam);

        satellitesGroup.add(satGroup);
      });

      // Satellite Orbit Rings
      const orbitRingGeom = new THREE.RingGeometry(radius + 21.8, radius + 22.2, 64);
      const orbitRingMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.25
      });
      const orbitRing = new THREE.Mesh(orbitRingGeom, orbitRingMat);
      orbitRing.rotation.x = Math.PI / 2.3;
      satellitesGroup.add(orbitRing);
    }

    scene.add(globeGroup);
  };

  // UPDATE OPERATORS, ZONES, AND PATROLS IN 3D
  useEffect(() => {
    if (!sceneRef.current || !unitsGroupRef.current || !zonesGroupRef.current || !trailsGroupRef.current) return;

    // Clear dynamic groups
    while (unitsGroupRef.current.children.length > 0) {
      unitsGroupRef.current.remove(unitsGroupRef.current.children[0]);
    }
    while (zonesGroupRef.current.children.length > 0) {
      zonesGroupRef.current.remove(zonesGroupRef.current.children[0]);
    }
    while (trailsGroupRef.current.children.length > 0) {
      trailsGroupRef.current.remove(trailsGroupRef.current.children[0]);
    }

    if (mode3D === 'terrain') {
      // 1. SOLDIER 3D MARKERS WITH VISUAL LOS CONES & HEADINGS
      soldiers.forEach(soldier => {
        if (!soldier || !soldier.location || typeof soldier.location.lat !== 'number' || typeof soldier.location.lng !== 'number') return;
        const isSelected = soldier.id === selectedSoldierId;
        const x = (soldier.location.lng - baseCenter[1]) * 12000;
        const z = -(soldier.location.lat - baseCenter[0]) * 12000;
        const baseElevation = getElevation(soldier.location.lat, soldier.location.lng);
        const y = (soldier.location.altitude || baseElevation) * 0.15 * elevationScale + 1.2;

        const unitGroup = new THREE.Group();
        unitGroup.position.set(x, y, z);
        unitGroup.userData = { soldierId: soldier.id, soldier };

        // Color based on status & vitals
        let markerColor = 0x10b981; // Green
        if (soldier.status === 'CRITICO' || soldier.vitals.heartRate > 150 || soldier.vitals.batteryLevel < 15) {
          markerColor = 0xef4444; // Red
        } else if (soldier.status === 'ADVERTENCIA' || soldier.vitals.heartRate > 120) {
          markerColor = 0xf59e0b; // Amber
        }

        if (renderStyle === 'nightvision') markerColor = 0x22c55e;
        if (renderStyle === 'flir') markerColor = soldier.vitals.heartRate > 130 ? 0xff0055 : 0xffaa00;

        // Operator Tactical Diamond Avatar
        const geom = new THREE.OctahedronGeometry(isSelected ? 3.8 : 2.6, 0);
        const mat = new THREE.MeshPhongMaterial({ 
          color: markerColor, 
          emissive: markerColor, 
          emissiveIntensity: isSelected ? 0.9 : 0.45,
          flatShading: true 
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.y = 3;
        mesh.userData = { soldierId: soldier.id };
        unitGroup.add(mesh);

        // Directional Heading Indicator (Field of View 3D Cone)
        const headingRad = ((soldier.heading || 0) * Math.PI) / 180;
        const fovGeom = new THREE.ConeGeometry(2.5, 6, 16, 1, true);
        const fovMat = new THREE.MeshBasicMaterial({ 
          color: markerColor, 
          transparent: true, 
          opacity: isSelected ? 0.4 : 0.2,
          side: THREE.DoubleSide
        });
        const fovMesh = new THREE.Mesh(fovGeom, fovMat);
        fovMesh.rotation.x = Math.PI / 2;
        fovMesh.rotation.z = -headingRad;
        fovMesh.position.set(Math.sin(headingRad) * 4, 1.5, -Math.cos(headingRad) * 4);
        unitGroup.add(fovMesh);

        // Vertical Laser Beam to ground
        const beamGeom = new THREE.CylinderGeometry(0.12, 0.12, y + 3, 8);
        const beamMat = new THREE.MeshBasicMaterial({ color: markerColor, transparent: true, opacity: 0.5 });
        const beamMesh = new THREE.Mesh(beamGeom, beamMat);
        beamMesh.position.y = -y / 2 + 1.5;
        unitGroup.add(beamMesh);

        // Pulsing Ground Ring
        const ringGeom = new THREE.RingGeometry(3.2, 4.2, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: markerColor, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        ringMesh.position.y = -y + 0.3;
        ringMesh.name = 'pulseRing';
        unitGroup.add(ringMesh);

        // Threat proximity alert rings if near active threats
        const isNearThreat = (sharedMarkers || []).some(m => {
          if (!m || m.status !== 'active') return false;
          const isThreat = m.type === 'threat' || (m as any).type === 'THREAT';
          if (!isThreat) return false;
          const mLat = typeof m.lat === 'number' ? m.lat : (m as any).location?.lat;
          const mLng = typeof m.lng === 'number' ? m.lng : (m as any).location?.lng;
          if (typeof mLat !== 'number' || typeof mLng !== 'number') return false;
          const sLat = soldier.location?.lat;
          const sLng = soldier.location?.lng;
          if (typeof sLat !== 'number' || typeof sLng !== 'number') return false;
          const dLat = sLat - mLat;
          const dLng = sLng - mLng;
          const approxDistMeters = Math.sqrt(dLat * dLat + dLng * dLng) * 111000;
          return approxDistMeters <= 60;
        });

        if (isNearThreat) {
          [6, 12, 18].forEach((rScale, rIdx) => {
            const threatRingGeom = new THREE.RingGeometry(rScale, rScale + 0.8, 32);
            const threatRingMat = new THREE.MeshBasicMaterial({
              color: rIdx === 0 ? 0xef4444 : rIdx === 1 ? 0xf97316 : 0xeab308,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.8 - rIdx * 0.2,
            });
            const threatRingMesh = new THREE.Mesh(threatRingGeom, threatRingMat);
            threatRingMesh.rotation.x = Math.PI / 2;
            threatRingMesh.position.y = -y + 0.4 + rIdx * 0.1;
            threatRingMesh.name = 'pulseRing';
            unitGroup.add(threatRingMesh);
          });
        }

        unitsGroupRef.current?.add(unitGroup);

        // BREADCRUMB HISTORICAL TRAILS IN 3D
        if (showTrails3D && soldier.routeHistory && soldier.routeHistory.length > 1) {
          const points: THREE.Vector3[] = [];
          soldier.routeHistory.forEach(pt => {
            if (!pt || typeof pt.lat !== 'number' || typeof pt.lng !== 'number') return;
            const px = (pt.lng - baseCenter[1]) * 12000;
            const pz = -(pt.lat - baseCenter[0]) * 12000;
            const pe = getElevation(pt.lat, pt.lng);
            const py = (pt.altitude || pe) * 0.15 * elevationScale + 0.6;
            points.push(new THREE.Vector3(px, py, pz));
          });
          if (points.length > 1) {
            const pathGeom = new THREE.BufferGeometry().setFromPoints(points);
            const pathMat = new THREE.LineBasicMaterial({ 
              color: isSelected ? 0x38bdf8 : markerColor, 
              transparent: true,
              opacity: 0.65 
            });
            const pathLine = new THREE.Line(pathGeom, pathMat);
            trailsGroupRef.current?.add(pathLine);
          }
        }
      });

      // 2. EXTRUDED 3D SECURITY ZONES WITH HOLOGRAPHIC FORCEFIELDS
      if (showZones3D) {
        zones.forEach(zone => {
          if (!zone.coordinates || zone.coordinates.length < 3) return;

          const shape = new THREE.Shape();
          zone.coordinates.forEach((coord, idx) => {
            const x = (coord[1] - baseCenter[1]) * 12000;
            const z = -(coord[0] - baseCenter[0]) * 12000;
            if (idx === 0) shape.moveTo(x, z);
            else shape.lineTo(x, z);
          });

          const extrudeHeight = 18 * elevationScale;
          const extrudeSettings = { depth: extrudeHeight, bevelEnabled: false };
          const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          geom.rotateX(Math.PI / 2); // Orient flat to ground

          const colorHex = parseInt(zone.color.replace('#', '0x')) || 0x10b981;
          const mat = new THREE.MeshBasicMaterial({ 
            color: colorHex, 
            transparent: true, 
            opacity: zone.fillOpacity || 0.22, 
            wireframe: false,
            side: THREE.DoubleSide
          });
          const zoneMesh = new THREE.Mesh(geom, mat);
          zoneMesh.position.y = 2;

          // Wireframe grid lines on zone walls
          const wireGeom = new THREE.WireframeGeometry(geom);
          const wireMat = new THREE.LineBasicMaterial({ color: colorHex, opacity: 0.85, transparent: true });
          const wireOutline = new THREE.LineSegments(wireGeom, wireMat);
          zoneMesh.add(wireOutline);

          zonesGroupRef.current?.add(zoneMesh);
        });
      }

      // 3. 3D PATROL ROUTES DRAPED OVER TERRAIN
      if (showTrails3D && patrols && patrols.length > 0) {
        patrols.forEach(patrol => {
          if (!patrol.routeWaypoints || patrol.routeWaypoints.length < 2) return;

          const points: THREE.Vector3[] = [];
          patrol.routeWaypoints.forEach((wp, wIdx) => {
            if (!wp) return;
            // wp can be [lat, lng] tuple or {lat, lng} object
            const lat = Array.isArray(wp) ? wp[0] : (wp as any).lat;
            const lng = Array.isArray(wp) ? wp[1] : (wp as any).lng;
            if (typeof lat !== 'number' || typeof lng !== 'number') return;

            const wx = (lng - baseCenter[1]) * 12000;
            const wz = -(lat - baseCenter[0]) * 12000;
            const we = getElevation(lat, lng);
            const wy = we * 0.15 * elevationScale + 1.0;
            points.push(new THREE.Vector3(wx, wy, wz));

            // Waypoint Beacon Marker in 3D
            const wpGeom = new THREE.CylinderGeometry(0.8, 0.8, 1.5, 16);
            const patrolColor = (patrol as any).color ? parseInt((patrol as any).color.replace('#', '0x')) : 0x06b6d4;
            const wpMat = new THREE.MeshPhongMaterial({
              color: patrolColor,
              emissive: 0x06b6d4,
              emissiveIntensity: 0.6
            });
            const wpMesh = new THREE.Mesh(wpGeom, wpMat);
            wpMesh.position.set(wx, wy + 1.2, wz);
            trailsGroupRef.current?.add(wpMesh);
          });

          // Connect waypoints with 3D Polyline
          if (points.length >= 2) {
            const patrolGeom = new THREE.BufferGeometry().setFromPoints(points);
            const patrolColor = (patrol as any).color ? parseInt((patrol as any).color.replace('#', '0x')) : 0x06b6d4;
            const patrolLine = new THREE.Line(
              patrolGeom, 
              new THREE.LineBasicMaterial({ color: patrolColor, linewidth: 2, transparent: true, opacity: 0.85 })
            );
            trailsGroupRef.current?.add(patrolLine);
          }
        });
      }

      // 4. SHARED TACTICAL MARKERS (Threats & Checkpoints)
      (sharedMarkers || []).forEach(marker => {
        if (!marker) return;
        const lat = typeof marker.lat === 'number' ? marker.lat : (marker as any).location?.lat;
        const lng = typeof marker.lng === 'number' ? marker.lng : (marker as any).location?.lng;
        if (typeof lat !== 'number' || typeof lng !== 'number') return;

        const x = (lng - baseCenter[1]) * 12000;
        const z = -(lat - baseCenter[0]) * 12000;
        const e = getElevation(lat, lng);
        const y = e * 0.15 * elevationScale + 3.5;

        const isThreat = marker.type === 'threat' || (marker as any).type === 'THREAT';
        const threatGeom = new THREE.ConeGeometry(3.2, 7, 4);
        const threatMat = new THREE.MeshBasicMaterial({ color: isThreat ? 0xef4444 : 0x3b82f6 });
        const threatMesh = new THREE.Mesh(threatGeom, threatMat);
        threatMesh.rotation.x = Math.PI;
        threatMesh.position.set(x, y + 5, z);

        unitsGroupRef.current?.add(threatMesh);
      });
    }
  }, [soldiers, zones, patrols, selectedSoldierId, mode3D, renderStyle, elevationScale, showZones3D, showTrails3D, sharedMarkers, baseCenter, getElevation]);

  // MOUSE, TOUCH & CAMERA ORBITING DRAG CONTROLS WITH INERTIA
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    dragVelocityRef.current = { x: 0, y: 0 };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // 1. Raycasting for hover tooltip over units in terrain or globe
    if (containerRef.current && cameraRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      mousePosRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mousePosRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mousePosRef.current, cameraRef.current);
      
      const searchTargets = mode3D === 'terrain'
        ? (unitsGroupRef.current?.children || [])
        : (globeGroupRef.current?.children || []);

      const intersects = raycasterRef.current.intersectObjects(searchTargets, true);

      if (intersects.length > 0) {
        let parent = intersects[0].object as THREE.Object3D | null;
        let foundSoldier: Soldier | null = null;
        while (parent) {
          if (parent.userData?.soldier) {
            foundSoldier = parent.userData.soldier;
            break;
          }
          parent = parent.parent;
        }
        setHoveredSoldier(foundSoldier);
      } else {
        setHoveredSoldier(null);
      }
    }

    // 2. Camera Drag Orbit with Velocity Tracking
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - previousMousePositionRef.current.x;
    const deltaY = e.clientY - previousMousePositionRef.current.y;

    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };

    // Record instantaneous velocity for smooth release inertia
    const vx = -deltaX * 0.0055;
    const vy = -deltaY * 0.0055;
    dragVelocityRef.current = { x: vx, y: vy };

    targetAngleRef.current.theta += vx;
    targetAngleRef.current.phi = Math.max(
      0.08, 
      Math.min(Math.PI / 2 - 0.04, targetAngleRef.current.phi + vy)
    );
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // Determine if this was a click rather than a pan/drag
    const distSq = Math.hypot(e.clientX - dragStartPosRef.current.x, e.clientY - dragStartPosRef.current.y);

    if (distSq < 6 && containerRef.current && cameraRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(new THREE.Vector2(mouseX, mouseY), cameraRef.current);
      
      const searchTargets = mode3D === 'terrain'
        ? (unitsGroupRef.current?.children || [])
        : (globeGroupRef.current?.children || []);

      const intersects = raycasterRef.current.intersectObjects(searchTargets, true);

      if (intersects.length > 0) {
        let parent = intersects[0].object as THREE.Object3D | null;
        while (parent && !parent.userData?.soldierId) {
          parent = parent.parent;
        }
        if (parent && parent.userData?.soldierId) {
          onSelectSoldier(parent.userData.soldierId);
        }
      }
    }
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY * 0.14;
    const minR = mode3D === 'globe' ? 52 : 20;
    const maxR = mode3D === 'globe' ? 240 : 360;
    targetAngleRef.current.radius = Math.max(minR, Math.min(maxR, targetAngleRef.current.radius + delta));
  };

  // Touch handlers for tablets and mobile devices
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      const touch = e.touches[0];
      dragStartPosRef.current = { x: touch.clientX, y: touch.clientY };
      previousMousePositionRef.current = { x: touch.clientX, y: touch.clientY };
      dragVelocityRef.current = { x: 0, y: 0 };
      touchStartDistRef.current = null;
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDistRef.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - previousMousePositionRef.current.x;
      const deltaY = touch.clientY - previousMousePositionRef.current.y;
      previousMousePositionRef.current = { x: touch.clientX, y: touch.clientY };

      const vx = -deltaX * 0.006;
      const vy = -deltaY * 0.006;
      dragVelocityRef.current = { x: vx, y: vy };

      targetAngleRef.current.theta += vx;
      targetAngleRef.current.phi = Math.max(
        0.08,
        Math.min(Math.PI / 2 - 0.04, targetAngleRef.current.phi + vy)
      );
    } else if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const curDist = Math.hypot(dx, dy);
      const diff = touchStartDistRef.current - curDist;
      touchStartDistRef.current = curDist;

      const minR = mode3D === 'globe' ? 52 : 20;
      const maxR = mode3D === 'globe' ? 240 : 360;
      targetAngleRef.current.radius = Math.max(minR, Math.min(maxR, targetAngleRef.current.radius + diff * 0.4));
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    touchStartDistRef.current = null;
  };

  // Reset Camera View Angles with Smooth Transition
  const setCameraPreset = (preset: 'perspective' | 'top' | 'close' | 'cinematic') => {
    setCameraView(preset);
    setIsFollowOperator(false);

    if (preset === 'top') {
      targetAngleRef.current.theta = 0;
      targetAngleRef.current.phi = 0.08;
      targetAngleRef.current.radius = mode3D === 'globe' ? 120 : 170;
      targetAngleRef.current.target.set(0, 0, 0);
    } else if (preset === 'close') {
      targetAngleRef.current.theta = Math.PI / 4;
      targetAngleRef.current.phi = Math.PI / 3.8;
      targetAngleRef.current.radius = mode3D === 'globe' ? 62 : 48;
      targetAngleRef.current.target.set(0, mode3D === 'globe' ? 0 : 4, 0);
    } else if (preset === 'cinematic') {
      targetAngleRef.current.theta = Math.PI / 6;
      targetAngleRef.current.phi = Math.PI / 2.3;
      targetAngleRef.current.radius = mode3D === 'globe' ? 88 : 85;
      targetAngleRef.current.target.set(0, mode3D === 'globe' ? 0 : 8, 0);
    } else {
      targetAngleRef.current.theta = Math.PI / 4;
      targetAngleRef.current.phi = Math.PI / 3.2;
      targetAngleRef.current.radius = mode3D === 'globe' ? 95 : 130;
      targetAngleRef.current.target.set(0, 0, 0);
    }
  };

  // Center on Selected Operator
  const handleFocusSelectedSoldier = () => {
    if (!selectedSoldier || !selectedSoldier.location || typeof selectedSoldier.location.lat !== 'number' || typeof selectedSoldier.location.lng !== 'number') return;
    
    if (mode3D === 'terrain') {
      const targetX = (selectedSoldier.location.lng - baseCenter[1]) * 12000;
      const targetZ = -(selectedSoldier.location.lat - baseCenter[0]) * 12000;
      const targetY = (selectedSoldier.location.altitude || getElevation(selectedSoldier.location.lat, selectedSoldier.location.lng)) * 0.15 * elevationScale;

      targetAngleRef.current.target.set(targetX, targetY, targetZ);
      targetAngleRef.current.radius = 42;
      targetAngleRef.current.phi = Math.PI / 3.6;
    } else {
      // Focus on Globe coordinates
      const sLatRad = (selectedSoldier.location.lat * Math.PI) / 180;
      const sLngRad = (selectedSoldier.location.lng * Math.PI) / 180;
      targetAngleRef.current.theta = -sLngRad + Math.PI / 2;
      targetAngleRef.current.phi = Math.PI / 2 - sLatRad;
      targetAngleRef.current.radius = 65;
      targetAngleRef.current.target.set(0, 0, 0);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[580px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col select-none">
      
      {/* TOP FLOATING HUD TOOLBAR */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl backdrop-blur-md shadow-lg text-slate-200">
        
        {/* Left: 3D Mode Selector & Style */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              id="btn-3d-terrain-mode"
              onClick={() => {
                setMode3D('terrain');
                setCameraPreset('perspective');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                mode3D === 'terrain'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mountain className="w-3.5 h-3.5" />
              Terreno 3D (Coveñas AO)
            </button>
            <button
              id="btn-3d-globe-mode"
              onClick={() => {
                setMode3D('globe');
                setCameraPreset('perspective');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                mode3D === 'globe'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Globo C4I 3D (Global)
            </button>
          </div>

          {/* Render Style */}
          {mode3D === 'terrain' && (
            <div className="hidden sm:flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setRenderStyle('topo')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md ${
                  renderStyle === 'topo' ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Topográfico
              </button>
              <button
                onClick={() => setRenderStyle('flir')}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md ${
                  renderStyle === 'flir' ? 'bg-purple-950 text-purple-300 border border-purple-500/50 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Flame className="w-3 h-3 text-purple-400" />
                FLIR Térmico
              </button>
              <button
                onClick={() => setRenderStyle('nightvision')}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md ${
                  renderStyle === 'nightvision' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Tv className="w-3 h-3 text-emerald-400" />
                Visor Nocturno
              </button>
              <button
                onClick={() => setRenderStyle('wireframe')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md ${
                  renderStyle === 'wireframe' ? 'bg-slate-800 text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Malla Matrix
              </button>
            </div>
          )}

        </div>

        {/* Right: Camera Angle & Terrain Adjustment Sliders */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Camera Angles */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setCameraPreset('perspective')}
              className={`p-1.5 rounded-md text-xs font-medium ${
                cameraView === 'perspective' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vista Perspectiva Táctica"
            >
              <Compass className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCameraPreset('top')}
              className={`p-1.5 rounded-md text-xs font-medium ${
                cameraView === 'top' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vista Cenital (Top-Down Recon)"
            >
              <Navigation className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCameraPreset('close')}
              className={`p-1.5 rounded-md text-xs font-medium ${
                cameraView === 'close' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vista Rasante (Close-up)"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCameraPreset('cinematic')}
              className={`p-1.5 rounded-md text-xs font-medium ${
                cameraView === 'cinematic' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vista Panorámica Cinemática"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Follow Operator Switch */}
          {mode3D === 'terrain' && selectedSoldier && (
            <button
              id="btn-3d-follow-operator"
              onClick={() => {
                const next = !isFollowOperator;
                setIsFollowOperator(next);
                if (next) handleFocusSelectedSoldier();
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isFollowOperator
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md font-bold'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white'
              }`}
              title="Bloquear cámara y seguir operador en 3D"
            >
              <LocateFixed className={`w-3.5 h-3.5 ${isFollowOperator ? 'animate-spin' : ''}`} />
              <span>Seguir: {selectedSoldier.callsign}</span>
            </button>
          )}

          {/* Elevation Scale Slider */}
          {mode3D === 'terrain' && (
            <div className="hidden lg:flex items-center gap-2 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 font-mono">Relieve:</span>
              <input
                type="range"
                min="0.5"
                max="4"
                step="0.2"
                value={elevationScale}
                onChange={(e) => setElevationScale(parseFloat(e.target.value))}
                className="w-16 accent-emerald-500 cursor-pointer"
              />
              <span className="text-[11px] font-bold text-emerald-400 font-mono">{elevationScale}x</span>
            </div>
          )}

          {/* Time of Day Lighting Toggle */}
          {mode3D === 'terrain' && (
            <button
              onClick={() => {
                if (timeOfDay === 'noon') setTimeOfDay('dusk');
                else if (timeOfDay === 'dusk') setTimeOfDay('night');
                else setTimeOfDay('noon');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 hover:text-white"
              title="Cambiar iluminación solar"
            >
              {timeOfDay === 'noon' && <Sun className="w-3.5 h-3.5 text-amber-400" />}
              {timeOfDay === 'dusk' && <Sun className="w-3.5 h-3.5 text-orange-400" />}
              {timeOfDay === 'night' && <Moon className="w-3.5 h-3.5 text-indigo-400" />}
              <span className="capitalize hidden sm:inline">{timeOfDay}</span>
            </button>
          )}

        </div>

      </div>

      {/* THREE.JS CANVAS CONTAINER */}
      <div 
        ref={containerRef} 
        className="w-full h-full flex-1 cursor-grab active:cursor-grabbing relative touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* TACTICAL HUD RETICLE & COMPASS ROSE (Senior Military WebGL HUD) */}
      <div className="absolute top-20 right-4 z-20 pointer-events-none flex flex-col items-end gap-2">
        {/* Compass Rosette */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/85 border border-slate-800 rounded-lg backdrop-blur-md shadow-lg font-mono text-xs text-slate-300">
          <Compass 
            className="w-4 h-4 text-emerald-400 transition-transform duration-100 ease-out" 
            style={{ transform: `rotate(${-compassHeading}deg)` }} 
          />
          <span className="font-bold text-emerald-400 tabular-nums">
            {String(compassHeading).padStart(3, '0')}°
          </span>
          <span className="text-[10px] text-slate-500 font-semibold">
            {compassHeading >= 337 || compassHeading < 23 ? 'N' :
             compassHeading >= 23 && compassHeading < 68 ? 'NE' :
             compassHeading >= 68 && compassHeading < 113 ? 'E' :
             compassHeading >= 113 && compassHeading < 158 ? 'SE' :
             compassHeading >= 158 && compassHeading < 203 ? 'S' :
             compassHeading >= 203 && compassHeading < 248 ? 'SW' :
             compassHeading >= 248 && compassHeading < 293 ? 'W' : 'NW'}
          </span>
        </div>

        {/* Tactical AO Coordinates Box */}
        <div className="hidden sm:flex flex-col items-end px-2.5 py-1.5 bg-slate-950/75 border border-slate-800/80 rounded-md backdrop-blur-sm text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="text-emerald-500">BASE:</span>
            <span>{baseCenter[0].toFixed(4)}°N, {Math.abs(baseCenter[1]).toFixed(4)}°W</span>
          </div>
          <div className="text-[9px] text-slate-500">
            {mode3D === 'terrain' ? 'GOLFO DE MORROSQUILLO · AO COVEÑAS' : 'SATCOM GLOBAL C4I · ORBITA LEO'}
          </div>
        </div>
      </div>

      {/* SUBTLE CENTER TARGET RETICLE */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-20">
        <div className="w-10 h-10 border border-emerald-400/50 rounded-full flex items-center justify-center">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
        </div>
      </div>

      {/* HOVER TOOLTIP OVER OPERATOR IN 3D */}
      {hoveredSoldier && (
        <div className="absolute top-20 left-6 z-30 pointer-events-none bg-slate-900/95 border border-emerald-500/70 p-3 rounded-xl shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{hoveredSoldier.rank} {hoveredSoldier.name}</span>
            <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] px-1.5 py-0.5 rounded font-mono">
              {hoveredSoldier.callsign}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-slate-300 mt-2">
            <div>Ritmo: <span className="text-rose-400 font-bold tabular-nums">{hoveredSoldier.vitals.heartRate} BPM</span></div>
            <div>Batería: <span className="text-emerald-400 font-bold tabular-nums">{hoveredSoldier.vitals.batteryLevel}%</span></div>
            <div>Altitud: <span className="text-sky-400 font-bold tabular-nums">{hoveredSoldier.location?.altitude ?? 0}m</span></div>
            <div>Estado: <span className="text-amber-400 font-bold">{hoveredSoldier.status}</span></div>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-1 border-t border-slate-800 pt-1">
            Haz clic para enfocar este operador
          </div>
        </div>
      )}

      {/* BOTTOM FLOATING HUD INFOBAR */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/90 border border-slate-800 rounded-xl backdrop-blur-md shadow-xl text-slate-200">
        
        {/* Left: Quick Feature Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {mode3D === 'terrain' && (
            <>
              <button
                onClick={() => setShowZones3D(!showZones3D)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                  showZones3D 
                    ? 'bg-emerald-950 border-emerald-500/50 text-emerald-400' 
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
              >
                Muros 3D Zonas
              </button>
              <button
                onClick={() => setShowTrails3D(!showTrails3D)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                  showTrails3D 
                    ? 'bg-sky-950 border-sky-500/50 text-sky-400' 
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
              >
                Rutas de Patrulla 3D
              </button>
              <button
                onClick={() => setShowWireframe(!showWireframe)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                  showWireframe 
                    ? 'bg-amber-950 border-amber-500/50 text-amber-400' 
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
              >
                Curvas de Nivel
              </button>
              <button
                onClick={() => setShowBaseStructures(!showBaseStructures)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                  showBaseStructures 
                    ? 'bg-indigo-950 border-indigo-500/50 text-indigo-400' 
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
              >
                <Building2 className="w-3 h-3" />
                Base C4I & Helipuerto
              </button>
            </>
          )}

          {mode3D === 'globe' && (
            <>
              <button
                onClick={() => setShowSatellites(!showSatellites)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border transition-all ${
                  showSatellites 
                    ? 'bg-sky-950 border-sky-500/50 text-sky-400' 
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
              >
                <Satellite className="w-3.5 h-3.5" />
                Satélites Militares Orbitales
              </button>
            </>
          )}

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all ${
              autoRotate 
                ? 'bg-emerald-950 border-emerald-500/50 text-emerald-400' 
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            {autoRotate ? 'Auto-Rotación [ACTIVA]' : 'Auto-Rotación [PAUSA]'}
          </button>
        </div>

        {/* Selected Operator Tactical Card in 3D */}
        {selectedSoldier && (
          <div className="flex items-center gap-3 bg-slate-950/90 border border-emerald-500/40 px-3 py-1.5 rounded-lg shadow-inner">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>{selectedSoldier.rank} {selectedSoldier.name}</span>
                <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950 border border-emerald-800 px-1.5 rounded">
                  {selectedSoldier.callsign}
                </span>
                <button
                  onClick={handleFocusSelectedSoldier}
                  className="ml-1 text-[10px] px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded font-bold cursor-pointer"
                  title="Enfocar cámara 3D sobre este operador"
                >
                  Centrar 3D
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400 mt-0.5">
                <span className="flex items-center gap-1 text-rose-400">
                  <Heart className="w-3 h-3 inline" /> <span className="tabular-nums">{selectedSoldier.vitals.heartRate}</span> BPM
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <Battery className="w-3 h-3 inline" /> <span className="tabular-nums">{selectedSoldier.vitals.batteryLevel}</span>%
                </span>
                {selectedSoldier.location && typeof selectedSoldier.location.altitude === 'number' && (
                  <span className="text-sky-400">
                    Alt: <span className="tabular-nums">{selectedSoldier.location.altitude}</span>m
                  </span>
                )}
                {selectedSoldier.location && typeof selectedSoldier.location.lat === 'number' && typeof selectedSoldier.location.lng === 'number' && (
                  <span className="text-slate-300">
                    MGRS: {latLngToMGRS(selectedSoldier.location.lat, selectedSoldier.location.lng)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Interactive Guidance Tip & Performance stats */}
        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-3">
          <span className="text-emerald-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800 tabular-nums">
            {fps} FPS
          </span>
          <div className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Arrastra para rotar · Scroll/Pinch para zoom · Clic sobre operador para enfocar</span>
          </div>
        </div>

      </div>

    </div>
  );
};
