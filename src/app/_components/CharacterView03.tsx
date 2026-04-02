"use client";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useLoader } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

interface Measurements {
  height: number;
  weight: number;
  chest: number;
  waist: number;
  hips: number;
  inseam: number;
}

const DEFAULT_MEASUREMENTS: Measurements = {
  height: 164,
  weight: 64,
  chest: 93,
  waist: 76,
  hips: 102,
  inseam: 76,
};

// Heuristic function to estimate SMPL betas from standard measurements
// In a real Meshcapade environment, this is done via a complex mathematical regression matrix
function calculateBetas(measurements: Measurements): number[] {
  const dHeight = measurements.height - DEFAULT_MEASUREMENTS.height;
  const dWeight = measurements.weight - DEFAULT_MEASUREMENTS.weight;
  const dChest = measurements.chest - DEFAULT_MEASUREMENTS.chest;
  const dWaist = measurements.waist - DEFAULT_MEASUREMENTS.waist;
  const dHips = measurements.hips - DEFAULT_MEASUREMENTS.hips;

  // Beta 0: Often Size/Stature/Height (Negative usually taller)
  const beta0 = (dHeight * -0.04) + (dWeight * 0.015);
  // Beta 1: Often Volume/Weight. (Positive fatter)
  const beta1 = (dWeight * 0.08) - (dHeight * 0.02);
  // Beta 2: Often Chest/Muscularity
  const beta2 = (dChest * 0.05) - (dWaist * 0.02);
  // Beta 3: Often Waist/Belly
  const beta3 = (dWaist * 0.06);
  // Beta 4: Often Hips/Thighs
  const beta4 = (dHips * 0.05);

  // Subsequent betas for fine tuning - keeping minimal effects
  const beta5 = dWeight * 0.01;
  const beta6 = 0;
  const beta7 = 0;
  const beta8 = 0;
  const beta9 = 0;

  return [beta0, beta1, beta2, beta3, beta4, beta5, beta6, beta7, beta8, beta9];
}

function CharacterBody({ betas }: { betas: number[] }) {
  const fbx = useLoader(FBXLoader, "/models/base-character-fbx-02.FBX");

  useEffect(() => {
    if (fbx) {
      fbx.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
            // MorphTargetDictionary looks like { "shape0": 0, "shape1": 1, ... }
            const keys = Object.keys(mesh.morphTargetDictionary);

            // Map our 10 calculated betas to the first 10 morph targets found
            for (let i = 0; i < Math.min(betas.length, keys.length); i++) {
              const targetKey = keys[i];
              const targetIndex = mesh.morphTargetDictionary[targetKey];
              if (targetIndex !== undefined && mesh.morphTargetInfluences) {
                // apply smoothing limit to avoid breaking the mesh entirely
                mesh.morphTargetInfluences[targetIndex] = Math.max(-5, Math.min(5, betas[i]));
              }
            }
          }
        }
      });
    }
  }, [fbx, betas]);

  return <primitive object={fbx} scale={0.01} position={[0, -0.8, 0]} />;
}

