'use client';

import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame, type ThreeElements } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Text } from '@react-three/drei';
import type * as THREE from 'three';

const Group = 'group' as unknown as React.ComponentType<ThreeElements['group']>;
const Mesh = 'mesh' as unknown as React.ComponentType<ThreeElements['mesh']>;
const BoxGeometry = 'boxGeometry' as unknown as React.ComponentType<ThreeElements['boxGeometry']>;
const SphereGeometry = 'sphereGeometry' as unknown as React.ComponentType<ThreeElements['sphereGeometry']>;
const CylinderGeometry = 'cylinderGeometry' as unknown as React.ComponentType<ThreeElements['cylinderGeometry']>;
const TorusGeometry = 'torusGeometry' as unknown as React.ComponentType<ThreeElements['torusGeometry']>;
const ConeGeometry = 'coneGeometry' as unknown as React.ComponentType<ThreeElements['coneGeometry']>;
const MeshStandardMaterial = 'meshStandardMaterial' as unknown as React.ComponentType<ThreeElements['meshStandardMaterial']>;
const AmbientLight = 'ambientLight' as unknown as React.ComponentType<ThreeElements['ambientLight']>;
const DirectionalLight = 'directionalLight' as unknown as React.ComponentType<ThreeElements['directionalLight']>;
const PointLight = 'pointLight' as unknown as React.ComponentType<ThreeElements['pointLight']>;

// ─── Shape primitives the LLM can request ────────────────────────────────────

export type ThreeShape =
  | { kind: 'box'; width?: number; height?: number; depth?: number; color?: string; x?: number; y?: number; z?: number; label?: string }
  | { kind: 'sphere'; radius?: number; color?: string; x?: number; y?: number; z?: number; label?: string }
  | { kind: 'cylinder'; radiusTop?: number; radiusBottom?: number; height?: number; color?: string; x?: number; y?: number; z?: number; label?: string }
  | { kind: 'torus'; radius?: number; tube?: number; color?: string; x?: number; y?: number; z?: number; label?: string }
  | { kind: 'cone'; radius?: number; height?: number; color?: string; x?: number; y?: number; z?: number; label?: string };

export interface ThreeViewerProps {
  shapes?: ThreeShape[];
  title?: string;
  showGrid?: boolean;
  background?: string;
}

function RotatingBox({ width = 1, height = 1, depth = 1, color = '#6366f1', x = 0, y = 0, z = 0, label }: Extract<ThreeShape, { kind: 'box' }>) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((_, delta) => { ref.current.rotation.y += delta * 0.4; });
  return (
    <Group position={[x, y, z]}>
      <Mesh ref={ref}>
        <BoxGeometry args={[width, height, depth]} />
        <MeshStandardMaterial color={color} />
      </Mesh>
      {label && <Text position={[0, height / 2 + 0.3, 0]} fontSize={0.18} color="white">{label}</Text>}
    </Group>
  );
}

function RotatingSphere({ radius = 0.7, color = '#f59e0b', x = 0, y = 0, z = 0, label }: Extract<ThreeShape, { kind: 'sphere' }>) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((_, delta) => { ref.current.rotation.y += delta * 0.3; });
  return (
    <Group position={[x, y, z]}>
      <Mesh ref={ref}>
        <SphereGeometry args={[radius, 32, 32]} />
        <MeshStandardMaterial color={color} />
      </Mesh>
      {label && <Text position={[0, radius + 0.3, 0]} fontSize={0.18} color="white">{label}</Text>}
    </Group>
  );
}

function RotatingCylinder({ radiusTop = 0.5, radiusBottom = 0.5, height = 1.5, color = '#10b981', x = 0, y = 0, z = 0, label }: Extract<ThreeShape, { kind: 'cylinder' }>) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((_, delta) => { ref.current.rotation.y += delta * 0.35; });
  return (
    <Group position={[x, y, z]}>
      <Mesh ref={ref}>
        <CylinderGeometry args={[radiusTop, radiusBottom, height, 32]} />
        <MeshStandardMaterial color={color} />
      </Mesh>
      {label && <Text position={[0, height / 2 + 0.3, 0]} fontSize={0.18} color="white">{label}</Text>}
    </Group>
  );
}

