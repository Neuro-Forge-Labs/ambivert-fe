"use client";

import { OrbitControls, PerspectiveCamera, Environment, Grid, ContactShadows } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import * as THREE from "three";
import { Ruler, Weight, Heart, Pencil, MoveHorizontal, Baseline, Activity, Camera, Share2, Plus, Sliders, X } from "lucide-react";

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
    label: "Male",
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
    label: "Female",
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

// --- UI Sub-components ---

function Loader({ progress }: { progress: string }) {
  return (
    <div className="flex items-center justify-center h-full bg-[#050505] z-50">
      <div className="flex flex-col items-center gap-6">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-2 border-neutral-800 rounded-full"></div>
          <div className="absolute inset-0 border-t-2 border-white rounded-full animate-spin"></div>
        </div>
        <div className="flex flex-col items-center gap-1 text-white text-sm">
          Loading {progress}...
        </div>
      </div>
    </div>
  );
}

function SliderField({
  icon,
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  icon: React.ReactNode,
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  display: { val: any, unit: string },
  onChange: (v: number) => void,
}) {
  return (
    <div className="w-full flex flex-col">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-3 text-[#9CA3AF]">
          {icon}
          <span className="text-[13px] font-medium">{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-white text-sm font-bold">{display.val}</span>
          <span className="text-[#6B7280] text-[10px]">{display.unit}</span>
        </div>
      </div>

      <div className="relative h-4 flex items-center group cursor-pointer w-[96%] mx-auto">
        <div className="absolute h-1 w-full bg-[#1b1b1b] rounded-full overflow-hidden">
          <div
            className="h-full bg-white transition-transform origin-left"
            style={{ transform: `scaleX(${(value - min) / (max - min)})` }}
          />
        </div>

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none z-10"
        />

        <div
          className="absolute w-[18px] h-[18px] bg-white rounded-full shadow-md pointer-events-none group-hover:scale-110 transition-transform origin-center"
          style={{ left: `calc(${((value - min) / (max - min)) * 100}% - 9px)` }}
        />
      </div>
    </div>
  );
}

// --- Reusable Controls Content ---
function ControlsContent({
  gender, setGender,
  units, setUnits,
  measurements, handleUpdate,
  toDisplay,
  modelHue, setModelHue,
  resetAll,
  bmi, bmiStatusLabel, bmiPercentage,
  isMobile = false
}: any) {
  return (
    <div className={`flex flex-col h-full ${!isMobile ? 'p-6' : 'pt-4'}`}>
      {/* Gender Toggle */}
      <div className="w-full bg-[#171717] rounded-xl p-1 mb-6 flex shrink-0">
        {(['female', 'male'] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGender(g)}
            className={`flex-1 text-center py-2 text-sm font-medium rounded-lg transition-colors ${gender === g ? 'bg-[#2a2a2a] text-white shadow-sm' : 'text-[#6B7280] hover:text-[#9CA3AF]'}`}
          >
            {g.charAt(0).toUpperCase() + g.slice(1)}
          </button>
        ))}
      </div>

      {/* Units Toggle */}
      <div className="flex items-center mb-8 gap-4 px-1 shrink-0">
        <div className="bg-[#171717] rounded-full p-1 flex items-center">
          {(['imperial', 'metric'] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnits(u)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors capitalize ${units === u ? 'bg-[#2a2a2a] text-white' : 'text-[#6B7280] hover:text-[#9CA3AF]'}`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders Container */}
      <div className="flex-1 space-y-7 pb-4">
        <SliderField
          icon={<Ruler size={16} strokeWidth={2} />}
          label="Height"
          value={measurements.stature}
          min={140} max={210} step={1}
          display={toDisplay(measurements.stature, 'cm')}
          onChange={(v) => handleUpdate('stature', v)}
        />

        <SliderField
          icon={<Weight size={16} strokeWidth={2} />}
          label="Weight"
          value={measurements.weight}
          min={40} max={160} step={1}
          display={toDisplay(measurements.weight, 'kg')}
          onChange={(v) => handleUpdate('weight', v)}
        />

        <SliderField
          icon={<Heart size={16} strokeWidth={2} />}
          label="Chest"
          value={measurements.chest}
          min={70} max={140} step={1}
          display={toDisplay(measurements.chest, 'cm')}
          onChange={(v) => handleUpdate('chest', v)}
        />

        <SliderField
          icon={<Pencil size={16} strokeWidth={2} />}
          label="Waist"
          value={measurements.waist}
          min={50} max={130} step={1}
          display={toDisplay(measurements.waist, 'cm')}
          onChange={(v) => handleUpdate('waist', v)}
        />

        <SliderField
          icon={<MoveHorizontal size={16} strokeWidth={2} />}
          label="Hips"
          value={measurements.hips}
          min={70} max={150} step={1}
          display={toDisplay(measurements.hips, 'cm')}
          onChange={(v) => handleUpdate('hips', v)}
        />

        <SliderField
          icon={<Baseline size={16} strokeWidth={2} />}
          label="Inseam"
          value={measurements.inseam}
          min={50} max={110} step={1}
          display={toDisplay(measurements.inseam, 'cm')}
          onChange={(v) => handleUpdate('inseam', v)}
        />

        <SliderField
          icon={<Activity size={16} strokeWidth={2} />}
          label="Exercise"
          value={measurements.exercise}
          min={0} max={20} step={1}
          display={toDisplay(measurements.exercise, 'hr')}
          onChange={(v) => handleUpdate('exercise', v)}
        />

        {/* Color Hue Slider Overlay */}
        <div className="w-full flex flex-col pt-2 pb-2">
          <div className="relative h-6 flex items-center group cursor-pointer w-[96%] mx-auto">
            <div className="absolute h-2.5 w-full rounded-sm overflow-hidden"
              style={{ background: 'linear-gradient(to right, hsl(0, 29%, 72%), hsl(60, 29%, 72%), hsl(120, 29%, 72%), hsl(180, 29%, 72%), hsl(240, 29%, 72%), hsl(300, 29%, 72%), hsl(360, 29%, 72%))' }}
            ></div>
            <input type="range" min={0} max={360} step={1} value={modelHue} onChange={(e) => setModelHue(parseFloat(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none z-10" />
            <div className="absolute w-5 h-5 rounded-[4px] shadow-sm pointer-events-none group-hover:scale-110 transition-transform origin-center border-[1.5px] border-[#0f0f0f]"
              style={{ left: `calc(${(modelHue / 360) * 100}% - 10px)`, backgroundColor: `hsl(${modelHue}, 29%, 72%)` }}
            />
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className={`mt-auto border-t border-[#1a1a1a] pt-6 shrink-0 ${!isMobile ? '' : 'pb-6'}`}>
        <div className="flex items-center gap-6 mb-4 px-2">
          <button onClick={resetAll} className="flex items-center gap-2 text-xs text-[#9CA3AF] hover:text-white transition-colors">
            <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
            </div>
            Reset Default
          </button>

          <button className="flex items-center gap-2 text-xs text-[#9CA3AF] hover:text-white transition-colors" onClick={resetAll}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-history"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></svg>
            Reset Saved
          </button>
        </div>

        <button disabled className="w-full bg-[#1b1b1b] text-[#555] py-3 rounded-xl text-sm font-medium mb-8 cursor-not-allowed flex items-center justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></svg>
          Saved
        </button>

        {/* BMI Section */}
        <div className="px-1">
          <div className="flex items-end justify-between mb-2">
            <div className="text-xs text-[#6B7280] font-medium">BMI <span className="text-white text-base font-bold ml-1">{bmi.toFixed(1)}</span></div>
            <div className="text-xs font-medium" style={{ color: bmiStatusLabel.color }}>{bmiStatusLabel.label}</div>
          </div>

          <div className="relative h-1.5 w-full rounded-full overflow-visible mb-1 flex items-center">
            <div className="w-full h-full flex rounded-full overflow-hidden">
              <div className="w-[20%] bg-[#60A5FA]"></div>
              <div className="w-[30%] bg-[#34D399]"></div>
              <div className="w-[30%] bg-[#FBBF24]"></div>
              <div className="w-[20%] bg-[#F87171]"></div>
            </div>
            <div className="absolute w-2 h-2 bg-white rounded-full shadow-[0_0_5px_rgba(0,0,0,0.5)] border border-[#0f0f0f] z-10" style={{ left: `calc(${bmiPercentage}% - 4px)` }}></div>
          </div>

          <div className="relative w-full h-3 flex justify-between text-[10px] text-[#555]">
            <span className="w-4"></span>
            <span className="absolute left-[20%] -translate-x-1/2">18.5</span>
            <span className="absolute left-[50%] -translate-x-1/2">25</span>
            <span className="absolute left-[80%] -translate-x-1/2">30</span>
            <span className="w-4"></span>
          </div>
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
  modelHue,
}: {
  basis: BasisData,
  measurements: Measurements,
  gender: 'male' | 'female',
  modelHue: number,
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const config = GENDER_CONFIGS[gender];

  const weights = useMemo(() => {
    const m = measurements;
    const g = config.means;
    const targetRoot = Math.pow(m.weight, 1 / 3);
    const weightStep = 5.0;

    return {
      stature: (m.stature * 10 - g.stature) / 5,
      weight: (targetRoot - g.weightRoot) / weightStep,
      chest: (m.chest * 10 - g.chest) / 5,
      waist: (m.waist * 10 - g.waist) / 5,
      hips: (m.hips * 10 - g.hips) / 5,
      inseam: (m.inseam * 10 - g.inseam) / 5,
      exercise: (m.exercise - g.fitness) / 5,
    };
  }, [measurements, config]);

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

      positions[i * 3 + 0] = m[0] + (weights.stature * dS[0]) + (weights.weight * dW[0]) + (weights.chest * dC[0]) + (weights.waist * dWa[0]) + (weights.hips * dH[0]) + (weights.inseam * dI[0]) + (weights.exercise * dE[0]);
      positions[i * 3 + 1] = m[1] + (weights.stature * dS[1]) + (weights.weight * dW[1]) + (weights.chest * dC[1]) + (weights.waist * dWa[1]) + (weights.hips * dH[1]) + (weights.inseam * dI[1]) + (weights.exercise * dE[1]);
      positions[i * 3 + 2] = m[2] + (weights.stature * dS[2]) + (weights.weight * dW[2]) + (weights.chest * dC[2]) + (weights.waist * dWa[2]) + (weights.hips * dH[2]) + (weights.inseam * dI[2]) + (weights.exercise * dE[2]);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(basis.faces.flat()), 1));
    geo.computeVertexNormals();
    return geo;
  }, [basis, weights]);

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={new THREE.Color(`hsl(${modelHue}, 29%, 72%)`)}
        roughness={0.6}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}


