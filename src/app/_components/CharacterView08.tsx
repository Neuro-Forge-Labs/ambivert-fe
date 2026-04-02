"use client";

import { OrbitControls, PerspectiveCamera, Environment, Grid, ContactShadows } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useState, useRef, useCallback } from "react";
import * as THREE from "three";

// --- Type Definitions ---
interface Measurements {
  stature: number; // cm
  weight: number;  // kg
  chest: number;   // cm
  waist: number;   // cm
  hips: number;    // cm
  inseam: number;  // cm
  exercise: number; // hrs/week
}

interface BasisData {
  mean: number[][];
  faces: number[][];
  diffs: {
    stature: number[][];
    weight: number[][];
    chest: number[][];
    waist: number[][];
    hips: number[][];
    inseam: number[][];
    exercise: number[][];
  };
}

interface GenderConfig {
  label: string;
  folder: string;
  means: {
    waist: number;
    chest: number;
    hips: number;
    stature: number;
    weightRoot: number;
    weightKg: number;
    inseam: number;
    fitness: number;
  };
}

const GENDER_CONFIGS: Record<'male' | 'female', GenderConfig> = {
  male: {
    label: "Male Unit",
    folder: "male",
    means: {
      waist: 894.4,
      chest: 1021.9,
      hips: 1029.5,
      stature: 1774.2,
      weightRoot: 4.350045,
      weightKg: Math.pow(4.350045, 3), // ~82.32
      inseam: 796.15,
      fitness: 4.559
    }
  },
  female: {
    label: "Female Unit",
    folder: "female",
    means: {
      waist: 756.4,
      chest: 928.5,
      hips: 1023.1,
      stature: 1642.3,
      weightRoot: 3.997508,
      weightKg: Math.pow(3.997508, 3), // ~63.88
      inseam: 755.15,
      fitness: 4.012
    }
  }
};

// --- Loading Component ---
function Loader({ progress }: { progress: string }) {
  return (
    <div className="flex items-center justify-center h-full bg-[#0a0a0a] z-50">
      <div className="flex flex-col items-center gap-6">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 border-[1px] border-blue-500/10 rounded-full"></div>
          <div className="absolute inset-0 border-t-[1px] border-blue-500 rounded-full animate-spin"></div>
          <div className="absolute inset-4 border-[1px] border-blue-500/5 rounded-full animate-pulse"></div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-white/40 text-[9px] font-black uppercase tracking-[0.4em] mb-1">Synthesizing Asset</div>
          <div className="text-neutral-600 text-[10px] font-mono uppercase tracking-widest">{progress}</div>
        </div>
      </div>
    </div>
  );
}

// --- 3D Deformation Engine ---
function DeformedMesh({
  basis,
  measurements,
  gender,
  wireframe
}: {
  basis: BasisData,
  measurements: Measurements,
  gender: 'male' | 'female',
  wireframe: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const config = GENDER_CONFIGS[gender];

  // Calculate weights for each basis using normalized SMPL stepping (per 5mm / 5kg)
  const weights = useMemo(() => {
    const m = measurements;
    const g = config.means;

    // Weight is non-linear (cube root space)
    const targetRoot = Math.pow(m.weight, 1 / 3);
    const weightStep = Math.pow(g.weightKg + 5, 1 / 3) - g.weightRoot;

    return {
      stature: (m.stature * 10 - g.stature) / 5,
      weight: (targetRoot - g.weightRoot) / weightStep,
      chest: (m.chest * 10 - g.chest) / 5,
      waist: (m.waist * 10 - g.waist) / 5,
      hips: (m.hips * 10 - g.hips) / 5,
      inseam: (m.inseam * 10 - g.inseam) / 5,
      exercise: (m.exercise - g.fitness) / 5, // already in hours
    };
  }, [measurements, config]);

  // Compute final vertices based on linear combination of diffs
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertexCount = basis.mean.length;
    const positions = new Float32Array(vertexCount * 3);

    for (let i = 0; i < vertexCount; i++) {
      const m = basis.mean[i];
      const dS = basis.diffs.stature[i];
      const dW = basis.diffs.weight[i];
      const dC = basis.diffs.chest[i];
      const dWa = basis.diffs.waist[i];
      const dH = basis.diffs.hips[i];
      const dI = basis.diffs.inseam[i];
      const dE = basis.diffs.exercise[i];

      // P = Mean + Sum(weight_i * Basis_i)
      positions[i * 3 + 0] = m[0] + (weights.stature * dS[0]) + (weights.weight * dW[0]) + (weights.chest * dC[0]) + (weights.waist * dWa[0]) + (weights.hips * dH[0]) + (weights.inseam * dI[0]) + (weights.exercise * dE[0]);
      positions[i * 3 + 1] = m[1] + (weights.stature * dS[1]) + (weights.weight * dW[1]) + (weights.chest * dC[1]) + (weights.waist * dWa[1]) + (weights.hips * dH[1]) + (weights.inseam * dI[1]) + (weights.exercise * dE[1]);
      positions[i * 3 + 2] = m[2] + (weights.stature * dS[2]) + (weights.weight * dW[2]) + (weights.chest * dC[2]) + (weights.waist * dWa[2]) + (weights.hips * dH[2]) + (weights.inseam * dI[2]) + (weights.exercise * dE[2]);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(basis.faces.flat()), 1));
    geo.computeVertexNormals();
    return geo;
  }, [basis, weights]);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.15) * 0.05;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#81a1c1"
        roughness={0.4}
        metalness={0.25}
        wireframe={wireframe}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// --- Main Application Component ---
