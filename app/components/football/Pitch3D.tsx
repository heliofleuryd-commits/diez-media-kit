'use client';

import React, { useRef, useMemo, Suspense, Component, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { getPlayerPos, getBallPos, getBallOwner } from '@/lib/football/animation';
import type { SceneState, AnimationAction } from '@/lib/football/types';

// ─── Error boundary: shows a message instead of white-screening ───────────────
class CanvasErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null };
  static getDerivedStateFromError(err: Error) { return { error: err.message }; }
  render() {
    if (this.state.error) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#050810] gap-3">
          <span className="text-white/50 text-xs">3D rendering failed</span>
          <span className="text-white/20 text-[9px] font-mono max-w-xs text-center">{this.state.error}</span>
          <button
            className="text-[9px] text-violet-400 hover:text-violet-300 border border-violet-400/30 px-3 py-1 rounded"
            onClick={() => this.setState({ error: null })}
          >Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── World space ──────────────────────────────────────────────────────────────
const W = 10, D = 15;
function normToWorld(nx: number, ny: number): [number, number] {
  return [(nx / 100) * W - W / 2, (ny / 100) * D - D / 2];
}

// ─── Canvas-texture label (no CDN fonts, always works) ─────────────────────
function useLabelTexture(text: string) {
  return useMemo(() => {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    // transparent bg
    ctx.clearRect(0, 0, size, size);
    // stroke for outline
    ctx.font = `bold ${size * 0.42}px "Arial Black", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.1;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.strokeText(text, size / 2, size / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, size / 2, size / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [text]);
}

// ─── Pitch floor ──────────────────────────────────────────────────────────────
function PitchFloor() {
  const stripes = 10;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#1e7a1e" roughness={0.9} metalness={0} />
      </mesh>
      {Array.from({ length: stripes }).map((_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.001, -D / 2 + (i + 0.5) * (D / stripes)]}
        >
          <planeGeometry args={[W, D / stripes - 0.02]} />
          <meshStandardMaterial color={i % 2 ? '#175d17' : '#1e7a1e'} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Pitch markings ───────────────────────────────────────────────────────────
function LineRect({ x1, z1, x2, z2 }: { x1:number; z1:number; x2:number; z2:number }) {
  const y = 0.005, t = 0.04;
  const w = Math.abs(x2 - x1), d = Math.abs(z2 - z1);
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const segs = [
    { x: cx, z: z1, w, d: t }, { x: cx, z: z2, w, d: t },
    { x: x1, z: cz, w: t, d }, { x: x2, z: cz, w: t, d },
  ];
  return (
    <>
      {segs.map((s, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[s.x, y, s.z]}>
          <planeGeometry args={[s.w, s.d]} />
          <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.5} />
        </mesh>
      ))}
    </>
  );
}

function CentreCircle() {
  const line = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 1.5, 0.005, Math.sin(a) * 1.5));
    }
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: '#ffffff' }),
    );
  }, []);
  return <primitive object={line} />;
}

function PitchMarkings() {
  return (
    <group>
      <LineRect x1={-W/2} z1={-D/2} x2={W/2} z2={D/2} />
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.005,0]}>
        <planeGeometry args={[W, 0.04]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.5} />
      </mesh>
      <CentreCircle />
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.005,0]}>
        <circleGeometry args={[0.07, 16]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.5} />
      </mesh>
      <LineRect x1={-2.25} z1={-D/2} x2={2.25} z2={-D/2+2.6} />
      <LineRect x1={-2.25} z1={D/2-2.6} x2={2.25} z2={D/2} />
      <LineRect x1={-1.1} z1={-D/2} x2={1.1} z2={-D/2+1.1} />
      <LineRect x1={-1.1} z1={D/2-1.1} x2={1.1} z2={D/2} />
      {([-1, 1] as const).map(s => (
        <mesh key={s} rotation={[-Math.PI/2,0,0]} position={[0,0.005,s*(D/2-1.8)]}>
          <circleGeometry args={[0.06, 12]} />
          <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Goals ────────────────────────────────────────────────────────────────────
function Goals() {
  return (
    <>
      {([-1, 1] as const).map(side => (
        <group key={side} position={[0, 0, side * D / 2]}>
          {[-0.7, 0.7].map(ox => (
            <mesh key={ox} position={[ox, 0.3, 0]} castShadow>
              <cylinderGeometry args={[0.04, 0.04, 0.6, 10]} />
              <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.4} metalness={0.5} roughness={0.2} />
            </mesh>
          ))}
          <mesh position={[0, 0.62, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.04, 0.04, 1.4, 10]} />
            <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.4} metalness={0.5} roughness={0.2} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ─── Stadium ──────────────────────────────────────────────────────────────────
function Stadium() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#050810" roughness={1} />
      </mesh>
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[25, 25, 12, 48, 1, true]} />
        <meshStandardMaterial color="#0a0d1a" side={THREE.BackSide} roughness={1} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <torusGeometry args={[16, 3.5, 6, 48]} />
        <meshStandardMaterial color="#0d1020" roughness={1} />
      </mesh>
      {([[-9,-13],[9,-13],[-9,13],[9,13]] as [number,number][]).map(([tx,tz],i) => (
        <group key={i}>
          <mesh position={[tx, 5, tz]}>
            <boxGeometry args={[0.25, 10, 0.25]} />
            <meshStandardMaterial color="#1a1f30" roughness={0.8} />
          </mesh>
          {/* lamp housing */}
          <mesh position={[tx, 9, tz]}>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshStandardMaterial color="#ffe8a0" emissive="#ffe8a0" emissiveIntensity={10} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Lighting ─────────────────────────────────────────────────────────────────
function Lighting() {
  return (
    <>
      <ambientLight color="#1e2a50" intensity={1.2} />
      <directionalLight
        position={[-8, 16, -12]}
        color="#fff8e8"
        intensity={2.5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <directionalLight position={[8, 14, 12]} color="#fff0d0" intensity={1.8} />
      {/* Rim/fill */}
      <pointLight position={[0, 8, 0]} color="#3050a0" intensity={15} distance={25} decay={2} />
    </>
  );
}

// ─── Player token ─────────────────────────────────────────────────────────────
interface TokenProps {
  pid: string;
  primaryColor: string;
  ringColor: string;
  label: string;
  clockRef: React.MutableRefObject<number>;
  scene: SceneState;
  actions: AnimationAction[];
}

function PlayerToken3D({ pid, primaryColor, ringColor, label, clockRef, scene, actions }: TokenProps) {
  const groupRef   = useRef<THREE.Group>(null!);
  const dotRef     = useRef<THREE.Mesh>(null!);
  const glowMatRef = useRef<THREE.MeshStandardMaterial>(null!);
  const labelTex   = useLabelTexture(label);

  const [ix, iz] = useMemo(() => {
    const [team, slotId] = pid.split('.');
    const slot = scene.teams[team as 'home' | 'away']?.slots.find(s => s.slotId === slotId);
    return normToWorld(slot?.position[0] ?? 50, slot?.position[1] ?? 50);
  }, [pid, scene]);

  useFrame(() => {
    if (!groupRef.current) return;
    const frame = Math.floor(clockRef.current * 30);
    const [wx, wz] = normToWorld(...getPlayerPos(pid, frame, scene, actions));
    groupRef.current.position.x = wx;
    groupRef.current.position.z = wz;
    const hasBall = getBallOwner(frame, scene, actions) === pid;
    if (dotRef.current) dotRef.current.visible = hasBall;
    if (glowMatRef.current) glowMatRef.current.emissiveIntensity = hasBall ? 4 : 2.5;
  });

  return (
    <group ref={groupRef} position={[ix, 0, iz]}>
      {/* Floor glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <ringGeometry args={[0.21, 0.38, 32]} />
        <meshStandardMaterial ref={glowMatRef} color={ringColor} emissive={ringColor} emissiveIntensity={2.5} transparent opacity={0.8} />
      </mesh>
      {/* Disc */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.21, 0.21, 0.13, 24]} />
        <meshStandardMaterial color={primaryColor} metalness={0.65} roughness={0.2} />
      </mesh>
      {/* Neon ring */}
      <mesh position={[0, 0.1, 0]}>
        <torusGeometry args={[0.21, 0.045, 10, 32]} />
        <meshStandardMaterial color={ringColor} emissive={ringColor} emissiveIntensity={5} />
      </mesh>
      {/* Shiny top */}
      <mesh position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.135, 24]} />
        <meshStandardMaterial color={primaryColor} metalness={0.95} roughness={0.04} />
      </mesh>
      {/* Label sprite (canvas texture – no CDN font) */}
      <sprite position={[0, 0.2, 0]} scale={[0.28, 0.28, 1]}>
        <spriteMaterial map={labelTex} transparent depthTest={false} />
      </sprite>
      {/* Ball indicator */}
      <mesh ref={dotRef} position={[0, 0.33, 0]}>
        <sphereGeometry args={[0.065, 10, 10]} />
        <meshStandardMaterial color="#ffe566" emissive="#ffe566" emissiveIntensity={8} />
      </mesh>
    </group>
  );
}

// ─── Ball ─────────────────────────────────────────────────────────────────────
function Ball3D({ clockRef, scene, actions }: {
  clockRef: React.MutableRefObject<number>;
  scene: SceneState;
  actions: AnimationAction[];
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const meshRef  = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    const frame = Math.floor(clockRef.current * 30);
    const [wx, wz] = normToWorld(...getBallPos(frame, scene, actions));
    if (groupRef.current) {
      groupRef.current.position.x = wx;
      groupRef.current.position.z = wz;
    }
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.07;
      meshRef.current.rotation.z += 0.04;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <circleGeometry args={[0.13, 16]} />
        <meshStandardMaterial color="#000" opacity={0.5} transparent depthWrite={false} />
      </mesh>
      {/* Soft glow corona */}
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.2, 12, 12]} />
        <meshStandardMaterial color="#fffae0" emissive="#ffe088" emissiveIntensity={1.2} transparent opacity={0.2} depthWrite={false} />
      </mesh>
      {/* Ball */}
      <mesh ref={meshRef} position={[0, 0.12, 0]} castShadow>
        <sphereGeometry args={[0.12, 20, 20]} />
        <meshStandardMaterial color="#f5f5f5" roughness={0.25} metalness={0.05} emissive="#fffde8" emissiveIntensity={0.6} />
      </mesh>
      {/* Ball light */}
      <pointLight position={[0, 0.12, 0]} color="#ffe8a0" intensity={4} distance={3.5} decay={2} />
    </group>
  );
}

// ─── Internal animation clock (drives everything, no React state) ─────────────
function SceneClock({ playing, dur, clockRef }: { playing: boolean; dur: number; clockRef: React.MutableRefObject<number> }) {
  useFrame((_, delta) => {
    if (playing) clockRef.current = (clockRef.current + delta) % dur;
  });
  return null;
}

// ─── Main 3D scene ────────────────────────────────────────────────────────────
function Scene3D({ scene, actions, durationSeconds, playing }: {
  scene: SceneState;
  actions: AnimationAction[];
  durationSeconds: number;
  playing: boolean;
}) {
  const clockRef = useRef(0);

  return (
    <>
      <SceneClock playing={playing} dur={durationSeconds} clockRef={clockRef} />

      <Lighting />
      <Stars radius={40} depth={25} count={1200} factor={3} saturation={0.25} fade speed={0.3} />

      <Stadium />
      <PitchFloor />
      <PitchMarkings />
      <Goals />

      {scene.teams.home.slots.map(slot => (
        <PlayerToken3D
          key={`home.${slot.slotId}`}
          pid={`home.${slot.slotId}`}
          primaryColor={scene.teams.home.secondaryColor}
          ringColor={scene.teams.home.primaryColor}
          label={slot.slotId}
          clockRef={clockRef}
          scene={scene}
          actions={actions}
        />
      ))}

      {scene.teams.away?.slots.map(slot => (
        <PlayerToken3D
          key={`away.${slot.slotId}`}
          pid={`away.${slot.slotId}`}
          primaryColor={scene.teams.away!.secondaryColor}
          ringColor={scene.teams.away!.primaryColor}
          label={slot.slotId}
          clockRef={clockRef}
          scene={scene}
          actions={actions}
        />
      ))}

      <Ball3D clockRef={clockRef} scene={scene} actions={actions} />

      <OrbitControls
        minDistance={5}
        maxDistance={32}
        maxPolarAngle={Math.PI / 2.1}
        enableDamping
        dampingFactor={0.06}
        target={[0, 0, 0]}
      />
    </>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────
export function Pitch3D({
  scene,
  actions = [],
  durationSeconds = 6,
  playing = true,
  frame: _frame = 0,
}: {
  scene: SceneState;
  actions?: AnimationAction[];
  durationSeconds?: number;
  playing?: boolean;
  frame?: number;
}) {
  return (
    <div className="w-full h-full relative" style={{ background: '#050810' }}>
      <CanvasErrorBoundary>
        <Canvas
          shadows
          camera={{ position: [0, 14, 13], fov: 40, near: 0.1, far: 120 }}
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.1;
          }}
          dpr={[1, 1.5]}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Background/fog always set — not inside Suspense */}
          <color attach="background" args={['#050810']} />
          <fog attach="fog" args={['#050810', 22, 55]} />
          <Suspense fallback={null}>
            <Scene3D
              scene={scene}
              actions={actions}
              durationSeconds={durationSeconds}
              playing={playing}
            />
          </Suspense>
        </Canvas>
      </CanvasErrorBoundary>
      <div className="absolute bottom-2 right-3 text-[9px] text-white/20 font-mono pointer-events-none select-none">
        Drag · Scroll zoom
      </div>
    </div>
  );
}
