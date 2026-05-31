'use client';

import { useState, useCallback, useRef, useEffect, Component, type ReactNode } from 'react';
import dynamic from 'next/dynamic';

class ThreeErrorBoundary extends Component<{ children: ReactNode }, { err: string | null }> {
  state = { err: null };
  static getDerivedStateFromError(e: Error) { return { err: e.message }; }
  render() {
    if (this.state.err) return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#050810] gap-2">
        <span className="text-red-400 text-xs font-mono">3D error — check console</span>
        <span className="text-white/20 text-[9px] font-mono max-w-sm text-center break-all">{this.state.err}</span>
        <button onClick={() => this.setState({ err: null })} className="text-[9px] text-violet-400 border border-violet-400/30 px-3 py-1 rounded mt-1">Retry</button>
      </div>
    );
    return this.props.children;
  }
}
import { FootballPreview } from './FootballPreview';
import { PitchEditor } from './PitchEditor';
import { PlayerPicker } from './PlayerPicker';
import { TemplatePanel } from './TemplatePanel';
import { AnimationTimeline } from './AnimationTimeline';

const Pitch3D = dynamic(() => import('./Pitch3D').then(m => m.Pitch3D), { ssr: false, loading: () => (
  <div className="w-full h-full flex items-center justify-center bg-[#0a0e14]">
    <span className="text-[10px] text-white/30">Loading 3D…</span>
  </div>
) });
import { TEST_SCENE } from './testScene';
import { SAMPLE_ANIMATION, SAMPLE_DURATION } from './sampleAnimation';
import { FORMATIONS, getFormationSlots } from '@/lib/football/formations';
import { STARTING_XI } from '@/lib/football/startingXI';
import type { SceneState, AnimationAction, Vec2 } from '@/lib/football/types';

const FORMATIONS_LIST = Object.keys(FORMATIONS);

interface ScriptClip {
  id: string; label: string; description: string;
  startSec: number; endSec: number; duration: number; actions: AnimationAction[];
}
interface ChatMessage {
  id: string; role: 'user' | 'assistant'; content: string;
  hasAnimation?: boolean; hasSceneChanges?: boolean;
}
interface SceneChange {
  op: 'move' | 'assign' | 'unassign'; team: 'home' | 'away';
  slotId: string; position?: [number, number]; playerId?: string;
}

const CLUB_KEY_TO_STARTING_XI_KEY: Record<string, string> = {
  barcelona: 'barcelona', real_madrid: 'real_madrid', man_city: 'man_city',
  liverpool: 'liverpool', arsenal: 'arsenal', chelsea: 'chelsea', psg: 'psg', bayern: 'bayern',
};
const TEAM_PRESETS: Record<string, { primary: string; secondary: string; name: string }> = {
  barcelona:   { primary: '#a50044', secondary: '#004d98', name: 'Barcelona' },
  real_madrid: { primary: '#ffd700', secondary: '#e8e8e8', name: 'Real Madrid' },
  man_city:    { primary: '#6CABDD', secondary: '#1C2C5B', name: 'Man City' },
  liverpool:   { primary: '#C8102E', secondary: '#00B2A9', name: 'Liverpool' },
  arsenal:     { primary: '#EF0107', secondary: '#063672', name: 'Arsenal' },
  chelsea:     { primary: '#034694', secondary: '#DBA111', name: 'Chelsea' },
  psg:         { primary: '#003399', secondary: '#ED1C24', name: 'PSG' },
  bayern:      { primary: '#DC052D', secondary: '#0066B2', name: 'Bayern' },
  juventus:    { primary: '#000', secondary: '#fff', name: 'Juventus' },
  atletico:    { primary: '#CC0000', secondary: '#003366', name: 'Atlético' },
  man_utd:     { primary: '#DA020E', secondary: '#FFE500', name: 'Man Utd' },
};

type MiddleTab = 'chat' | 'script' | 'edit';
type LeftTab = 'team' | 'templates';

