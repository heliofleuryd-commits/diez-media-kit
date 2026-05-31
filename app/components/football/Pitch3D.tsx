'use client';

import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Trail, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { getPlayerPos, getBallPos, getBallOwner } from '@/lib/football/animation';
import type { SceneState, AnimationAction } from '@/lib/football/types';

// World space: pitch is W×D centred at origin, players move in XZ plane
const W = 10, D = 15;
function normToWorld(nx: number, ny: number): [number, number] {
  return [(nx / 100) * W - W / 2, (ny / 100) * D - D / 2];
}

// ─── Pitch floor ──────────────────────────────────────────────────────────────
function PitchFloor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#1e7a1e" roughness={0.9} metalness={0} />
      </mesh>
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.001, -D / 2 + (i + 0.5) * (D / 10)]}>
          <planeGeometry args={[W, D / 10 - 0.015]} />
          <meshStandardMaterial color={i % 2 ? '#175d17' : '#1e7a1e'} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Pitch markings ───────────────────────────────────────────────────────────
const LM = '#ffffff';

function LineRect({ x1, z1, x2, z2 }: { x1: number; z1: number; x2: number; z2: number }) {
  const y = 0.005, t = 0.04;
  const w = Math.abs(x2 - x1), d = Math.abs(z2 - z1);
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  return (
    <>
      {[
        { x: cx, z: z1, w, d: t }, { x: cx, z: z2, w, d: t },
        { x: x1, z: cz, w: t, d }, { x: x2, z: cz, w: t, d },
      ].map((s, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[s.x, y, s.z]}>
          <planeGeometry args={[s.w, s.d]} />
          <meshStandardMaterial color={LM} emissive={LM} emissiveIntensity={0.6} />
        </mesh>
      ))}
    </>
  );
}

function CircleLine3D({ cx = 0, cz = 0, r }: { cx?: number; cz?: number; r: number }) {
  const obj = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2;
      pts.push(new THREE.Vector3(cx + Math.cos(a) * r, 0.005, cz + Math.sin(a) * r));
    }
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: LM }),
    );
  }, [cx, cz, r]);
  return <primitive object={obj} />;
}