export default function CharacterView08() {
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [basis, setBasis] = useState<BasisData | null>(null);
  const [measurements, setMeasurements] = useState<Measurements>({
    stature: 177,
    weight: 82,
    chest: 102,
    waist: 89,
    hips: 103,
    inseam: 80,
    exercise: 4,
  });
  const [units, setUnits] = useState<'metric' | 'imperial'>('imperial');
  const [wireframe, setWireframe] = useState(false);
  const [loadingStep, setLoadingStep] = useState("Initializing Engine...");
  const [error, setError] = useState<string | null>(null);

  // Helper to load and parse a basis script
  const fetchBasis = useCallback(async (url: string, varName: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    const text = await res.text();

    const context = {
      model_loader: { create_mesh: () => null },
      name: "",
      mean_vertices: [],
      mean_faces: [],
      stature_plus_5mm_vertices: [],
      weight_cube_root_plus_5kg_vertices: [],
      chest_circumference_plus_5mm_vertices: [],
      waist_circumference_pref_plus_5mm_vertices: [],
      hip_circumference_maximum_plus_5mm_vertices: [],
      inseam_right_plus_5mm_vertices: [],
      fitness_plus_5hours_vertices: [],
    };

    try {
      const suite = new Function(...Object.keys(context), `
        ${text};
        return ${varName};
      `);
      return suite(...Object.values(context)) as number[][];
    } catch (e) {
      console.error(`Error parsing ${varName} from ${url}:`, e);
      throw e;
    }
  }, []);

  useEffect(() => {
    const config = GENDER_CONFIGS[gender];
    const root = `/script/${config.folder}`;

    const loadAll = async () => {
      setBasis(null);
      setError(null);
      try {
        setLoadingStep("Mean Topology");
        const mean = await fetchBasis(`${root}/mean.js`, 'mean_vertices');

        const resMean = await fetch(`${root}/mean.js`);
        const textMean = await resMean.text();
        const faces = new Function('mean_faces', 'model_loader', 'mean_vertices', 'name', `
          ${textMean};
          return mean_faces;
        `)([], { create_mesh: () => null }, [], "") as number[][];

        const loadDiff = async (filename: string, varName: string, label: string) => {
          setLoadingStep(label);
          const b = await fetchBasis(`${root}/${filename}.js`, varName);
          return b.map((v, i) => [v[0] - mean[i][0], v[1] - mean[i][1], v[2] - mean[i][2]]);
        };

        const diffs = {
          stature: await loadDiff('stature_plus_5mm', 'stature_plus_5mm_vertices', 'Stature Basis'),
          weight: await loadDiff('weight_cube_root_plus_5kg', 'weight_cube_root_plus_5kg_vertices', 'Mass Basis'),
          chest: await loadDiff('chest_circumference_plus_5mm', 'chest_circumference_plus_5mm_vertices', 'Chest Basis'),
          waist: await loadDiff('waist_circumference_pref_plus_5mm', 'waist_circumference_pref_plus_5mm_vertices', 'Waist Basis'),
          hips: await loadDiff('hip_circumference_maximum_plus_5mm', 'hip_circumference_maximum_plus_5mm_vertices', 'Hips Basis'),
          inseam: await loadDiff('inseam_right_plus_5mm', 'inseam_right_plus_5mm_vertices', 'Inseam Basis'),
          exercise: await loadDiff('fitness_plus_5hours', 'fitness_plus_5hours_vertices', 'Fitness Basis'),
        };

        setBasis({ mean, faces, diffs });
      } catch (err) {
        console.error("Initialization Failed:", err);
        setError("Failed to load geometry engine. Please verify script availability.");
      }
    };
    loadAll();
  }, [gender, fetchBasis]);

  const handleUpdate = (key: keyof Measurements, val: number) => {
    setMeasurements(prev => ({ ...prev, [key]: val }));
  };

  const resetAll = () => {
    const config = GENDER_CONFIGS[gender].means;
    setMeasurements({
      stature: Math.round(config.stature / 10),
      weight: Math.round(config.weightKg),
      chest: Math.round(config.chest / 10),
      waist: Math.round(config.waist / 10),
      hips: Math.round(config.hips / 10),
      inseam: Math.round(config.inseam / 10),
      exercise: Math.round(config.fitness),
    });
  };

  // BMI Calculation
  const bmi = useMemo(() => {
    const hMeter = measurements.stature / 100;
    return measurements.weight / (hMeter * hMeter);
  }, [measurements]);

  const bmiStatus = useMemo(() => {
    if (bmi < 18.5) return { label: "Underweight", color: "#60a5fa" };
    if (bmi < 25) return { label: "Standard", color: "#10b981" };
    if (bmi < 30) return { label: "Overweight", color: "#fbbf24" };
    return { label: "Obese", color: "#ef4444" };
  }, [bmi]);

  // Conversion for display
  const toDisplay = (val: number, type: 'cm' | 'kg' | 'hr') => {
    if (units === 'metric') return { val: val.toFixed(type === 'hr' ? 0 : 1), unit: type };
    if (type === 'cm') return { val: (val / 2.54).toFixed(0), unit: 'in' };
    if (type === 'kg') return { val: (val * 2.20462).toFixed(0), unit: 'lb' };
    return { val, unit: type };
  };

  if (error) return (
    <div className="flex-1 flex items-center justify-center bg-[#0a0a0a] text-red-500 p-10 text-center font-medium">
      <div className="max-w-md bg-red-500/10 border border-red-500/20 p-8 rounded-3xl">
        <div className="text-4xl mb-4">⚠️</div>
        <div className="text-white font-bold text-lg mb-2">Engine Fault</div>
        <p className="text-neutral-500 text-sm">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-white text-black rounded-full font-bold text-xs uppercase tracking-widest hover:bg-neutral-200 transition-colors">Restart Engine</button>
      </div>
    </div>
  );

  if (!basis) return <Loader progress={loadingStep} />;

  return (
    <div className="flex-1 flex h-screen bg-[#070707] overflow-hidden font-sans">

      {/* 3D Viewer Area (Left, 60-70%) */}
      <div className="flex-[3] relative overflow-hidden">
        {/* Branding Overlay */}
        <div className="absolute top-10 left-10 z-10 pointer-events-none">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-[2px] bg-blue-500"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500/80">Biological Asset</span>
          </div>
          <h1 className="text-white text-5xl font-black italic tracking-tighter uppercase leading-[0.8]">
            CORE <span className="text-neutral-400">06</span>
          </h1>
          <p className="text-neutral-600 text-[10px] font-mono mt-3 ml-1 uppercase tracking-widest">Procedural Humanoid Synthesizer</p>
        </div>

        {/* Legend Overlay */}
        <div className="absolute bottom-10 left-10 z-10 pointer-events-none flex items-end gap-12">
          <div className="flex flex-col gap-1">
            <span className="text-neutral-700 text-[8px] font-mono uppercase tracking-widest">Mesh Stability</span>
            <div className="flex gap-0.5">
              {[1, 1, 1, 1, 1, 1, 1, 0, 0, 0].map((v, i) => <div key={i} className={`w-1.5 h-3 ${v ? 'bg-blue-500/40' : 'bg-white/5'}`}></div>)}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-neutral-700 text-[8px] font-mono uppercase tracking-widest">Vertex Optimization</span>
            <span className="text-white text-lg font-black italic tracking-tight leading-none uppercase">Standard <span className="text-neutral-500 text-xs">P06</span></span>
          </div>
        </div>

        <Canvas shadows gl={{ antialias: true, alpha: true }}>
          <PerspectiveCamera makeDefault position={[0, 1.4, 3.5]} fov={30} />

          <ambientLight intensity={0.5} />
          <spotLight position={[5, 10, 5]} angle={0.3} penumbra={1} intensity={3} castShadow />
          <pointLight position={[-5, 2, -5]} intensity={1.5} color="#4c6ef5" />
          <pointLight position={[5, -2, 5]} intensity={0.5} color="#ffffff" />

          <Suspense fallback={null}>
            <group position={[0, -0.6, 0]}>
              <DeformedMesh basis={basis} measurements={measurements} wireframe={wireframe} gender="male" />
              <ContactShadows opacity={0.6} scale={6} blur={2} far={1.5} />
            </group>

            <Environment preset="city" />

            <Grid
              infiniteGrid
              fadeDistance={8}
              cellColor="#111"
              sectionColor="#1a1a1a"
              sectionSize={1}
              cellSize={0.2}
              position={[0, -0.6, 0]}
            />
          </Suspense>

          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            maxPolarAngle={Math.PI / 1.7}
            target={[0, 0.8, 0]}
            minDistance={1.8}
            maxDistance={6}
          />
        </Canvas>
      </div>

      {/* Control Sidebar (Right, 30-40%) */}
      <div className="flex-[1.8] min-w-[400px] flex flex-col bg-[#0f0f0f] border-l border-white/5 shadow-[-50px_0_100px_rgba(0,0,0,0.5)] z-20">

        {/* Sidebar Header */}
        <div className="p-10 pb-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">Parameter Interface</h2>
            <button
              onClick={() => setUnits(u => u === 'metric' ? 'imperial' : 'metric')}
              className="px-3 py-1 bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-neutral-400 hover:text-white rounded-full transition-all"
            >
              Mode: {units}
            </button>
          </div>
          <div className="flex items-end justify-between">
            <h3 className="text-white text-2xl font-bold tracking-tight">Anatomy <span className="text-neutral-600 font-normal ml-1 italic font-serif">Setup</span></h3>
            <span className="text-neutral-500 text-[10px] uppercase font-mono tracking-tighter">Instance ID: TR-449</span>
          </div>
        </div>

        {/* Sliders Container */}
        <div className="flex-1 overflow-y-auto px-10 py-6 custom-scrollbar space-y-10">
          <SliderField
            label="Stature / Height"
            value={measurements.stature}
            min={140} max={210} step={1}
            display={toDisplay(measurements.stature, 'cm')}
            onChange={(v) => handleUpdate('stature', v)}
            isSet={true}
            description="The overall height of the biological asset."
          />

          <SliderField
            label="Biological Mass"
            value={measurements.weight}
            min={40} max={160} step={1}
            display={toDisplay(measurements.weight, 'kg')}
            onChange={(v) => handleUpdate('weight', v)}
            description="Total body mass indexed by volumetric calculation."
          />

          <SliderField
            label="Chest Expansion"
            value={measurements.chest}
            min={70} max={140} step={1}
            display={toDisplay(measurements.chest, 'cm')}
            onChange={(v) => handleUpdate('chest', v)}
            description="Circumference measured at the sternum."
          />

          <SliderField
            label="Waist Definition"
            value={measurements.waist}
            min={50} max={130} step={1}
            display={toDisplay(measurements.waist, 'cm')}
            onChange={(v) => handleUpdate('waist', v)}
            description="Mid-section transverse measurement (umbilicus)."
          />

          <SliderField
            label="Pelvic Width"
            value={measurements.hips}
            min={70} max={150} step={1}
            display={toDisplay(measurements.hips, 'cm')}
            onChange={(v) => handleUpdate('hips', v)}
            description="Maximum hip circumference."
          />

          <SliderField
            label="Limb Length"
            value={measurements.inseam}
            min={50} max={110} step={1}
            display={toDisplay(measurements.inseam, 'cm')}
            onChange={(v) => handleUpdate('inseam', v)}
            description="Inner leg length from crotch to floor."
          />

          <SliderField
            label="Conditioning Level"
            value={measurements.exercise}
            min={0} max={20} step={1}
            display={toDisplay(measurements.exercise, 'hr')}
            onChange={(v) => handleUpdate('exercise', v)}
            description="Activity intensity index (hours per manifest week)."
          />
        </div>

        {/* Global Controls */}
        <div className="p-10 pt-6 border-t border-white/5 bg-black/20 flex flex-col gap-4">
          <div className="flex gap-4">
            <button
              onClick={() => setWireframe(!wireframe)}
              className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all border ${wireframe ? "bg-blue-600 border-blue-500 text-white shadow-[0_0_40px_rgba(37,99,235,0.3)]" : "bg-neutral-900 border-white/10 text-neutral-400 hover:text-white"
                }`}
            >
              {wireframe ? "Solid State" : "Wireframe View"}
            </button>
            <button
              onClick={resetAll}
              className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-white transition-all hover:bg-red-500/10 hover:border-red-500/20"
            >
              Reset All
            </button>
          </div>

          <button className="w-full py-5 bg-white text-black rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-neutral-200 transition-all active:scale-[0.98]">
            Finalize Persona Build
          </button>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; }
      `}</style>
    </div>
  );
}

