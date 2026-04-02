"use client";

import { useState, useRef, Suspense, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useLoader, useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Types for Meshcapade API
interface BodyMeasurements {
  height?: number;
  weight?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  inseam?: number;
  shoulder_width?: number;
  arm_length?: number;
  neck?: number;
  thigh?: number;
  calf?: number;
  bicep?: number;
  [key: string]: number | undefined;
}

interface ApiResponse {
  avatar_url?: string;
  glb_data?: ArrayBuffer;
  mesh?: {
    vertices?: number[];
    faces?: number[];
  };
  error?: string;
  message?: string;
}

// Default measurements for a standard body type
const defaultMeasurements: BodyMeasurements = {
  height: 175,
  weight: 70,
  chest: 96,
  waist: 81,
  hips: 96,
  inseam: 81,
  shoulder_width: 44,
  arm_length: 63,
  neck: 38,
  thigh: 56,
  calf: 37,
  bicep: 32,
};

// Loading fallback component
function Loader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-white text-lg">Loading 3D model...</div>
    </div>
  );
}

// Animated mesh component with rotation
function AnimatedModel({ url }: { url: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useLoader(GLTFLoader, url);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.003;
    }
  });

  // Apply consistent materials to the model
  gltf.scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={gltf.scene} position={[0, 0, 0]} />
    </group>
  );
}

// Component for rendering from raw GLB data (Blob URL)
function ModelFromBlob({ blob }: { blob: Blob }) {
  const groupRef = useRef<THREE.Group>(null);
  const url = URL.createObjectURL(blob);
  const gltf = useLoader(GLTFLoader, url);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.003;
    }
  });

  // Apply consistent materials to the model
  gltf.scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={gltf.scene} position={[0, 0, 0]} />
    </group>
  );
}

// Measurement input field component
interface MeasurementFieldProps {
  label: string;
  name: string;
  value: number | undefined;
  onChange: (name: string, value: number) => void;
  min?: number;
  max?: number;
  unit?: string;
}

function MeasurementField({
  label,
  name,
  value,
  onChange,
  min = 0,
  max = 300,
  unit = "cm",
}: MeasurementFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-neutral-300">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          name={name}
          value={value ?? ""}
          min={min}
          max={max}
          step={0.1}
          onChange={(e) => onChange(name, parseFloat(e.target.value) || 0)}
          className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />
        <span className="text-sm text-neutral-400 w-8">{unit}</span>
      </div>
    </div>
  );
}