function PitchMarkings() {
  return (
    <group>
      <LineRect x1={-W / 2} z1={-D / 2} x2={W / 2} z2={D / 2} />
      {/* Halfway line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[W, 0.04]} />
        <meshStandardMaterial color={LM} emissive={LM} emissiveIntensity={0.6} />
      </mesh>
      <CircleLine3D r={1.5} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <circleGeometry args={[0.07, 20]} />
        <meshStandardMaterial color={LM} emissive={LM} emissiveIntensity={0.6} />
      </mesh>
      {/* Penalty boxes */}
      <LineRect x1={-2.25} z1={-D / 2} x2={2.25} z2={-D / 2 + 2.6} />
      <LineRect x1={-2.25} z1={D / 2 - 2.6} x2={2.25} z2={D / 2} />
      {/* Goal areas */}
      <LineRect x1={-1.1} z1={-D / 2} x2={1.1} z2={-D / 2 + 1.1} />
      <LineRect x1={-1.1} z1={D / 2 - 1.1} x2={1.1} z2={D / 2} />
      {/* Penalty spots */}
      {([-1, 1] as const).map(s => (
        <mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, s * (D / 2 - 1.8)]}>
          <circleGeometry args={[0.06, 14]} />
          <meshStandardMaterial color={LM} emissive={LM} emissiveIntensity={0.6} />
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
              <cylinderGeometry args={[0.04, 0.04, 0.6, 12]} />
              <meshStandardMaterial color="#fff" metalness={0.6} roughness={0.2} emissive="#fff" emissiveIntensity={0.4} />
            </mesh>
          ))}
          <mesh position={[0, 0.62, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 1.4, 12]} />
            <meshStandardMaterial color="#fff" metalness={0.6} roughness={0.2} emissive="#fff" emissiveIntensity={0.4} />
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
      {/* Ground apron */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#050810" roughness={1} />
      </mesh>
      {/* Curved outer wall */}
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[25, 25, 11, 56, 1, true]} />
        <meshStandardMaterial color="#0b0d1a" side={THREE.BackSide} roughness={1} />
      </mesh>
      {/* Stands tier */}
      <mesh position={[0, 1.2, 0]}>
        <torusGeometry args={[16, 3.5, 6, 56]} />
        <meshStandardMaterial color="#0d1020" roughness={1} />
      </mesh>
      {/* Corner light towers */}
      {([[-9, -13], [9, -13], [-9, 13], [9, 13]] as [number, number][]).map(([tx, tz], i) => (
        <mesh key={i} position={[tx, 5, tz]}>
          <boxGeometry args={[0.28, 10, 0.28]} />
          <meshStandardMaterial color="#1a1f30" roughness={0.8} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Lighting ─────────────────────────────────────────────────────────────────
function Lighting() {
  const towers = [[-9, -13], [9, -13], [-9, 13], [9, 13]] as [number, number][];
  return (
    <>
      <ambientLight color="#1e2a4a" intensity={0.9} />
      <hemisphereLight args={['#2a3860', '#080c14', 0.8]} />
      {towers.map(([tx, tz], i) => (
        <group key={i}>
          <pointLight
            position={[tx, 16, tz]}
            color="#fff8e0"
            intensity={280}
            distance={38}
            decay={2}
            castShadow
            shadow-mapSize-width={512}
            shadow-mapSize-height={512}
          />
          {/* Lamp housing glow */}
          <mesh position={[tx, 9, tz]}>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshStandardMaterial color="#ffe8a0" emissive="#ffe8a0" emissiveIntensity={12} />
          </mesh>
        </group>
      ))}
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
  const groupRef  = useRef<THREE.Group>(null!);
  const ballDotRef = useRef<THREE.Mesh>(null!);

  const [ix, iz] = useMemo(() => {
    const [team, slotId] = pid.split('.');
    const t = scene.teams[team as 'home' | 'away'];
    const slot = t?.slots.find(s => s.slotId === slotId);
    return normToWorld(slot?.position[0] ?? 50, slot?.position[1] ?? 50);
  }, [pid, scene]);

  useFrame(() => {
    if (!groupRef.current) return;
    const frame = Math.floor(clockRef.current * 30);
    const pos = getPlayerPos(pid, frame, scene, actions);
    const [wx, wz] = normToWorld(pos[0], pos[1]);
    groupRef.current.position.x = wx;
    groupRef.current.position.z = wz;
    if (ballDotRef.current) {
      ballDotRef.current.visible = getBallOwner(frame, scene, actions) === pid;
    }
  });

  return (
    <group ref={groupRef} position={[ix, 0, iz]}>
      {/* Floor glow ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <ringGeometry args={[0.22, 0.4, 36]} />
        <meshStandardMaterial color={ringColor} emissive={ringColor} emissiveIntensity={2.8} transparent opacity={0.8} />
      </mesh>

      {/* Disc body */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.14, 28]} />
        <meshStandardMaterial color={primaryColor} metalness={0.65} roughness={0.2} />
      </mesh>

      {/* Glowing outer ring */}
      <mesh position={[0, 0.1, 0]}>
        <torusGeometry args={[0.22, 0.048, 12, 36]} />
        <meshStandardMaterial color={ringColor} emissive={ringColor} emissiveIntensity={5} />
      </mesh>

      {/* Shiny top cap */}
      <mesh position={[0, 0.172, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.14, 24]} />
        <meshStandardMaterial color={primaryColor} metalness={0.95} roughness={0.04} />
      </mesh>

      {/* Ball indicator dot (visibility toggled in useFrame) */}
      <mesh ref={ballDotRef} position={[0, 0.32, 0]}>
        <sphereGeometry args={[0.065, 10, 10]} />
        <meshStandardMaterial color="#ffe566" emissive="#ffe566" emissiveIntensity={7} />
      </mesh>

      {/* Position label */}
      <Suspense fallback={null}>
        <Text
          position={[0, 0.215, 0]}
          fontSize={0.13}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineColor="#000000"
          outlineWidth={0.013}
        >
          {label}
        </Text>
      </Suspense>
    </group>
  );
}

// ─── Ball ─────────────────────────────────────────────────────────────────────
function Ball3D({
  clockRef, scene, actions,
}: {
  clockRef: React.MutableRefObject<number>;
  scene: SceneState;
  actions: AnimationAction[];
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const meshRef  = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    const frame = Math.floor(clockRef.current * 30);
    const pos = getBallPos(frame, scene, actions);
    const [wx, wz] = normToWorld(pos[0], pos[1]);
    if (groupRef.current) {
      groupRef.current.position.x = wx;
      groupRef.current.position.z = wz;
    }
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.07;
      meshRef.current.rotation.z += 0.03;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Ground shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[0.14, 18]} />
        <meshStandardMaterial color="#000000" opacity={0.5} transparent depthWrite={false} />
      </mesh>

      {/* Soft glow aura */}
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.21, 12, 12]} />
        <meshStandardMaterial color="#fffae0" emissive="#ffe088" emissiveIntensity={1.0} transparent opacity={0.22} depthWrite={false} />
      </mesh>

      {/* Ball sphere — refs owned by us (Trail uses target prop, not child ref) */}
      <mesh ref={meshRef} position={[0, 0.12, 0]} castShadow>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshStandardMaterial color="#f8f8f8" roughness={0.25} metalness={0.04} emissive="#fffce8" emissiveIntensity={0.55} />
      </mesh>

      {/* drei v10 Trail: uses target prop — no child ref conflict */}
      <Trail
        target={meshRef}
        width={0.55}
        length={10}
        color="#fffae0"
        attenuation={t => t * t * t}
      />

      {/* Warm point light from ball */}
      <pointLight position={[0, 0.12, 0]} color="#ffe8a0" intensity={3.5} distance={3.5} decay={2} />
    </group>
  );
}

