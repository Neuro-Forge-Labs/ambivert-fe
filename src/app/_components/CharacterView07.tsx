"use client";

import { OrbitControls, PerspectiveCamera, Environment, Grid } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useState, useRef } from "react";
import * as THREE from "three";

// Loading fallback component
function Loader() {
    return (
        <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-neutral-400 text-lg font-medium animate-pulse">Parsing Mean Shape...</div>
            </div>
        </div>
    );
}

// 3D Model Component
function MeanShapeMesh({ vertices, faces, wireframe }: { vertices: number[][], faces: number[][], wireframe: boolean }) {
    const meshRef = useRef<THREE.Mesh>(null);

    // Rotate slowly for a premium feel
    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.1;
        }
    });

    const geometry = useMemo(() => {
        if (!vertices || !faces) return null;

        const geo = new THREE.BufferGeometry();

        // Flatten vertices: [[x,y,z], ...] -> [x,y,z, x,y,z, ...]
        const flatVertices = new Float32Array(vertices.flat());

        // Flatten faces: [[v1,v2,v3], ...] -> [v1,v2,v3, v1,v2,v3, ...]
        const flatFaces = new Uint32Array(faces.flat());

        geo.setAttribute('position', new THREE.BufferAttribute(flatVertices, 3));
        geo.setIndex(new THREE.BufferAttribute(flatFaces, 1));
        geo.computeVertexNormals();

        return geo;
    }, [vertices, faces]);

    if (!geometry) return null;

    return (
        <mesh ref={meshRef} geometry={geometry} position={[0, 0, 0]}>
            <meshStandardMaterial
                color="#e2e8f0"
                metalness={0.1}
                roughness={0.5}
                wireframe={wireframe}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}

export default function CharacterView06() {
    const [data, setData] = useState<{ vertices: number[][], faces: number[][] } | null>(null);
    const [wireframe, setWireframe] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const response = await fetch('/script/mean.js');
                if (!response.ok) throw new Error("Failed to fetch mean.js");
                const scriptContent = await response.text();

                // Safe evaluation of the script to extract the global variables
                // We provide dummy variables for global symbols the script might expect
                const extractData = new Function(`
          var name, mean_vertices, mean_faces, mean_mesh, model_loader;
          ${scriptContent}; 
          return { mean_vertices, mean_faces };
        `);
                const result = extractData();

                if (result.mean_vertices && result.mean_faces) {
                    setData({
                        vertices: result.mean_vertices,
                        faces: result.mean_faces
                    });
                } else {
                    throw new Error("Data not found in mean.js");
                }
            } catch (err) {
                console.error(err);
                setError("Error loading 3D data. Ensure /public/script/mean.js exists.");
            }
        };

        loadData();
    }, []);

    return (
        <div className="flex-1 p-5 h-screen bg-[#0a0a0a]">
            <div className="h-full relative bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">

                {/* Header Overlay */}
                <div className="absolute top-0 left-0 right-0 p-6 z-10 pointer-events-none flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Mean Shape Viewer</h1>
                        <p className="text-neutral-500 text-sm mt-1">Rendered from raw SMPL-compatible vertex data</p>
                    </div>

                    <div className="pointer-events-auto flex gap-3">
                        <button
                            onClick={() => setWireframe(!wireframe)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${wireframe
                                    ? "bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 border border-neutral-700"
                                }`}
                        >
                            {wireframe ? "Solid Mode" : "Wireframe Mode"}
                        </button>
                    </div>
                </div>

                {/* Info Stats Overlay */}
                {data && (
                    <div className="absolute bottom-6 left-6 z-10 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-3 rounded-xl pointer-events-none">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                            <span className="text-[10px] uppercase text-neutral-500 tracking-wider font-bold">Vertices</span>
                            <span className="text-xs font-mono text-white text-right">{data.vertices.length.toLocaleString()}</span>
                            <span className="text-[10px] uppercase text-neutral-500 tracking-wider font-bold">Faces</span>
                            <span className="text-xs font-mono text-white text-right">{data.faces.length.toLocaleString()}</span>
                        </div>
                    </div>
                )}

                {/* 3D Canvas */}
                <div className="flex-1 w-full relative">
                    {error ? (
                        <div className="absolute inset-0 flex items-center justify-center p-10 text-center">
                            <div className="max-w-md bg-red-900/20 border border-red-500/50 p-6 rounded-2xl">
                                <p className="text-red-400 font-medium">{error}</p>
                                <code className="text-xs block mt-4 p-2 bg-black/50 rounded text-neutral-400">/public/script/mean.js</code>
                            </div>
                        </div>
                    ) : data ? (
                        <Canvas shadows gl={{ antialias: true }}>
                            <PerspectiveCamera makeDefault position={[0, 1.2, 3]} fov={45} />
                            <OrbitControls
                                enableDamping
                                dampingFactor={0.05}
                                target={[0, 1.1, 0]}
                                minDistance={1.5}
                                maxDistance={5}
                                maxPolarAngle={Math.PI / 1.7}
                            />

                            {/* Lighting */}
                            <ambientLight intensity={0.4} />
                            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
                            <pointLight position={[-10, -10, -10]} intensity={0.5} />
                            <hemisphereLight intensity={0.5} color="#ffffff" groundColor="#000000" />

                            <Suspense fallback={null}>
                                <MeanShapeMesh vertices={data.vertices} faces={data.faces} wireframe={wireframe} />
                                <Grid
                                    infiniteGrid
                                    fadeDistance={10}
                                    cellColor="#333"
                                    sectionColor="#444"
                                    sectionSize={1}
                                    cellSize={0.2}
                                    position={[0, -0.01, 0]}
                                />
                                <Environment preset="city" />
                            </Suspense>

                            <fog attach="fog" args={["#0a0a0a", 5, 15]} />
                        </Canvas>
                    ) : (
                        <Loader />
                    )}
                </div>
            </div>
        </div>
    );
}
