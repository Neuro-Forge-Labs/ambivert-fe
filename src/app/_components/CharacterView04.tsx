"use client";
import { useEffect } from "react";
import * as THREE from "three";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function CharacterView() {
  const gltf = useLoader(
    GLTFLoader,
    "/models/free_pack_-_female_base_mesh.glb",
  );

  useEffect(() => {
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        console.log("mesh", mesh);

        if (mesh.morphTargetDictionary) {
          console.log("Mesh", mesh);
          console.log("🔥 Mesh Name:", mesh.name);
          console.log("Dictionary:", mesh.morphTargetDictionary);
          console.log("Influences:", mesh.morphTargetInfluences);
        }
      }
    });
  }, [gltf]);

  return (
    <div className="flex-1 p-5">
      <div className="h-full relative bg-neutral-800 rounded-lg overflow-hidden p-4">
        <Canvas camera={{ position: [0, 1.4, 3.4], fov: 45 }}>
          {/* Lighting */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[1, 2, 3]} intensity={2} />

          {/* Model */}
          <primitive
            object={gltf.scene}
            position={[0, 1, 0]}
            children-0-castShadow
          />

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