// ─── Internal animation clock ─────────────────────────────────────────────────
function SceneClock({
  playing,
  durationSeconds,
  clockRef,
}: {
  playing: boolean;
  durationSeconds: number;
  clockRef: React.MutableRefObject<number>;
}) {
  useFrame((_, delta) => {
    if (!playing) return;
    clockRef.current = (clockRef.current + delta) % durationSeconds;
  });
  return null;
}

// ─── Full 3D scene ────────────────────────────────────────────────────────────
function Scene3D({
  scene, actions, durationSeconds, playing,
}: {
  scene: SceneState;
  actions: AnimationAction[];
  durationSeconds: number;
  playing: boolean;
}) {
  // Mutable clock shared by all animated children via ref (no React re-renders)
  const clockRef = useRef(0);

  return (
    <>
      <SceneClock playing={playing} durationSeconds={durationSeconds} clockRef={clockRef} />

      <fog attach="fog" args={['#050810', 22, 55]} />
      <color attach="background" args={['#050810']} />

      <Lighting />
      <Stars radius={38} depth={28} count={1400} factor={3} saturation={0.3} fade speed={0.35} />

      <Stadium />
      <PitchFloor />
      <PitchMarkings />
      <Goals />

      {/* Home team */}
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

      {/* Away team */}
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

// ─── Public export ────────────────────────────────────────────────────────────
export function Pitch3D({
  scene,
  actions = [],
  durationSeconds = 6,
  playing = true,
  frame: _frame = 0,   // kept for prop-compatibility, clock is internal
}: {
  scene: SceneState;
  actions?: AnimationAction[];
  durationSeconds?: number;
  playing?: boolean;
  frame?: number;
}) {
  return (
    <div className="w-full h-full relative" style={{ background: '#050810' }}>
      <Canvas
        shadows
        camera={{ position: [0, 14, 13], fov: 40, near: 0.1, far: 120 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.25;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
        dpr={[1, 1.5]}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <Scene3D
            scene={scene}
            actions={actions}
            durationSeconds={durationSeconds}
            playing={playing}
          />
        </Suspense>
      </Canvas>
      <div className="absolute bottom-3 right-3 text-[9px] text-white/20 font-mono pointer-events-none select-none">
        Drag to orbit · Scroll to zoom
      </div>
    </div>
  );
}
