'use client';

import React, { useRef, useMemo, Component, type ReactNode, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { getPlayerPos, getBallPos, getBallOwner } from '@/lib/football/animation';
import type { SceneState, AnimationAction } from '@/lib/football/types';

// ─── Error boundary ────────────────────────────────────────────────────────────
class CanvasErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) return (
      <div style={{ width:'100%', height:'100%', background:'#050810', color:'#f87171', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, padding:16 }}>
        <div style={{ fontFamily:'monospace', fontSize:11 }}>3D error: {this.state.error}</div>
        <button onClick={() => this.setState({ error: null })} style={{ fontSize:10, color:'#a78bfa', border:'1px solid #a78bfa', padding:'4px 12px', borderRadius:4, background:'none', cursor:'pointer' }}>Retry</button>
      </div>
    );
    return this.props.children;
  }
}

const W = 10, D = 15;
function n2w(nx: number, ny: number): [number, number] {
  return [(nx / 100) * W - W / 2, (ny / 100) * D - D / 2];
}

// Canvas-texture label — no CDN needed
function makeLabel(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const x = c.getContext('2d')!;
  x.font = 'bold 52px Arial, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 10; x.strokeStyle = '#000'; x.lineJoin = 'round';
  x.strokeText(text, 64, 64);
  x.fillStyle = '#fff';
  x.fillText(text, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ─── Pitch ─────────────────────────────────────────────────────────────────────
function Pitch() {
  const line = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 1.5, 0.01, Math.sin(a) * 1.5));
    }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#fff' }));
  }, []);

  return (
    <group>
      {/* Green surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#1e7a1e" />
      </mesh>
      {/* Stripes */}
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, -D / 2 + (i + 0.5) * 1.5]}>
          <planeGeometry args={[W, 1.48]} />
          <meshStandardMaterial color={i % 2 ? '#175d17' : '#1e7a1e'} />
        </mesh>
      ))}
      {/* Boundary */}
      {[[-W/2,0,D/2],[W/2,0,D/2],[W/2,0,-D/2],[-W/2,0,-D/2],[-W/2,0,D/2]].map(([x,y,z],i,arr) => {
        if (i === arr.length - 1) return null;
        const next = arr[i + 1];
        const mid: [number,number,number] = [(x + next[0]) / 2, 0.01, (z + next[2]) / 2];
        const len = Math.sqrt((next[0]-x)**2 + (next[2]-z)**2);
        const angle = Math.atan2(next[0]-x, next[2]-z);
        return (
          <mesh key={i} position={mid} rotation={[0, angle, 0]}>
            <planeGeometry args={[0.04, len]} />
            <meshStandardMaterial color="#fff" />
          </mesh>
        );
      })}
      {/* Half line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[W, 0.04]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
      {/* Centre circle */}
      <primitive object={line} />
    </group>
  );
}

// ─── Token ─────────────────────────────────────────────────────────────────────
function Token({ pid, primary, ring, label, clockRef, scene, actions }: {
  pid: string; primary: string; ring: string; label: string;
  clockRef: React.MutableRefObject<number>; scene: SceneState; actions: AnimationAction[];
}) {
  const g = useRef<THREE.Group>(null!);
  const dot = useRef<THREE.Mesh>(null!);
  const tex = useMemo(() => makeLabel(label), [label]);
  const [ix, iz] = useMemo(() => {
    const [team, slotId] = pid.split('.');
    const slot = scene.teams[team as 'home'|'away']?.slots.find(s => s.slotId === slotId);
    return n2w(slot?.position[0] ?? 50, slot?.position[1] ?? 50);
  }, [pid, scene]);

  useFrame(() => {
    if (!g.current) return;
    const fr = Math.floor(clockRef.current * 30);
    const [wx, wz] = n2w(...getPlayerPos(pid, fr, scene, actions));
    g.current.position.x = wx;
    g.current.position.z = wz;
    if (dot.current) dot.current.visible = getBallOwner(fr, scene, actions) === pid;
  });

  return (
    <group ref={g} position={[ix, 0, iz]}>
      {/* Floor glow */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.003,0]}>
        <ringGeometry args={[0.2, 0.37, 32]} />
        <meshStandardMaterial color={ring} emissive={ring} emissiveIntensity={3} transparent opacity={0.8} />
      </mesh>
      {/* Body disc */}
      <mesh position={[0,0.08,0]} castShadow>
        <cylinderGeometry args={[0.2,0.2,0.12,24]} />
        <meshStandardMaterial color={primary} metalness={0.6} roughness={0.2} />
      </mesh>
      {/* Neon ring */}
      <mesh position={[0,0.08,0]}>
        <torusGeometry args={[0.2,0.045,10,32]} />
        <meshStandardMaterial color={ring} emissive={ring} emissiveIntensity={5} />
      </mesh>
      {/* Label sprite */}
      <sprite position={[0,0.18,0]} scale={[0.3,0.3,1]}>
        <spriteMaterial map={tex} transparent depthTest={false} />
      </sprite>
      {/* Ball dot */}
      <mesh ref={dot} position={[0,0.3,0]}>
        <sphereGeometry args={[0.06,8,8]} />
        <meshStandardMaterial color="#ffe566" emissive="#ffe566" emissiveIntensity={8} />
      </mesh>
    </group>
  );
}

