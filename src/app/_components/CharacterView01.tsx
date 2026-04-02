"use client";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

export default function CharacterView() {
  const fbx = useLoader(FBXLoader, "/models/base-character-fbx-01.FBX");

  return (
    <div className="flex-1 p-5">
      <div className="h-full relative bg-neutral-800 rounded-lg overflow-hidden p-4">
        <Canvas camera={{ position: [0, 1.4, 3.4], fov: 45 }}>
          {/* Lighting */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[1, 2, 3]} intensity={2} />

          {/* Model */}
          <primitive object={fbx} scale={0.01} position={[0, 0, 0]} />

          {/* Controls */}
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