function RotatingTorus({ radius = 0.7, tube = 0.25, color = '#ec4899', x = 0, y = 0, z = 0, label }: Extract<ThreeShape, { kind: 'torus' }>) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((_, delta) => {
    ref.current.rotation.x += delta * 0.3;
    ref.current.rotation.y += delta * 0.2;
  });
  return (
    <Group position={[x, y, z]}>
      <Mesh ref={ref}>
        <TorusGeometry args={[radius, tube, 16, 64]} />
        <MeshStandardMaterial color={color} />
      </Mesh>
      {label && <Text position={[0, radius + tube + 0.3, 0]} fontSize={0.18} color="white">{label}</Text>}
    </Group>
  );
}

function RotatingCone({ radius = 0.5, height = 1.5, color = '#f43f5e', x = 0, y = 0, z = 0, label }: Extract<ThreeShape, { kind: 'cone' }>) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((_, delta) => { ref.current.rotation.y += delta * 0.4; });
  return (
    <Group position={[x, y, z]}>
      <Mesh ref={ref}>
        <ConeGeometry args={[radius, height, 32]} />
        <MeshStandardMaterial color={color} />
      </Mesh>
      {label && <Text position={[0, height / 2 + 0.3, 0]} fontSize={0.18} color="white">{label}</Text>}
    </Group>
  );
}

function ShapeRenderer({ shape }: { shape: ThreeShape }) {
  switch (shape.kind) {
    case 'box': return <RotatingBox {...shape} />;
    case 'sphere': return <RotatingSphere {...shape} />;
    case 'cylinder': return <RotatingCylinder {...shape} />;
    case 'torus': return <RotatingTorus {...shape} />;
    case 'cone': return <RotatingCone {...shape} />;
  }
}

const DEFAULT_SHAPES: ThreeShape[] = [
  { kind: 'box', color: '#6366f1', x: -1.5, label: 'Box' },
  { kind: 'sphere', color: '#f59e0b', x: 0, label: 'Sphere' },
  { kind: 'torus', color: '#ec4899', x: 1.5, label: 'Torus' },
];

export function ThreeViewer({
  shapes = DEFAULT_SHAPES,
  title,
  showGrid = true,
  background = '#0d0d14',
}: ThreeViewerProps) {
  return (
    <div style={{
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.08)',
      background,
    }}>
      {title && (
        <div style={{
          padding: '8px 14px',
          fontSize: 13,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.75)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.02)',
        }}>
          {title}
        </div>
      )}
      <Canvas
        style={{ height: 340 }}
        camera={{ position: [0, 2, 6], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => { gl.setClearColor(background, 1); }}
      >
        <Suspense fallback={null}>
          <AmbientLight intensity={0.5} />
          <DirectionalLight position={[5, 10, 5]} intensity={1} />
          <PointLight position={[-5, -5, -5]} intensity={0.3} />
          <Environment preset="city" />
          {shapes.map((shape, index) => (
            <ShapeRenderer key={`${shape.kind}-${shape.label ?? 'shape'}-${shape.x ?? 0}-${shape.y ?? 0}-${shape.z ?? 0}-${index}`} shape={shape} />
          ))}
          {showGrid && (
            <Grid
              renderOrder={-1}
              position={[0, -1.2, 0]}
              infiniteGrid
              cellSize={1}
              cellThickness={0.5}
              sectionSize={3}
              sectionThickness={1}
              fadeDistance={20}
              cellColor="#222"
              sectionColor="#333"
            />
          )}
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        </Suspense>
      </Canvas>
      <div style={{
        padding: '5px 12px',
        fontSize: 12,
        color: 'rgba(255,255,255,0.25)',
        textAlign: 'right',
      }}>
        Drag to orbit · Scroll to zoom · Right-click to pan
      </div>
    </div>
  );
}