// ─── Ball ──────────────────────────────────────────────────────────────────────
function Ball({ clockRef, scene, actions }: { clockRef: React.MutableRefObject<number>; scene: SceneState; actions: AnimationAction[] }) {
  const g = useRef<THREE.Group>(null!);
  const m = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    const fr = Math.floor(clockRef.current * 30);
    const [wx, wz] = n2w(...getBallPos(fr, scene, actions));
    if (g.current) { g.current.position.x = wx; g.current.position.z = wz; }
    if (m.current) { m.current.rotation.x += 0.07; m.current.rotation.z += 0.04; }
  });
  return (
    <group ref={g}>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.002,0]}>
        <circleGeometry args={[0.13,16]} />
        <meshStandardMaterial color="#000" opacity={0.4} transparent depthWrite={false} />
      </mesh>
      <mesh ref={m} position={[0,0.12,0]} castShadow>
        <sphereGeometry args={[0.12,16,16]} />
        <meshStandardMaterial color="#f8f8f8" roughness={0.25} emissive="#fffde8" emissiveIntensity={0.5} />
      </mesh>
      <pointLight position={[0,0.12,0]} color="#ffe8a0" intensity={4} distance={3} decay={2} />
    </group>
  );
}

// ─── Clock ─────────────────────────────────────────────────────────────────────
function Clock({ playing, dur, clockRef }: { playing: boolean; dur: number; clockRef: React.MutableRefObject<number> }) {
  useFrame((_, dt) => { if (playing) clockRef.current = (clockRef.current + dt) % dur; });
  return null;
}

// ─── Scene ─────────────────────────────────────────────────────────────────────
function Scene({ scene, actions, dur, playing }: { scene: SceneState; actions: AnimationAction[]; dur: number; playing: boolean }) {
  const clockRef = useRef(0);
  return (
    <>
      <Clock playing={playing} dur={dur} clockRef={clockRef} />
      <ambientLight color="#1e2a50" intensity={1.2} />
      <directionalLight position={[-8,16,-12]} color="#fff8e8" intensity={2.5} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[8,14,12]} color="#fff0d0" intensity={1.8} />
      <Pitch />
      {scene.teams.home.slots.map(s => (
        <Token key={`h.${s.slotId}`} pid={`home.${s.slotId}`}
          primary={scene.teams.home.secondaryColor} ring={scene.teams.home.primaryColor}
          label={s.slotId} clockRef={clockRef} scene={scene} actions={actions} />
      ))}
      {scene.teams.away?.slots.map(s => (
        <Token key={`a.${s.slotId}`} pid={`away.${s.slotId}`}
          primary={scene.teams.away!.secondaryColor} ring={scene.teams.away!.primaryColor}
          label={s.slotId} clockRef={clockRef} scene={scene} actions={actions} />
      ))}
      <Ball clockRef={clockRef} scene={scene} actions={actions} />
      <OrbitControls minDistance={5} maxDistance={30} maxPolarAngle={Math.PI/2.1} enableDamping dampingFactor={0.06} />
    </>
  );
}

// ─── Public ────────────────────────────────────────────────────────────────────
export function Pitch3D({ scene, actions = [], durationSeconds = 6, playing = true, frame: _f = 0 }: {
  scene: SceneState; actions?: AnimationAction[]; durationSeconds?: number; playing?: boolean; frame?: number;
}) {
  // Only render Canvas on the client (belt-and-suspenders on top of ssr:false)
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  return (
    <div style={{ width:'100%', height:'100%', position:'relative', background:'#050810' }}>
      {ready && (
        <CanvasErrorBoundary>
          <Canvas
            shadows
            camera={{ position: [0, 14, 13], fov: 40, near: 0.1, far: 120 }}
            gl={{ antialias: true, alpha: false }}
            onCreated={({ gl }) => {
              gl.setClearColor(new THREE.Color('#050810'));
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.1;
            }}
            dpr={[1, 1.5]}
            style={{ width:'100%', height:'100%', display:'block' }}
          >
            <color attach="background" args={['#050810']} />
            <fog attach="fog" args={['#050810', 22, 55]} />
            <Scene scene={scene} actions={actions} dur={durationSeconds} playing={playing} />
          </Canvas>
        </CanvasErrorBoundary>
      )}
      <div style={{ position:'absolute', bottom:8, right:12, fontSize:9, color:'rgba(255,255,255,0.2)', fontFamily:'monospace', pointerEvents:'none' }}>
        Drag · Scroll zoom
      </div>
    </div>
  );
}