export default function CharacterView03() {
  const [measurements, setMeasurements] = useState<Measurements>(DEFAULT_MEASUREMENTS);

  // Compute our 10 shape parameters (Betas) when measurements change
  const currentBetas = useMemo(() => calculateBetas(measurements), [measurements]);

  const updateMeasurement = (key: keyof Measurements, value: number) => {
    setMeasurements((prev) => ({ ...prev, [key]: value }));
  };

  const sliderConfig = [
    { key: "height", label: "Height", min: 140, max: 210, unit: "cm", icon: "📐" },
    { key: "weight", label: "Weight", min: 40, max: 150, unit: "kg", icon: "⚖️" },
    { key: "chest", label: "Chest", min: 70, max: 140, unit: "cm", icon: "🫀" },
    { key: "waist", label: "Waist", min: 50, max: 130, unit: "cm", icon: "📏" },
    { key: "hips", label: "Hips", min: 70, max: 150, unit: "cm", icon: "👖" },
    { key: "inseam", label: "Inseam", min: 50, max: 100, unit: "cm", icon: "👖" },
  ];

  return (
    <div className="flex w-full h-[90vh] bg-[#111] text-white overflow-hidden p-6 gap-6 rounded-xl mt-6">

      {/* SIDEBAR B - Edit Mode Configurator */}
      <div className="w-[320px] h-full flex flex-col bg-[#1a1a1a] border border-[#333] rounded-2xl p-5 shadow-2xl z-10 overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold tracking-tight">Adjust Body Shape</h2>
        </div>

        {/* Gender Toggle Dummy */}
        <div className="flex bg-[#2a2a2a] p-1 rounded-lg mb-6 text-sm font-medium">
          <button className="flex-1 bg-[#444] shadow-sm py-1.5 rounded-md text-white transition-all">Female</button>
          <button className="flex-1 py-1.5 text-neutral-400 hover:text-white transition-all">Male</button>
        </div>

        {/* Unit Toggle Dummy */}
        <div className="flex items-center gap-2 mb-8">
          <div className="flex bg-[#2a2a2a] p-1 rounded-lg text-xs font-medium w-max">
            <button className="px-4 py-1.5 text-neutral-400 hover:text-white transition-all">Imperial</button>
            <button className="px-4 py-1.5 bg-[#444] shadow-sm rounded-md text-white transition-all">Metric</button>
          </div>
        </div>

        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-4 px-1">Measurements</h3>

        <div className="flex flex-col gap-6">
          {sliderConfig.map(({ key, label, min, max, unit, icon }) => {
            const val = measurements[key as keyof Measurements];
            return (
              <div key={key} className="flex flex-col gap-2 group">
                <div className="flex justify-between items-center text-sm px-1">
                  <span className="flex items-center gap-2 text-neutral-300 font-medium">
                    <span className="opacity-70 text-xs">{icon}</span> {label}
                  </span>
                  <span className="font-mono font-semibold text-white">
                    {val} <span className="text-neutral-500 text-xs font-sans font-normal">{unit}</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={0.5}
                  value={val}
                  onChange={(e) => updateMeasurement(key as keyof Measurements, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer outline-none transition-all group-hover:bg-[#444]
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                    [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md
                    [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                />
              </div>
            );
          })}
        </div>

        <div className="mt-auto pt-6 flex justify-between items-center">
          <button
            onClick={() => setMeasurements(DEFAULT_MEASUREMENTS)}
            className="text-xs font-medium text-neutral-400 hover:text-white hover:underline transition-all"
          >
            Reset to Default
          </button>
        </div>
      </div>

      {/* MAIN 3D CANVAS */}
      <div className="flex-1 relative bg-[#181818] rounded-2xl overflow-hidden shadow-inner ring-1 ring-white/5 flex items-center justify-center">
        {/* Helper UI Overlays */}
        <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg text-xs font-mono text-neutral-300 z-10 flex flex-col gap-1 pointer-events-none">
          <span className="text-[10px] uppercase text-neutral-500 tracking-wider">Estimated Core Betas</span>
          <span>B0: {currentBetas[0].toFixed(2)}</span>
          <span>B1: {currentBetas[1].toFixed(2)}</span>
          <span>B2: {currentBetas[2].toFixed(2)}</span>
        </div>

        <Canvas camera={{ position: [0, 1.2, 4], fov: 40 }} gl={{ preserveDrawingBuffer: true, antialias: true }}>
          <color attach="background" args={["#181818"]} />
          {/* Lighting optimized for visualizing smooth body forms */}
          <ambientLight intensity={0.5} />
          <directionalLight position={[2, 5, 2]} intensity={1.5} castShadow />
          <spotLight position={[-2, 2, 2]} intensity={1} angle={0.5} penumbra={1} color="#e0f2fe" />
          <spotLight position={[2, 0, -2]} intensity={1} angle={0.5} penumbra={1} color="#fecdd3" />

          <Suspense fallback={null}>
            <CharacterBody betas={currentBetas} />
          </Suspense>

          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            enablePan={false}
            minDistance={2}
            maxDistance={6}
            maxPolarAngle={Math.PI / 1.7}
            target={[0, 0.8, 0]}
          />
        </Canvas>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #333; border-radius: 10px; }
      `}} />
    </div>
  );
}