// ── Resize helper ─────────────────────────────────────────────────────────────
function startDrag(
  e: React.MouseEvent,
  axis: 'x' | 'y',
  start: number,
  onMove: (delta: number) => void,
) {
  e.preventDefault();
  const origin = axis === 'x' ? e.clientX : e.clientY;
  const move = (ev: MouseEvent) => onMove((axis === 'x' ? ev.clientX : ev.clientY) - origin);
  const up   = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

export function FootballApp() {
  const [scene, setScene]     = useState<SceneState>(TEST_SCENE);
  const [actions, setActions] = useState<AnimationAction[]>(SAMPLE_ANIMATION);
  const [duration, setDuration] = useState(SAMPLE_DURATION);
  const [prompt, setPrompt]   = useState('');

  const [leftTab,  setLeftTab]  = useState<LeftTab>('team');
  const [teamTab,  setTeamTab]  = useState<'home' | 'away'>('home');

  const [pickerSlot,   setPickerSlot]   = useState<{ team: 'home' | 'away'; slotId: string } | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ team: 'home' | 'away'; slotId: string } | null>(null);
  const [selectedActionIdx, setSelectedActionIdx] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [rendering,  setRendering]  = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);

  // Chat
  const WELCOME: ChatMessage = {
    id: 'welcome', role: 'assistant',
    content: "Hi! I'm your AI tactics assistant. Describe what you want to animate — I can move players, create full sequences, ask clarifying questions, and remember everything we've discussed.",
  };
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([WELCOME]);
  const [chatInput, setChatInput]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Script Director
  const [script, setScript]       = useState('');
  const [clips,  setClips]        = useState<ScriptClip[]>([]);
  const [transcribing, setTranscribing]       = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // ── Panel sizes ──────────────────────────────────────────────────────────────
  const [leftWidth,      setLeftWidth]      = useState(272);
  const [rightWidth,     setRightWidth]     = useState(320);
  const [previewHeightPx, setPreviewHeightPx] = useState(460);

  // ── Tab states ────────────────────────────────────────────────────────────
  const [centerTab,   setCenterTab]   = useState<'preview' | 'edit'>('preview');
  const [directorTab, setDirectorTab] = useState<'chat' | 'script'>('chat');

  // ── 3D view ───────────────────────────────────────────────────────────────
  const [view3D, setView3D] = useState(false);
  const [frame3D, setFrame3D]   = useState(0);
  const [playing3D, setPlaying3D] = useState(true);
  const frame3DRef = useRef(0);
  const animRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!view3D || !playing3D) return;
    const totalFrames = duration * 30;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = now - last; last = now;
      frame3DRef.current = (frame3DRef.current + delta * 0.03) % totalFrames;
      setFrame3D(Math.floor(frame3DRef.current));
      animRafRef.current = requestAnimationFrame(tick);
    };
    animRafRef.current = requestAnimationFrame(tick);
    return () => { if (animRafRef.current) cancelAnimationFrame(animRafRef.current); };
  }, [view3D, playing3D, duration]);

  // ── Scene mutations ───────────────────────────────────────────────────────────
  const updateTeam = (team: 'home' | 'away', updates: Partial<typeof scene.teams.home>) => {
    setScene(prev => {
      const current = prev.teams[team]!;
      const newFormation = updates.formation ?? current.formation;
      const newSlots = updates.formation
        ? getFormationSlots(newFormation, team).map(s => ({ ...s, playerId: null }))
        : current.slots;
      return { ...prev, teams: { ...prev.teams, [team]: { ...current, ...updates, slots: newSlots } } };
    });
  };

  const applyStartingXI = (team: 'home' | 'away', clubKey: string) => {
    const xi = STARTING_XI[CLUB_KEY_TO_STARTING_XI_KEY[clubKey]];
    if (!xi) return;
    setScene(prev => {
      const current = prev.teams[team]!;
      const newSlots = current.slots.map(s => ({ ...s, playerId: xi[s.slotId] ?? null }));
      return { ...prev, teams: { ...prev.teams, [team]: { ...current, slots: newSlots } } };
    });
  };

  const updatePosition = useCallback((team: 'home' | 'away', slotId: string, pos: Vec2) => {
    setScene(prev => ({
      ...prev,
      teams: { ...prev.teams, [team]: { ...prev.teams[team]!, slots: prev.teams[team]!.slots.map(s => s.slotId === slotId ? { ...s, position: pos } : s) } },
    }));
  }, []);

  const assignPlayer = (playerId: string | null) => {
    if (!pickerSlot) return;
    const { team, slotId } = pickerSlot;
    setScene(prev => ({
      ...prev,
      teams: { ...prev.teams, [team]: { ...prev.teams[team]!, slots: prev.teams[team]!.slots.map(s => s.slotId === slotId ? { ...s, playerId } : s) } },
    }));
  };

  const resetFormation = (team: 'home' | 'away') => {
    const current = scene.teams[team]!;
    const freshSlots = getFormationSlots(current.formation, team);
    setScene(prev => ({
      ...prev,
      teams: { ...prev.teams, [team]: { ...current, slots: freshSlots.map((s, i) => ({ ...s, playerId: current.slots[i]?.playerId ?? null })) } },
    }));
  };

  const handleSelectSlot = useCallback((team: 'home' | 'away', slotId: string) => {
    setSelectedSlot({ team, slotId });
    setPickerSlot({ team, slotId });
  }, []);

  // ── Export ────────────────────────────────────────────────────────────────────
  const handleRender = async () => {
    if (rendering) return;
    setRendering(true); setRenderError(null);
    try {
      const res = await fetch('/api/football/render', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene, actions, duration, name: scene.name }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Render failed' })); setRenderError(err.error || 'Render failed'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${scene.name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { setRenderError(err instanceof Error ? err.message : 'Network error'); }
    finally { setRendering(false); }
  };

  // ── Script Director ───────────────────────────────────────────────────────────
  const handleGenerateScript = async () => {
    if (!script.trim() || generating) return;
    setGenerating(true); setGenerateError(null); setClips([]);
    try {
      const res = await fetch('/api/football/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'script', script, scene }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setGenerateError(data.error || 'Generation failed'); return; }
      setClips(data.clips);
      if (data.clips.length > 0) {
        const first = data.clips[0] as ScriptClip;
        setActions(first.actions); setDuration(first.duration); setActiveClipId(first.id);
      }
    } catch (err) { setGenerateError(err instanceof Error ? err.message : 'Network error'); }
    finally { setGenerating(false); }
  };

  const handleTranscribe = async (file: File) => {
    setTranscribing(true); setTranscribeError(null);
    try {
      const form = new FormData(); form.append('file', file);
      const res = await fetch('/api/football/transcribe', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.ok) { setTranscribeError(data.error || 'Transcription failed'); return; }
      setScript(data.text);
    } catch (err) { setTranscribeError(err instanceof Error ? err.message : 'Network error'); }
    finally { setTranscribing(false); }
  };

  const handleExportClipJson = (clip: ScriptClip) => {
    const payload = { scene, actions: clip.actions, duration: clip.duration, name: clip.label };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    a.download = `${clip.id}_${clip.label.replace(/\s+/g, '_').toLowerCase()}.json`; a.click();
  };

  // ── Chat ──────────────────────────────────────────────────────────────────────
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages, chatLoading]);

  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const userMsg: ChatMessage = { id: `u${Date.now()}`, role: 'user', content: text };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput(''); setChatLoading(true);
    try {
      const history = [...chatMessages.filter(m => m.id !== 'welcome'), userMsg].slice(-12).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/football/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'chat', messages: history, scene }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setChatMessages(prev => [...prev, { id: `a${Date.now()}`, role: 'assistant', content: data.error || 'Something went wrong.' }]);
        return;
      }
      let hasAnimation = false, hasSceneChanges = false;
      if (data.animation?.actions?.length > 0) {
        setActions(data.animation.actions); setDuration(data.animation.duration ?? 6);
        setActiveClipId(null); hasAnimation = true;
      }
      if (Array.isArray(data.sceneChanges) && data.sceneChanges.length > 0) {
        (data.sceneChanges as SceneChange[]).forEach(change => {
          if (change.op === 'move' && change.position) {
            updatePosition(change.team, change.slotId, change.position as Vec2);
          } else if (change.op === 'assign' && change.playerId) {
            setScene(prev => ({ ...prev, teams: { ...prev.teams, [change.team]: { ...prev.teams[change.team]!, slots: prev.teams[change.team]!.slots.map(s => s.slotId === change.slotId ? { ...s, playerId: change.playerId! } : s) } } }));
          } else if (change.op === 'unassign') {
            setScene(prev => ({ ...prev, teams: { ...prev.teams, [change.team]: { ...prev.teams[change.team]!, slots: prev.teams[change.team]!.slots.map(s => s.slotId === change.slotId ? { ...s, playerId: null } : s) } } }));
          }
        });
        hasSceneChanges = true;
      }
      setChatMessages(prev => [...prev, { id: `a${Date.now()}`, role: 'assistant', content: data.message || 'Done!', hasAnimation, hasSceneChanges }]);
    } catch {
      setChatMessages(prev => [...prev, { id: `a${Date.now()}`, role: 'assistant', content: 'Network error. Please try again.' }]);
    } finally { setChatLoading(false); }
  };

  const activeTeam = teamTab === 'home' ? scene.teams.home : scene.teams.away!;
  const playerKey = `${activeClipId ?? 'default'}-${duration}-${actions.length}`;

  // legacy alias so 3D animation effect still works
  const chatHeightPx = previewHeightPx;
  const setChatHeightPx = setPreviewHeightPx;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-[#0f1117] text-gray-900 overflow-hidden select-none">

      {/* ── LEFT: Config ─────────────────────────────────────────────────────── */}
      <aside className="shrink-0 flex flex-col overflow-hidden bg-white border-r border-gray-200" style={{ width: leftWidth }}>
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">⚽</span>
            <h1 className="font-black text-[10px] tracking-widest uppercase text-gray-900">Tactics Studio</h1>
          </div>
          <div className="flex rounded-lg bg-gray-100 p-0.5 text-[10px] font-semibold">
            {(['single-team', 'two-team'] as const).map(m => (
              <button key={m} onClick={() => setScene(s => ({ ...s, mode: m }))}
                className={`flex-1 py-1 rounded-md transition-all ${scene.mode === m ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                {m === 'single-team' ? 'Drill' : 'Match'}
              </button>
            ))}
          </div>
        </div>

        {/* Left tabs */}
        <div className="flex border-b border-gray-100 text-[9px] font-bold shrink-0">
          {(['team', 'templates'] as const).map(t => (
            <button key={t} onClick={() => setLeftTab(t)}
              className={`flex-1 py-1.5 transition-all capitalize ${leftTab === t ? 'border-b-2 border-violet-600 text-violet-700' : 'text-gray-400'}`}>
              {t === 'team' ? '⚙ Config' : '📂 Templates'}
            </button>
          ))}
        </div>

        {leftTab === 'team' && (<>
          <div className="flex border-b border-gray-100 text-[9px] font-bold shrink-0">
            <button onClick={() => setTeamTab('home')}
              className={`flex-1 py-1.5 transition-all ${teamTab === 'home' ? 'border-b-2 border-violet-500 text-violet-700' : 'text-gray-400'}`}>🏠 Home</button>
            {scene.mode === 'two-team' && (
              <button onClick={() => setTeamTab('away')}
                className={`flex-1 py-1.5 transition-all ${teamTab === 'away' ? 'border-b-2 border-violet-500 text-violet-700' : 'text-gray-400'}`}>✈ Away</button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-3 select-text">
            {/* Club presets */}
            <div>
              <label className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Club preset</label>
              <div className="grid grid-cols-3 gap-1">
                {Object.entries(TEAM_PRESETS).map(([key, val]) => (
                  <button key={key} onClick={() => updateTeam(teamTab, { primaryColor: val.primary, secondaryColor: val.secondary })}
                    className="text-[8px] py-1 px-1 rounded border border-gray-200 hover:border-violet-400 hover:bg-violet-50 transition-all truncate text-left leading-tight"
                    style={{ borderLeftColor: val.primary, borderLeftWidth: 3 }}>{val.name}</button>
                ))}
              </div>
              {(() => {
                const matchedClub = Object.entries(TEAM_PRESETS).find(([, v]) => v.primary === activeTeam.primaryColor && v.secondary === activeTeam.secondaryColor)?.[0];
                if (!matchedClub || !STARTING_XI[CLUB_KEY_TO_STARTING_XI_KEY[matchedClub]]) return null;
                return (
                  <button onClick={() => applyStartingXI(teamTab, matchedClub)}
                    className="w-full mt-1 text-[9px] py-1.5 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 font-bold hover:bg-violet-100 transition-all">
                    ⚡ Apply {TEAM_PRESETS[matchedClub].name} XI
                  </button>
                );
              })()}
            </div>
            {/* Formation */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Formation</label>
                <button onClick={() => resetFormation(teamTab)} className="text-[8px] text-violet-500 hover:text-violet-700 font-semibold">Reset</button>
              </div>
              <select value={activeTeam.formation} onChange={e => updateTeam(teamTab, { formation: e.target.value })}
                className="w-full text-[10px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400">
                {FORMATIONS_LIST.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            {/* Colors */}
            <div>
              <label className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Kit colors</label>
              <div className="flex gap-2">
                {[{ label: 'Ring', key: 'primaryColor' }, { label: 'Fill', key: 'secondaryColor' }].map(({ label, key }) => (
                  <div key={key} className="flex-1">
                    <span className="text-[8px] text-gray-400 block mb-0.5">{label}</span>
                    <input type="color" value={activeTeam[key as 'primaryColor' | 'secondaryColor']}
                      onChange={e => updateTeam(teamTab, { [key]: e.target.value })}
                      className="w-full h-7 rounded border border-gray-200 cursor-pointer p-0.5" />
                  </div>
                ))}
              </div>
            </div>
            {/* Players */}
            <div>
              <label className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Players</label>
              <div className="space-y-0.5 max-h-40 overflow-y-auto pr-1">
                {activeTeam.slots.map(slot => (
                  <button key={slot.slotId} onClick={() => { setPickerSlot({ team: teamTab, slotId: slot.slotId }); setSelectedSlot({ team: teamTab, slotId: slot.slotId }); }}
                    className={`w-full flex items-center gap-1.5 text-[9px] px-2 py-1 rounded-lg border transition-all hover:border-violet-300 hover:bg-violet-50 ${selectedSlot?.slotId === slot.slotId && selectedSlot?.team === teamTab ? 'border-violet-400 bg-violet-50' : 'border-gray-100 bg-gray-50'}`}>
                    <span className="w-6 text-center font-black text-gray-500 text-[8px]">{slot.slotId}</span>
                    <span className="flex-1 text-left text-gray-700 font-semibold truncate">
                      {slot.playerId ? slot.playerId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : <span className="text-gray-300 italic">empty</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {/* Ball */}
            <div>
              <label className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Ball with</label>
              <select value={scene.ball.ownerSlot ?? ''} onChange={e => setScene(s => ({ ...s, ball: { ...s.ball, ownerSlot: e.target.value || null } }))}
                className="w-full text-[10px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400">
                <option value="">No ball</option>
                {scene.teams.home.slots.map(s => <option key={`home.${s.slotId}`} value={`home.${s.slotId}`}>Home – {s.slotId}</option>)}
                {scene.mode === 'two-team' && scene.teams.away?.slots.map(s => <option key={`away.${s.slotId}`} value={`away.${s.slotId}`}>Away – {s.slotId}</option>)}
              </select>
            </div>
            {/* Scene name */}
            <div>
              <label className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Scene name</label>
              <input type="text" value={scene.name} onChange={e => setScene(s => ({ ...s, name: e.target.value }))}
                className="w-full text-[10px] border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
          </div>
        </>)}

        {leftTab === 'templates' && (
          <div className="flex-1 overflow-hidden">
            <TemplatePanel
              scene={scene} actions={actions} duration={duration} prompt={prompt}
              onLoadScene={s => { setScene(s); setLeftTab('team'); }}
              onLoadAnimation={(s, a, d, p) => { setScene(s); setActions(a); setDuration(d); setPrompt(p); setLeftTab('team'); }}
            />
          </div>
        )}
      </aside>

      {/* ── RESIZE: left ─────────────────────────────────────────────────────── */}
      <div className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-violet-400/30 active:bg-violet-400/50 transition-colors z-10"
        onMouseDown={e => startDrag(e, 'x', leftWidth, delta => setLeftWidth(Math.max(200, Math.min(460, leftWidth + delta))))} />

      {/* ── CENTER: Preview + Timeline ──────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-gray-100 overflow-hidden">

        {/* Center tab bar */}
        <div className="flex border-b border-gray-200 bg-white text-[10px] font-bold shrink-0">
          <button onClick={() => setCenterTab('preview')}
            className={`px-5 py-2.5 transition-all flex items-center gap-1.5 ${centerTab === 'preview' ? 'border-b-2 border-violet-600 text-violet-700' : 'text-gray-400 hover:text-gray-600'}`}>
            <span>▶</span> Preview
          </button>
          <button onClick={() => setCenterTab('edit')}
            className={`px-5 py-2.5 transition-all flex items-center gap-1.5 ${centerTab === 'edit' ? 'border-b-2 border-violet-600 text-violet-700' : 'text-gray-400 hover:text-gray-600'}`}>
            <span>✏</span> Edit Pitch
          </button>
          <div className="flex-1" />
          {/* 2D/3D toggle (only in preview mode) */}
          {centerTab === 'preview' && (
            <div className="flex items-center gap-2 px-3">
              <div className="flex rounded-md bg-gray-100 p-0.5 text-[9px] font-bold gap-0.5">
                <button onClick={() => setView3D(false)}
                  className={`px-2 py-0.5 rounded transition-all ${!view3D ? 'bg-violet-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}>2D</button>
                <button onClick={() => setView3D(true)}
                  className={`px-2 py-0.5 rounded transition-all ${view3D ? 'bg-violet-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}>3D</button>
              </div>
              {view3D
                ? <button onClick={() => setPlaying3D(p => !p)} className="text-[10px] text-gray-500 hover:text-gray-800 font-mono">{playing3D ? '⏸' : '▶'}</button>
                : <span className="text-[9px] font-mono text-gray-400">{duration}s · 30fps</span>
              }
            </div>
          )}
          <div className="flex items-center gap-2 pr-3 text-[9px] text-gray-400">
            <span className="font-bold text-gray-700">{scene.name}</span>
            <span>{scene.teams.home.formation}{scene.teams.away ? ` vs ${scene.teams.away.formation}` : ''}</span>
            <span>{actions.length} actions</span>
          </div>
        </div>

        {/* Preview / Edit area */}
        <div className="flex items-center justify-center overflow-hidden bg-gray-100" style={{ height: previewHeightPx, minHeight: 200 }}>
          {centerTab === 'preview' ? (
            view3D
              ? <ThreeErrorBoundary><Pitch3D scene={scene} actions={actions} durationSeconds={duration} frame={frame3D} playing={playing3D} /></ThreeErrorBoundary>
              : <FootballPreview scene={scene} actions={actions} durationSeconds={duration} playerKey={playerKey} fill />
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full p-4">
              <p className="text-[9px] text-gray-400 mb-2"><strong>Drag</strong> players to reposition · <strong>Click</strong> to assign</p>
              <PitchEditor scene={scene} onUpdatePosition={updatePosition} onSelectSlot={handleSelectSlot} selectedSlot={selectedSlot}
                height={Math.min(previewHeightPx - 60, 560)} />
            </div>
          )}
        </div>

        {/* ── Resize handle: preview / timeline ── */}
        <div className="h-1 shrink-0 cursor-row-resize bg-gray-300 hover:bg-violet-400/50 active:bg-violet-400/70 transition-colors"
          onMouseDown={e => startDrag(e, 'y', previewHeightPx, delta => setPreviewHeightPx(Math.max(180, Math.min(800, previewHeightPx + delta))))} />

        {/* ── Timeline ── */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <AnimationTimeline actions={actions} duration={duration} selectedIdx={selectedActionIdx} onSelect={setSelectedActionIdx} />
        </div>
      </main>

      {/* ── RESIZE: right ────────────────────────────────────────────────────── */}
      <div className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-violet-400/30 active:bg-violet-400/50 transition-colors z-10"
        onMouseDown={e => startDrag(e, 'x', rightWidth, delta => setRightWidth(Math.max(260, Math.min(520, rightWidth - delta))))} />

      {/* ── RIGHT: AI Director ───────────────────────────────────────────────── */}
      <aside className="shrink-0 flex flex-col bg-white border-l border-gray-200 overflow-hidden" style={{ width: rightWidth }}>

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-black text-xs tracking-widest uppercase text-gray-900">AI Director</h2>
            {directorTab === 'chat' && chatMessages.length > 1 && (
              <button onClick={() => setChatMessages([WELCOME])} className="text-[9px] text-gray-400 hover:text-red-500 font-semibold">Clear</button>
            )}
          </div>
          <div className="flex rounded-lg bg-gray-100 p-0.5 text-[10px] font-bold">
            <button onClick={() => setDirectorTab('chat')}
              className={`flex-1 py-1.5 rounded-md transition-all ${directorTab === 'chat' ? 'bg-white shadow text-gray-900' : 'text-gray-400'}`}>
              AI Chat
            </button>
            <button onClick={() => setDirectorTab('script')}
              className={`flex-1 py-1.5 rounded-md transition-all ${directorTab === 'script' ? 'bg-white shadow text-violet-700' : 'text-gray-400'}`}>
              Script Director
            </button>
          </div>
        </div>

        {/* ── CHAT ── */}
        {directorTab === 'chat' && (<>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 select-text">
            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex items-end gap-1.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mb-0.5 shadow">
                    <span className="text-[8px] text-white font-black">AI</span>
                  </div>
                )}
                <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed ${msg.role === 'user' ? 'bg-violet-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {(msg.hasAnimation || msg.hasSceneChanges) && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {msg.hasAnimation && <span className="text-[8px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-bold">✓ Animation</span>}
                      {msg.hasSceneChanges && <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">✓ Positions</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-end gap-1.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow">
                  <span className="text-[8px] text-white font-black">AI</span>
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2.5">
                  <div className="flex gap-1 items-center h-3">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-gray-100 px-3 pb-3 pt-2 space-y-1.5 shrink-0">
            <div className="flex gap-2 items-end">
              <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                placeholder="Describe a tactic, move players, ask a question… (Enter)"
                rows={2} className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder-gray-300 leading-relaxed select-text" />
              <button onClick={handleChatSend} disabled={chatLoading || !chatInput.trim()}
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40 shadow"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                {chatLoading ? <span className="animate-spin text-white text-sm">↻</span> : <span className="text-white font-black" style={{ marginTop: '-1px' }}>↑</span>}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <button onClick={handleRender} disabled={rendering} className="text-[9px] text-gray-400 hover:text-gray-700 font-semibold">
                {rendering ? 'Exporting…' : '⬇ Export JSON'}
              </button>
              <div className="flex gap-2">
                <button onClick={() => { setActions(SAMPLE_ANIMATION); setDuration(SAMPLE_DURATION); }} className="text-[9px] text-violet-500 hover:text-violet-700 font-semibold">Sample</button>
                <button onClick={() => setActions([])} className="text-[9px] text-red-400 hover:text-red-600 font-semibold">Clear</button>
              </div>
            </div>
            {renderError && <div className="text-[9px] text-red-500 bg-red-50 border border-red-200 rounded px-2 py-1">{renderError}</div>}
          </div>
        </>)}

        {/* ── SCRIPT DIRECTOR ── */}
        {directorTab === 'script' && (<>
          <div className="p-3 border-b border-gray-100 space-y-2 shrink-0">
            <p className="text-[10px] text-gray-500 leading-relaxed">Paste your TikTok script. Claude identifies every tactical moment and generates synced clips.</p>
            <input ref={audioInputRef} type="file" accept="audio/*" className="hidden"
              onChange={e => e.target.files?.[0] && handleTranscribe(e.target.files[0])} />
            <button onClick={() => audioInputRef.current?.click()} disabled={transcribing}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-violet-300 text-[10px] font-bold text-violet-600 hover:bg-violet-50 transition-all disabled:opacity-50">
              {transcribing ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-violet-600 border-t-transparent rounded-full" /> Transcribing…</> : <><span>🎙</span> Upload MP3</>}
            </button>
            {transcribeError && <div className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">{transcribeError}</div>}
            <textarea value={script} onChange={e => { setScript(e.target.value); setGenerateError(null); }}
              placeholder="Paste full commentary script here…" rows={7}
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder-gray-300 select-text" />
            <button onClick={handleGenerateScript} disabled={generating || !script.trim()}
              className="w-full py-2.5 rounded-xl text-white text-xs font-black tracking-wide disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
              {generating ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Analysing…</> : <>✨ Generate Animation Clips</>}
            </button>
            {generateError && <div className="text-[9px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{generateError}</div>}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {clips.length === 0 && (
              <div className="text-center py-8">
                <p className="text-2xl mb-2">🎬</p>
                <p className="text-[10px] text-gray-400 leading-relaxed">Animation clips will appear here.<br />Each syncs to a moment in your script.</p>
              </div>
            )}
            {clips.length > 0 && (
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8px] font-bold tracking-widest uppercase text-gray-400">{clips.length} clips</span>
                <button onClick={() => clips.forEach(handleExportClipJson)} className="text-[9px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold">All</button>
              </div>
            )}
            {clips.map((clip, i) => {
              const isActive = activeClipId === clip.id;
              return (
                <div key={clip.id} className={`rounded-xl border p-2.5 transition-all ${isActive ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200' : 'border-gray-200 bg-gray-50 hover:border-violet-300'}`}>
                  <div className="flex items-start gap-1.5">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[8px] font-black flex items-center justify-center mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-gray-900 leading-tight">{clip.label}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5 leading-snug">{clip.description}</p>
                      <div className="flex gap-1 mt-1.5">
                        <button onClick={() => { setActions(clip.actions); setDuration(clip.duration); setActiveClipId(clip.id); setCenterTab('preview'); }}
                          className="text-[9px] px-2.5 py-1 rounded-lg bg-violet-600 text-white font-bold hover:bg-violet-700">Preview</button>
                        <button onClick={() => handleExportClipJson(clip)}
                          className="text-[9px] px-2.5 py-1 rounded-lg bg-gray-200 text-gray-600 font-bold hover:bg-gray-300">Export</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>)}
      </aside>

      {/* Player picker modal */}
      {pickerSlot && (
        <PlayerPicker
          slotId={pickerSlot.slotId} team={pickerSlot.team}
          currentPlayerId={scene.teams[pickerSlot.team]?.slots.find(s => s.slotId === pickerSlot.slotId)?.playerId ?? null}
          onSelect={assignPlayer} onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  );
}
