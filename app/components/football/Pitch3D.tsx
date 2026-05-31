'use client';

import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Trail, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { getPlayerPos, getBallPos, getBallOwner } from '@/lib/football/animation';
import type { SceneState, AnimationAction } from '@/lib/football/types';

// World dimensions: 0-100 normalized → -10..10 (x), -15..15 (z)
const W = 10, D = 15;

function normToWorld(nx: number, ny: number): [number, number] {
  return [(nx / 100) * W - W / 2, (ny / 100) * D - D / 2];
}

// ── Pitch surface ─────────────────────────────────────────────────────────────
const GRASS_LIGHT = '#1e7a1e';
const GRASS_DARK  = '#175d17';
const LINE_COLOR  = '#ffffff';

function PitchFloor() {
  const stripes = 10;
  return (
    <group>
      {/* Base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color={GRASS_LIGHT} roughness={1} metalness={0} />
      </mesh>
      {/* Stripes */}
      {Array.from({ length: stripes }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, -D / 2 + (i + 0.5) * (D / stripes)]}>
          <planeGeometry args={[W, D / stripes - 0.01]} />
          <meshStandardMaterial color={i % 2 ? GRASS_DARK : GRASS_LIGHT} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function LineRect({ x1, z1, x2, z2, y = 0.003 }: { x1: number; z1: number; x2: number; z2: number; y?: number }) {
  const t = 0.03;
  const w = Math.abs(x2 - x1);
  const d = Math.abs(z2 - z1);
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  const sides = [
    { x: cx, z: z1, w, d: t },
    { x: cx, z: z2, w, d: t },
    { x: x1, z: cz, w: t, d },
    { x: x2, z: cz, w: t, d },
  ];
  return (
    <>
      {sides.map((s, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[s.x, y, s.z]}>
          <planeGeometry args={[s.w, s.d]} />
          <meshStandardMaterial color={LINE_COLOR} emissive={LINE_COLOR} emissiveIntensity={0.4} />
        </mesh>
      ))}
    </>
  );
}

function CircleLine3D({ cx = 0, cz = 0, r, y = 0.003, segments = 64 }: { cx?: number; cz?: number; r: number; y?: number; segments?: number }) {
  const line = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: LINE_COLOR });
    return new THREE.Line(geo, mat);
  }, [cx, cz, r, segments]);
  return <primitive object={line} position={[0, y, 0]} />;
}