export default function CharacterView05() {
  const [measurements, setMeasurements] = useState<BodyMeasurements>(defaultMeasurements);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [apiKey, setApiKey] = useState<string>("");

  const handleMeasurementChange = useCallback((name: string, value: number) => {
    setMeasurements((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleReset = () => {
    setMeasurements(defaultMeasurements);
    setAvatarUrl(null);
    setAvatarBlob(null);
    setError(null);
  };

  const createAvatar = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Filter out undefined values
      const validMeasurements = Object.fromEntries(
        Object.entries(measurements).filter(([, v]) => v !== undefined)
      );

      // Prepare the request body according to Meshcapade API
      // const requestBody = {
      //   // measurements: validMeasurements,
      //   measurements: {
      //     Height: validMeasurements.height,
      //     Weight: validMeasurements.weight,
      //   },
      //   format: "glb",
      // };

      const requestBody = {
        gender: 0,
        measurements: {
          Height: validMeasurements.height,
          Weight: validMeasurements.weight,
        },
        modelVersion: 1,
        name: "MyFirstAvatar"
      };

      // Call Meshcapade API
      const response = await fetch("https://api.meshcapade.com/api/v1/avatars/create/from-measurements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `API Error: ${response.status}`);
      }

      // Try to get the response as a blob (GLB file)
      const blob = await response.blob();

      if (blob.size > 0 && blob.type.includes("model")) {
        // Response is a 3D model file
        setAvatarBlob(blob);
        setAvatarUrl(URL.createObjectURL(blob));
      } else {
        // Try to parse as JSON for avatar URL
        const text = await blob.text();
        try {
          const data: ApiResponse = JSON.parse(text);
          if (data.avatar_url) {
            setAvatarUrl(data.avatar_url);
            setAvatarBlob(null);
          } else if (data.error) {
            throw new Error(data.error);
          } else {
            throw new Error("No avatar URL or model data in response");
          }
        } catch {
          throw new Error("Failed to parse API response");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      console.error("Failed to create avatar:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 p-5">
      <div className="h-full flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            Meshcapade Avatar Generator
          </h2>
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-neutral-300 hover:text-white bg-neutral-700 hover:bg-neutral-600 rounded transition-colors"
          >
            Reset
          </button>
        </div>

        <div className="flex-1 flex gap-4 min-h-0">
          {/* Measurements Panel */}
          <div className="w-72 flex flex-col gap-4 overflow-y-auto p-4 bg-neutral-800 rounded-lg">
            <div className="text-sm text-neutral-400 mb-2">
              Enter body measurements in centimeters (cm) and kilograms (kg) to generate a 3D avatar.
            </div>

            {/* API Key Input */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-neutral-300">API Key (Optional)</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Meshcapade API key"
                className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Body Measurements */}
            <div className="grid grid-cols-2 gap-3">
              <MeasurementField
                label="Height"
                name="height"
                value={measurements.height}
                onChange={handleMeasurementChange}
                min={100}
                max={250}
              />
              <MeasurementField
                label="Weight"
                name="weight"
                value={measurements.weight}
                onChange={handleMeasurementChange}
                min={30}
                max={200}
                unit="kg"
              />
              <MeasurementField
                label="Chest"
                name="chest"
                value={measurements.chest}
                onChange={handleMeasurementChange}
                min={60}
                max={150}
              />
              <MeasurementField
                label="Waist"
                name="waist"
                value={measurements.waist}
                onChange={handleMeasurementChange}
                min={50}
                max={150}
              />
              <MeasurementField
                label="Hips"
                name="hips"
                value={measurements.hips}
                onChange={handleMeasurementChange}
                min={60}
                max={150}
              />
              <MeasurementField
                label="Inseam"
                name="inseam"
                value={measurements.inseam}
                onChange={handleMeasurementChange}
                min={50}
                max={120}
              />
              <MeasurementField
                label="Shoulders"
                name="shoulder_width"
                value={measurements.shoulder_width}
                onChange={handleMeasurementChange}
                min={30}
                max={80}
              />
              <MeasurementField
                label="Arm Length"
                name="arm_length"
                value={measurements.arm_length}
                onChange={handleMeasurementChange}
                min={40}
                max={100}
              />
              <MeasurementField
                label="Neck"
                name="neck"
                value={measurements.neck}
                onChange={handleMeasurementChange}
                min={25}
                max={60}
              />
              <MeasurementField
                label="Thigh"
                name="thigh"
                value={measurements.thigh}
                onChange={handleMeasurementChange}
                min={30}
                max={100}
              />
              <MeasurementField
                label="Calf"
                name="calf"
                value={measurements.calf}
                onChange={handleMeasurementChange}
                min={20}
                max={80}
              />
              <MeasurementField
                label="Bicep"
                name="bicep"
                value={measurements.bicep}
                onChange={handleMeasurementChange}
                min={20}
                max={60}
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={createAvatar}
              disabled={isLoading}
              className={`mt-2 w-full py-3 px-4 rounded font-medium transition-colors ${isLoading
                ? "bg-neutral-600 text-neutral-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white"
                }`}
            >
              {isLoading ? "Generating Avatar..." : "Generate Avatar"}
            </button>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
                {error}
              </div>
            )}

            {/* Info */}
            <div className="text-xs text-neutral-500 mt-auto">
              <p>Powered by Meshcapade API</p>
              <p>Measurements in cm (weight in kg)</p>
            </div>
          </div>

          {/* 3D Viewer Panel */}
          <div className="flex-1 relative bg-neutral-800 rounded-lg overflow-hidden p-4 min-h-0">
            {avatarUrl || avatarBlob ? (
              <Suspense fallback={<Loader />}>
                <Canvas
                  camera={{ position: [0, 1.4, 3.4], fov: 45 }}
                  shadows
                >
                  {/* Lighting */}
                  <ambientLight intensity={0.6} />
                  <directionalLight
                    position={[1, 2, 3]}
                    intensity={2}
                    castShadow
                  />
                  <directionalLight
                    position={[-1, 1, -1]}
                    intensity={0.5}
                  />
                  <hemisphereLight
                    args={["#ffffff", "#444444", 0.5]}
                  />

                  {/* 3D Model */}
                  {avatarBlob ? (
                    <ModelFromBlob blob={avatarBlob} />
                  ) : (
                    <AnimatedModel url={avatarUrl!} />
                  )}

                  {/* Ground shadow */}
                  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
                    <planeGeometry args={[10, 10]} />
                    <shadowMaterial opacity={0.3} />
                  </mesh>

                  {/* Controls */}
                  <OrbitControls
                    enableDamping
                    enablePan={false}
                    minDistance={2}
                    maxDistance={6}
                    maxPolarAngle={Math.PI / 1.8}
                    target={[0, 1, 0]}
                  />
                </Canvas>
              </Suspense>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-neutral-400">
                <svg
                  className="w-16 h-16 mb-4 text-neutral-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <p className="text-lg">Enter body measurements</p>
                <p className="text-sm mt-2">and click "Generate Avatar" to create a 3D model</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}