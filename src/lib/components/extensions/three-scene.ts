/**
 * Three.js 3D Scene extension.
 * Lightweight 3D scene as background or section. Falls back to static image on SSR.
 *
 * Config options:
 * - preset: "particles" | "globe" | "waves" | "custom"
 * - color: string (primary color, default uses theme accent)
 * - height: string (default "400px")
 * - interactive: boolean (respond to mouse, default true)
 */
import type { SectionContext } from "../types";
import type { ExtensionOutput } from "./types";
import { registerExtension } from "./registry";

function render(_ctx: SectionContext, config: Record<string, unknown>): ExtensionOutput {
  const preset = (config.preset as string) || "particles";
  const color = (config.color as string) || "";
  const height = (config.height as string) || "400px";
  const interactive = config.interactive !== false;

  // Generate the Three.js component as a separate file
  const componentCode = generateThreeComponent(preset, color, interactive);

  return {
    jsx: `
        <div style={{ height: "${height}", position: "relative" }}>
          <ThreeScene />
        </div>`,
    css: "",
    imports: [
      `import dynamic from "next/dynamic";`,
      `const ThreeScene = dynamic(() => import("@/components/ThreeScene"), { ssr: false, loading: () => <div style={{ height: "${height}", background: "var(--color-bg-card)" }} /> });`,
    ],
    dependencies: { three: "^0.170.0", "@react-three/fiber": "^9.1.0", "@react-three/drei": "^10.0.0" },
    files: {
      "src/components/ThreeScene.tsx": componentCode,
    },
  };
}

function generateThreeComponent(preset: string, color: string, interactive: boolean): string {
  const colorExpr = color ? `"${color}"` : `getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim() || "#6366f1"`;

  if (preset === "globe") {
    return `"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import * as THREE from "three";

function Globe() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 0.2; });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1.5, 32, 32]} />
      <meshStandardMaterial color={${colorExpr}} wireframe />
    </mesh>
  );
}

export default function ThreeScene() {
  return (
    <Canvas camera={{ position: [0, 0, 4] }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Globe />
    </Canvas>
  );
}
`;
  }

  if (preset === "waves") {
    return `"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import * as THREE from "three";

function Waves() {
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.PlaneGeometry(10, 10, 64, 64), []);
  useFrame(({ clock }) => {
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      positions.setZ(i, Math.sin(x * 2 + clock.elapsedTime) * 0.3 + Math.cos(y * 2 + clock.elapsedTime * 0.5) * 0.3);
    }
    positions.needsUpdate = true;
  });
  return (
    <mesh ref={ref} geometry={geo} rotation={[-Math.PI / 3, 0, 0]} position={[0, -1, 0]}>
      <meshStandardMaterial color={${colorExpr}} wireframe />
    </mesh>
  );
}

export default function ThreeScene() {
  return (
    <Canvas camera={{ position: [0, 2, 5] }}>
      <ambientLight intensity={0.5} />
      <Waves />
    </Canvas>
  );
}
`;
  }

  // Default: particles
  return `"use client";
import { Canvas, useFrame${interactive ? ", useThree" : ""} } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import * as THREE from "three";

function Particles() {
  const ref = useRef<THREE.Points>(null);
  const count = 500;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) arr[i] = (Math.random() - 0.5) * 8;
    return arr;
  }, []);
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 0.05; });
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial size={0.03} color={${colorExpr}} sizeAttenuation />
    </points>
  );
}

export default function ThreeScene() {
  return (
    <Canvas camera={{ position: [0, 0, 4] }}>
      <ambientLight intensity={0.3} />
      <Particles />
    </Canvas>
  );
}
`;
}

registerExtension({
  id: "three-scene",
  label: "3D Scene",
  type: "background",
  render,
});