function PitchMarkings() {
  const t = 0.003;
  const penW = 4.5, penD = 2.6;
  const goalW = 2.2, goalD = 1.1;
  const centerR = 1.5;

  return (
    <group>
      {/* Boundary */}
      <LineRect x1={-W / 2} z1={-D / 2} x2={W / 2} z2={D / 2} />
      {/* Half line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, t, 0]}>
        <planeGeometry args={[W, 0.04]} />
        <meshStandardMaterial color={LINE_COLOR} emissive={LINE_COLOR} emissiveIntensity={0.4} />
      </mesh>
      {/* Centre circle */}
      <CircleLine3D r={centerR} />
      {/* Centre spot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, t, 0]}>
        <circleGeometry args={[0.07, 16]} />
        <meshStandardMaterial color={LINE_COLOR} emissive={LINE_COLOR} emissiveIntensity={0.4} />
      </mesh>
      {/* Penalty boxes */}
      <LineRect x1={-penW / 2} z1={-D / 2} x2={penW / 2} z2={-D / 2 + penD} />
      <LineRect x1={-penW / 2} z1={D / 2 - penD} x2={penW / 2} z2={D / 2} />
      {/* Goal areas */}
      <LineRect x1={-goalW / 2} z1={-D / 2} x2={goalW / 2} z2={-D / 2 + goalD} />
      <LineRect x1={-goalW / 2} z1={D / 2 - goalD} x2={goalW / 2} z2={D / 2} />
      {/* Penalty spots */}
      {([-1, 1] as const).map(s => (
        <mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[0, t, s * (D / 2 - 1.8)]}>
          <circleGeometry args={[0.05, 12]} />
          <meshStandardMaterial color={LINE_COLOR} emissive={LINE_COLOR} emissiveIntensity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

// ── Goals ────────────────────────────────────────────────────────────────────
function Goals() {
  return (
    <>
      {([-1, 1] as const).map(side => (
        <group key={side} position={[0, 0, side * D / 2]}>
          {[-0.7, 0.7].map(ox => (
            <mesh key={ox} position={[ox, 0.25, 0]} castShadow>
              <cylinderGeometry args={[0.04, 0.04, 0.5, 10]} />
              <meshStandardMaterial color="#ffffff" metalness={0.6} roughness={0.2} emissive="#ffffff" emissiveIntensity={0.3} />
            </mesh>
          ))}
          <mesh position={[0, 0.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 1.4, 10]} />
            <meshStandardMaterial color="#ffffff" metalness={0.6} roughness={0.2} emissive="#ffffff" emissiveIntensity={0.3} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ── Stadium ──────────────────────────────────────────────────────────────────
function Stadium() {
  return (
    <group>
      {/* Dark ground extending beyond pitch */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#060810" roughness={1} />
      </mesh>
      {/* Outer stadium wall (inverted cylinder) */}
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[22, 22, 8, 48, 1, true]} />
        <meshStandardMaterial color="#0c0f18" side={THREE.BackSide} roughness={1} />
      </mesh>
      {/* Stands silhouette - torus step at medium height */}
      <mesh position={[0, 1, 0]}>
        <torusGeometry args={[14, 2.5, 6, 48]} />
        <meshStandardMaterial color="#0e1220" roughness={1} />
      </mesh>
      {/* Corner light towers */}
      {([[-W / 2 - 3, -D / 2 - 3], [W / 2 + 3, -D / 2 - 3], [-W / 2 - 3, D / 2 + 3], [W / 2 + 3, D / 2 + 3]] as [number, number][]).map(([tx, tz], i) => (
        <mesh key={i} position={[tx, 4, tz]} castShadow>
          <boxGeometry args={[0.3, 8, 0.3]} />
          <meshStandardMaterial color="#1a1f2e" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// ── Lighting ─────────────────────────────────────────────────────────────────
function StadiumLight({ tx, tz }: { tx: number; tz: number }) {
  const lightRef = useRef<THREE.SpotLight>(null!);
  const targetRef = useRef<THREE.Object3D>(null!);

  useFrame(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current;
    }
  });

  return (
    <group>
      <object3D ref={targetRef} position={[0, 0, 0]} />
      <spotLight
        ref={lightRef}
        position={[tx, 16, tz]}
        intensity={180}
        angle={0.55}
        penumbra={0.3}
        color="#fff8e8"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <mesh position={[tx, 8.1, tz]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#fffbe0" emissive="#fffbe0" emissiveIntensity={8} />
      </mesh>
    </group>
  );
}

function StadiumLights() {
  const towers: [number, number][] = [
    [-W / 2 - 3, -D / 2 - 3],
    [W / 2 + 3,  -D / 2 - 3],
    [-W / 2 - 3,  D / 2 + 3],
    [W / 2 + 3,   D / 2 + 3],
  ];
  return (
    <>
      <ambientLight color="#1a2240" intensity={0.6} />
      <hemisphereLight args={['#1a2240', '#0a0e14', 0.4]} />
      {towers.map(([tx, tz], i) => <StadiumLight key={i} tx={tx} tz={tz} />)}
    </>
  );
}

// ── Player token ─────────────────────────────────────────────────────────────
function PlayerToken3D({ pid, primaryColor, ringColor, label, hasBall, frame, scene, actions }: {
  pid: string; primaryColor: string; ringColor: string; label: string;
  hasBall: boolean; frame: number; scene: SceneState; actions: AnimationAction[];
}) {
  const groupRef = useRef<THREE.Group>(null!);

  const initialPos = useMemo((): [number, number] => {
    const [team, slotId] = pid.split('.');
    const t = scene.teams[team as 'home' | 'away'];
    const slot = t?.slots.find(s => s.slotId === slotId);
    return normToWorld(slot?.position[0] ?? 50, slot?.position[1] ?? 50);
  }, [pid, scene]);

  useFrame(() => {
    if (!groupRef.current) return;
    const pos = actions.length > 0
      ? getPlayerPos(pid, frame, scene, actions)
      : (() => {
          const [team, slotId] = pid.split('.');
          const t = scene.teams[team as 'home' | 'away'];
          return t?.slots.find(s => s.slotId === slotId)?.position ?? [50, 50] as [number, number];
        })();
    const [wx, wz] = normToWorld(pos[0], pos[1]);
    groupRef.current.position.x = wx;
    groupRef.current.position.z = wz;
  });

  return (
    <group ref={groupRef} position={[initialPos[0], 0, initialPos[1]]}>
      {/* Glow ring on floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[0.24, 0.38, 32]} />
        <meshStandardMaterial
          color={ringColor}
          emissive={ringColor}
          emissiveIntensity={1.5}
          transparent opacity={0.6}
        />
      </mesh>
      {/* Token disc body */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.1, 24]} />
        <meshStandardMaterial
          color={primaryColor}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>
      {/* Glowing ring around token */}
      <mesh position={[0, 0.1, 0]}>
        <torusGeometry args={[0.24, 0.04, 10, 32]} />
        <meshStandardMaterial
          color={ringColor}
          emissive={ringColor}
          emissiveIntensity={3}
          metalness={0.2}
          roughness={0.1}
        />
      </mesh>
      {/* Ball dot */}
      {hasBall && (
        <mesh position={[0, 0.28, 0]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial color="#ffe566" emissive="#ffe566" emissiveIntensity={5} />
        </mesh>
      )}
      {/* Label text */}
      <Suspense fallback={null}>
        <Text
          position={[0, 0.22, 0]}
          fontSize={0.15}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          font={undefined}
          outlineColor="#000000"
          outlineWidth={0.008}
        >
          {label}
        </Text>
      </Suspense>
    </group>
  );
}

// ── Ball ─────────────────────────────────────────────────────────────────────
function Ball3D({ frame, scene, actions }: { frame: number; scene: SceneState; actions: AnimationAction[] }) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    if (!ref.current) return;
    const pos = getBallPos(frame, scene, actions);
    const [wx, wz] = normToWorld(pos[0], pos[1]);
    ref.current.position.x = wx;
    ref.current.position.z = wz;
    ref.current.rotation.x += 0.05;
    ref.current.rotation.z += 0.02;
  });

  return (
    <Trail
      width={0.5}
      length={12}
      color={new THREE.Color('#ffffff')}
      attenuation={t => t * t * t}
    >
      <mesh ref={ref} position={[0, 0.12, 0]} castShadow>
        <sphereGeometry args={[0.12, 20, 20]} />
        <meshStandardMaterial color="#f5f5f5" roughness={0.35} metalness={0.1} emissive="#ffffff" emissiveIntensity={0.5} />
        {/* Warm glow from the ball */}
        <pointLight color="#ffe0a0" intensity={1.5} distance={2} decay={2} />
      </mesh>
    </Trail>
  );
}

// ── Main scene ───────────────────────────────────────────────────────────────
function Scene3D({ scene, actions, frame }: { scene: SceneState; actions: AnimationAction[]; frame: number }) {
  const ballOwner = getBallOwner(frame, scene, actions);

  return (
    <>
      <fog attach="fog" args={['#05080f', 18, 40]} />
      <color attach="background" args={['#05080f']} />

      <StadiumLights />
      <Stars radius={30} depth={20} count={800} factor={2} saturation={0.5} fade speed={0.5} />

      <Stadium />
      <PitchFloor />
      <PitchMarkings />
      <Goals />

      {/* Home players */}
      {scene.teams.home.slots.map(slot => {
        const pid = `home.${slot.slotId}`;
        return (
          <PlayerToken3D key={pid} pid={pid}
            primaryColor={scene.teams.home.secondaryColor}
            ringColor={scene.teams.home.primaryColor}
            label={slot.slotId}
            hasBall={ballOwner === pid}
            frame={frame} scene={scene} actions={actions}
          />
        );
      })}

      {/* Away players */}
      {scene.teams.away?.slots.map(slot => {
        const pid = `away.${slot.slotId}`;
        return (
          <PlayerToken3D key={pid} pid={pid}
            primaryColor={scene.teams.away!.secondaryColor}
            ringColor={scene.teams.away!.primaryColor}
            label={slot.slotId}
            hasBall={ballOwner === pid}
            frame={frame} scene={scene} actions={actions}
          />
        );
      })}

      <Ball3D frame={frame} scene={scene} actions={actions} />

      <OrbitControls
        minDistance={4} maxDistance={28}
        maxPolarAngle={Math.PI / 2.05}
        enableDamping dampingFactor={0.06}
        target={[0, 0, 0]}
      />

      {/* Extra fill light for bloom-like glow on emissive surfaces */}
      <pointLight position={[0, 5, 0]} color="#ffffff" intensity={0.3} />
    </>
  );
}

// ── Public component ──────────────────────────────────────────────────────────
interface Pitch3DProps {
  scene: SceneState;
  actions?: AnimationAction[];
  durationSeconds?: number;
  playing?: boolean;
  frame?: number;
}

export function Pitch3D({ scene, actions = [], durationSeconds = 6, playing = true, frame = 0 }: Pitch3DProps) {
  return (
    <div className="w-full h-full" style={{ background: '#05080f' }}>
      <Canvas
        shadows="soft"
        camera={{ position: [0, 12, 10], fov: 42, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.3;
        }}
        dpr={[1, 1.5]}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <Scene3D scene={scene} actions={actions} frame={frame} />
        </Suspense>
      </Canvas>
      <div className="absolute bottom-3 left-3 text-[9px] text-white/30 font-mono pointer-events-none select-none">
        Drag orbit · Scroll zoom · Right-drag pan
      </div>
    </div>
  );
}