// --- Main Application Component ---
export default function CharacterView09() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-[#050505] flex items-center justify-center text-white">Initializing Viewer...</div>}>
      <CharacterViewerContent />
    </Suspense>
  );
}

function CharacterViewerContent() {
  const searchParams = useSearchParams();
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [basis, setBasis] = useState<BasisData | null>(null);
  const [modelHue, setModelHue] = useState<number>(209);
  const [showMobileControls, setShowMobileControls] = useState(false);

  // Default values matching the image
  const defaultMeasurements: Measurements = {
    stature: 177,
    weight: 82,
    chest: 102,
    waist: 89,
    hips: 103,
    inseam: 80,
    exercise: 4,
  };

  const [measurements, setMeasurements] = useState<Measurements>(defaultMeasurements);
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [loadingStep, setLoadingStep] = useState("Initializing");
  const [error, setError] = useState<string | null>(null);

  // Initialize from Query Params
  useEffect(() => {
    if (!searchParams) return;

    const g = searchParams.get('gender');
    if (g === 'male' || g === 'female') setGender(g);

    const u = searchParams.get('units');
    if (u === 'metric' || u === 'imperial') setUnits(u);

    const c = searchParams.get('color');
    if (c) {
      const hue = parseInt(c);
      if (!isNaN(hue)) setModelHue(Math.max(0, Math.min(360, hue)));
    }

    const updatedMeasurements = { ...defaultMeasurements };
    let hasChanges = false;

    const paramMap: Record<string, keyof Measurements> = {
      height: 'stature',
      stature: 'stature',
      weight: 'weight',
      chest: 'chest',
      waist: 'waist',
      hips: 'hips',
      inseam: 'inseam',
      exercise: 'exercise'
    };

    Object.entries(paramMap).forEach(([param, key]) => {
      const val = searchParams.get(param);
      if (val) {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          updatedMeasurements[key] = num;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      setMeasurements(updatedMeasurements);
    }
  }, [searchParams]);

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
        setLoadingStep("Model Topology");
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
          stature: await loadDiff('stature_plus_5mm', 'stature_plus_5mm_vertices', 'Height Data'),
          weight: await loadDiff('weight_cube_root_plus_5kg', 'weight_cube_root_plus_5kg_vertices', 'Weight Data'),
          chest: await loadDiff('chest_circumference_plus_5mm', 'chest_circumference_plus_5mm_vertices', 'Chest Data'),
          waist: await loadDiff('waist_circumference_pref_plus_5mm', 'waist_circumference_pref_plus_5mm_vertices', 'Waist Data'),
          hips: await loadDiff('hip_circumference_maximum_plus_5mm', 'hip_circumference_maximum_plus_5mm_vertices', 'Hips Data'),
          inseam: await loadDiff('inseam_right_plus_5mm', 'inseam_right_plus_5mm_vertices', 'Inseam Data'),
          exercise: await loadDiff('fitness_plus_5hours', 'fitness_plus_5hours_vertices', 'Fitness Data'),
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
    setMeasurements(defaultMeasurements);
    setModelHue(209);
  };

  // BMI Calculation
  const bmi = useMemo(() => {
    const hMeter = measurements.stature / 100;
    return measurements.weight / (hMeter * hMeter);
  }, [measurements]);

  const bmiStatusLabel = useMemo(() => {
    if (bmi < 18.5) return { label: "Underweight", color: "#60A5FA" }; // Blue
    if (bmi < 25) return { label: "Standard", color: "#34D399" };      // Green
    if (bmi < 30) return { label: "Overweight", color: "#FBBF24" };    // Yellow
    return { label: "Obese", color: "#F87171" };                       // Red
  }, [bmi]);

  // Calculate white dot position percentage on BMI bar
  // Assuming bar min is ~10 and max is ~40 visually
  const bmiMinIndex = 14;
  const bmiMaxIndex = 40;
  const clampedBmi = Math.max(bmiMinIndex, Math.min(bmiMaxIndex, bmi));
  const bmiPercentage = ((clampedBmi - bmiMinIndex) / (bmiMaxIndex - bmiMinIndex)) * 100;

  // Conversion for display
  const toDisplay = (val: number, type: 'cm' | 'kg' | 'hr') => {
    if (units === 'metric') return { val: val.toFixed(type === 'hr' ? 0 : 0), unit: type };
    if (type === 'cm') return { val: (val / 2.54).toFixed(0), unit: 'in' };
    if (type === 'kg') return { val: (val * 2.20462).toFixed(0), unit: 'lb' };
    return { val: val.toFixed(0), unit: type };
  };

  if (error) return (
    <div className="flex-1 flex items-center justify-center bg-[#050505] text-red-500 p-10 text-center font-medium">
      <div className="max-w-md bg-red-500/10 border border-red-500/20 p-8 rounded-xl shrink-0">
        <div className="text-white font-bold text-lg mb-2">Error</div>
        <p className="text-neutral-400 text-sm">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row w-full h-[100dvh] bg-[#050505] overflow-hidden text-neutral-300 font-sans selection:bg-neutral-800">

      {/* MOBILE BACKDROP */}
      {showMobileControls && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setShowMobileControls(false)}
        />
      )}

      {/* LEFT PANEL - 3D VIEWER */}
      <div className="flex-1 relative flex flex-col h-full min-h-0 bg-[#050505]">
        {/* Top Left Menu */}
        <div className="absolute top-6 left-6 z-10 flex flex-col gap-3">
          <button className="flex items-center gap-2 bg-[#1b1b1b] hover:bg-[#252525] border border-[#2a2a2a] px-4 py-2 rounded-full text-[10px] md:text-xs font-medium text-white shadow-sm transition-colors cursor-pointer">
            Default Body
          </button>
          <button className="flex items-center gap-2 bg-transparent hover:bg-[#1b1b1b] border border-[#2a2a2a] px-3 py-1.5 rounded-full text-[#9CA3AF] text-[10px] md:text-xs transition-colors self-start cursor-pointer group">
            <Plus size={12} className="text-[#9CA3AF] group-hover:text-white md:hidden" />
            <Plus size={14} className="text-[#9CA3AF] group-hover:text-white hidden md:block" /> New
          </button>
        </div>

        {/* Bottom Right Actions */}
        <div className="absolute bottom-6 md:bottom-6 right-6 z-10 flex items-center gap-4 text-[#9CA3AF]">
          <button className="hover:text-white transition-colors cursor-pointer"><Share2 size={18} className="md:w-5 md:h-5" /></button>
          <button className="hover:text-white transition-colors cursor-pointer"><Camera size={18} className="md:w-5 md:h-5" /></button>
        </div>

        {/* Adjust Body Stats (Mobile Button) */}
        {!showMobileControls && (
          <div className="md:hidden absolute bottom-12 left-1/2 -translate-x-1/2 z-10 w-full px-6 max-w-sm">
            <button
              onClick={() => setShowMobileControls(true)}
              className="w-full bg-[#111] hover:bg-[#1a1a1a] border border-[#333] py-3.5 rounded-full text-sm font-medium text-white flex items-center justify-center gap-2.5 shadow-xl active:scale-95 transition-all"
            >
              <Sliders size={18} />
              Adjust Body Stats
            </button>
          </div>
        )}

        {!basis ? (
          <Loader progress={loadingStep} />
        ) : (
          <Canvas gl={{ antialias: true, alpha: true }} camera={{ position: [0, 1.2, 3.5], fov: 35 }}>
            <ambientLight intensity={0.4} />
            <spotLight position={[5, 5, 2]} angle={0.5} penumbra={1} intensity={1} castShadow />
            <spotLight position={[-5, 5, 2]} angle={0.5} penumbra={1} intensity={0.5} />
            <pointLight position={[0, -2, -2]} intensity={0.2} color="#ffffff" />

            <Suspense fallback={null}>
              <group position={[0, 0, 0]} scale={0.7}>
                <DeformedMesh basis={basis} measurements={measurements} gender={gender} modelHue={modelHue} />
              </group>
              <Environment preset="city" />
            </Suspense>

            <OrbitControls
              enableDamping
              dampingFactor={0.05}
              maxPolarAngle={Math.PI / 1.6}
              target={[0, 0.8, 0]}
              minDistance={2}
              maxDistance={7}
            />
          </Canvas>
        )}
      </div>

      {/* RIGHT PANEL - CONTROLS (DESKTOP) */}
      <div className="hidden md:flex w-[340px] shrink-0 bg-[#0f0f0f] border-l border-[#1a1a1a] flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-20">
        <ControlsContent
          gender={gender}
          setGender={setGender}
          units={units}
          setUnits={setUnits}
          measurements={measurements}
          handleUpdate={handleUpdate}
          toDisplay={toDisplay}
          modelHue={modelHue}
          setModelHue={setModelHue}
          resetAll={resetAll}
          bmi={bmi}
          bmiStatusLabel={bmiStatusLabel}
          bmiPercentage={bmiPercentage}
        />
      </div>

      {/* MOBILE DRAWER */}
      <div
        className={`md:hidden fixed inset-x-0 bottom-0 z-50 bg-[#0f0f0f] border-t border-[#1a1a1a] rounded-t-[32px] shadow-[0_-20px_40px_rgba(0,0,0,0.5)] transition-transform duration-500 ease-out ${showMobileControls ? 'translate-y-0' : 'translate-y-full'
          }`}
        style={{ height: '75dvh' }}
      >
        <div className="w-full flex flex-col h-full relative">
          {/* Pull bar / Indicator */}
          <div className="w-12 h-1.5 bg-[#2a2a2a] rounded-full mx-auto mt-4 mb-2 shrink-0"></div>

          <div className="flex items-center justify-between px-6 py-2 shrink-0">
            <h2 className="text-white text-sm font-semibold">Adjust the sliders to change the body shape.</h2>
            <button
              onClick={() => setShowMobileControls(false)}
              className="w-8 h-8 flex items-center justify-center bg-[#1b1b1b] rounded-full text-neutral-400"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-12 custom-scrollbar">
            <ControlsContent
              gender={gender}
              setGender={setGender}
              units={units}
              setUnits={setUnits}
              measurements={measurements}
              handleUpdate={handleUpdate}
              toDisplay={toDisplay}
              modelHue={modelHue}
              setModelHue={setModelHue}
              resetAll={resetAll}
              bmi={bmi}
              bmiStatusLabel={bmiStatusLabel}
              bmiPercentage={bmiPercentage}
              isMobile
            />
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #444; }
      `}</style>
    </div>
  );
}
