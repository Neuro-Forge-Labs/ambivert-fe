"use client";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useLoader } from "@react-three/fiber";
import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

// Dummy SMPL Beta parameters for mapping references
const DUMMY_BETAS = [
  3.1000001430511475, 0.8608996272087097, 0.2260899692773819,
  -0.06000000238418579, 0.08695501834154129, 0, 0, 0, 0, 0,
];

function CharacterBody({ morphValues, onMorphTargetsDetected }: {
  morphValues: Record<string, number>,
  onMorphTargetsDetected: (dict: Record<string, number>) => void
}) {
  const fbx = useLoader(FBXLoader, "/models/base-character-fbx-02.FBX");
  const extracted = useRef(false);

  useEffect(() => {
    if (fbx) {
      let foundDict: Record<string, number> | null = null;

      fbx.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
            // Grab the very first dict we find to populate the UI
            if (!foundDict) foundDict = mesh.morphTargetDictionary;

            // Apply current morph values based on the keys
            Object.keys(morphValues).forEach((key) => {
              const targetIndex = mesh.morphTargetDictionary![key];
              if (targetIndex !== undefined && mesh.morphTargetInfluences) {
                mesh.morphTargetInfluences[targetIndex] = morphValues[key];
              }
            });
          }
        }
      });

      // Fire callback only once when we discover the dictionary
      if (foundDict && !extracted.current) {
        extracted.current = true;
        onMorphTargetsDetected(foundDict);
      }
    }
  }, [fbx, morphValues, onMorphTargetsDetected]);

  return <primitive object={fbx} scale={0.01} position={[0, 0, 0]} />;
}

export default function CharacterView02() {
  const [morphTargets, setMorphTargets] = useState<string[]>([]);
  const [morphValues, setMorphValues] = useState<Record<string, number>>({});

  const handleMorphTargetsDetected = useCallback((dict: Record<string, number>) => {
    const keys = Object.keys(dict);
    setMorphTargets(keys);

    // Auto-apply DUMMY_BETAS to the first 10 keys to see if they correspond to the shape.
    const initialValues: Record<string, number> = {};
    keys.forEach((k, index) => {
      initialValues[k] = index < DUMMY_BETAS.length ? DUMMY_BETAS[index] : 0;
    });
    setMorphValues(initialValues);
  }, []);

  return (
    <div className="flex-1 p-5 flex gap-4 h-[800px] w-full mt-10">
      <div className="w-[350px] bg-neutral-900 border border-neutral-700 rounded-lg p-4 overflow-y-auto text-white flex flex-col gap-4 shadow-xl">
        <h3 className="text-xl font-bold tracking-tight text-neutral-100">Morph Debugger</h3>
        <p className="text-xs text-neutral-400">
          This panel auto-extracts blendshapes mapped on the FBX. Scroll and tweak sliders to find exactly which keys shape the avatar.
        </p>

        {morphTargets.length === 0 ? (
          <div className="p-3 bg-red-900/40 border border-red-700/60 rounded-lg text-red-300 text-sm">
            <span className="font-bold">No Morph Targets Found.</span>
            <br /><br />
            The FBX model might not have blendshapes exported correctly, or they aren't bound to the root mesh.
          </div>
        ) : (
          <div className="flex flex-col gap-4 pt-2">
            <button
              onClick={() => {
                const reset: Record<string, number> = {};
                morphTargets.forEach(k => reset[k] = 0);
                setMorphValues(reset);
              }}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-sm transition-colors shadow-lg cursor-pointer"
            >
              Reset All To 0
            </button>
            <div className="h-px bg-neutral-800 w-full" />
            <div className="flex flex-col gap-5 pb-10">
              {morphTargets.map((key) => (
                <div key={key} className="flex flex-col gap-1.5 focus-within:bg-neutral-800 p-2 -mx-2 rounded transition-colors">
                  <label className="text-xs text-neutral-300 flex justify-between items-center">
                    <span className="truncate w-3/4 font-mono text-[11px]" title={key}>{key}</span>
                    <span className="font-mono text-[11px] text-blue-400 font-bold bg-blue-900/40 px-1 py-0.5 rounded min-w-[36px] text-right inline-block">
                      {morphValues[key]?.toFixed(2)}
                    </span>
                  </label>
                  <input
                    type="range"
                    min="-5"
                    max="5"
                    step="0.05"
                    value={morphValues[key] || 0}
                    onChange={(e) =>
                      setMorphValues((prev) => ({
                        ...prev,
                        [key]: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer outline-none slider-thumb"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 relative bg-neutral-800 rounded-lg overflow-hidden shadow-inner ring-1 ring-white/10">
        <Canvas camera={{ position: [0, 1.4, 3.4], fov: 45 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[1, 2, 3]} intensity={2} />
          <Suspense fallback={null}>
            <CharacterBody
              morphValues={morphValues}
              onMorphTargetsDetected={handleMorphTargetsDetected}
            />
          </Suspense>
          <OrbitControls
            enableDamping
            enablePan={false}
            minDistance={2.5}
            maxDistance={4}
            maxPolarAngle={Math.PI / 1.8}
            target={[0, 1, 0]}
          />
        </Canvas>
      </div>
    </div>
  );
}