// --- UI Sub-components ---

function SliderField({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  isSet = false,
  description
}: {
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  display: { val: any, unit: string },
  onChange: (v: number) => void,
  isSet?: boolean,
  description: string
}) {
  return (
    <div className="group relative">
      {/* Label and Value */}
      <div className="flex items-end justify-between mb-2">
        <div className="flex flex-col">
          <span className="text-neutral-600 text-[9px] font-black uppercase tracking-[0.2em] leading-none mb-2">{label}</span>
          <div className="flex items-baseline gap-1">
            <span className="text-white text-4xl font-black italic tracking-tighter leading-none">{display.val}</span>
            <span className="text-neutral-600 text-[10px] font-bold uppercase">{display.unit}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 mb-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${isSet ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400 font-mono tracking-tighter'
              }`}>
              {isSet ? 'SET' : 'PREDICTED'}
            </span>
            <div className="w-4 h-4 rounded-full border border-white/5 flex items-center justify-center text-[8px] text-neutral-600 cursor-help hover:text-white transition-colors">?</div>
          </div>
        </div>
      </div>

      {/* Description tooltip (visible on group hover) */}
      <div className="max-h-0 opacity-0 group-hover:max-h-10 group-hover:opacity-100 transition-all duration-300 overflow-hidden mb-4">
        <p className="text-[9px] text-neutral-500 italic max-w-[80%] leading-relaxed">{description}</p>
      </div>

      {/* Visual Slider */}
      <div className="relative h-6 flex items-center">
        {/* Track Background */}
        <div className="absolute h-[3px] w-full bg-neutral-900 rounded-full overflow-hidden">
          {/* Active Fill */}
          <div
            className={`h-full transition-all duration-100 ${isSet ? 'bg-red-500' : 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]'
              }`}
            style={{ width: `${((value - min) / (max - min)) * 100}%` }}
          />
        </div>

        {/* Invisible Range Input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none z-10"
        />

        {/* Custom Thumb */}
        <div
          className="absolute w-4 h-4 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)] pointer-events-none border-[3px] border-[#0f0f0f] group-hover:scale-150 transition-transform duration-200"
          style={{ left: `calc(${((value - min) / (max - min)) * 100}% - 8px)` }}
        />
      </div>
    </div>
  );
}
