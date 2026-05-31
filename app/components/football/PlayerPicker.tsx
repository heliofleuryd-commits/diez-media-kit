'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Player } from '@/lib/football/types';

const CLUB_LABELS: Record<string, string> = {
  barcelona: 'Barcelona', real_madrid: 'Real Madrid', man_city: 'Man City',
  liverpool: 'Liverpool', arsenal: 'Arsenal', chelsea: 'Chelsea',
  psg: 'PSG', bayern: 'Bayern', juventus: 'Juventus',
  atletico: 'Atlético', man_utd: 'Man Utd', inter: 'Inter',
  ac_milan: 'AC Milan', napoli: 'Napoli', dortmund: 'Dortmund',
};

const CLUB_COLORS: Record<string, string> = {
  barcelona: '#a50044', real_madrid: '#ffd700', man_city: '#6CABDD',
  liverpool: '#C8102E', arsenal: '#EF0107', chelsea: '#034694',
  psg: '#003399', bayern: '#DC052D', juventus: '#000',
  atletico: '#CC0000', man_utd: '#DA020E', inter: '#003087',
  ac_milan: '#AC162C', napoli: '#0067B1', dortmund: '#FDE100',
};

const CLUB_BG: Record<string, string> = {
  barcelona: '#004d98', real_madrid: '#c8a415', man_city: '#1C2C5B',
  liverpool: '#C8102E', arsenal: '#EF0107', chelsea: '#034694',
  psg: '#003399', bayern: '#DC052D', juventus: '#333', atletico: '#CC0000',
  man_utd: '#DA020E', inter: '#003087', ac_milan: '#AC162C', napoli: '#0067B1', dortmund: '#a89000',
};

const POS_GROUPS = ['GK', 'DEF', 'MID', 'ATT'] as const;

// Module-level image cache so it persists across re-renders
const imgCache = new Map<string, string | null>();

function usePlayerImage(fullName?: string): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!fullName) return null;
    return imgCache.get(fullName.toLowerCase()) ?? null;
  });

  useEffect(() => {
    if (!fullName) return;
    const key = fullName.toLowerCase();
    if (imgCache.has(key)) { setUrl(imgCache.get(key)!); return; }
    fetch(`/api/football/player-image?name=${encodeURIComponent(key)}`)
      .then(r => r.json())
      .then(({ imageUrl }) => { imgCache.set(key, imageUrl); setUrl(imageUrl); })
      .catch(() => { imgCache.set(key, null); });
  }, [fullName]);

  return url;
}

function PlayerAvatar({ player, size = 44 }: { player: Player; size?: number }) {
  const remoteUrl = usePlayerImage(player.fullName);
  const src = player.imageUrl || remoteUrl;
  const [imgOk, setImgOk] = useState(false);

  useEffect(() => { setImgOk(!!src); }, [src]);

  const initials = (player.fullName || player.name)
    .split(' ').filter(Boolean).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
  const bg = CLUB_BG[player.club] ?? '#555';

  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      {imgOk && src ? (
        <img src={src} alt={player.name} width={size} height={size}
          style={{ objectFit: 'cover', width: '100%', height: '100%' }}
          onError={() => setImgOk(false)} />
      ) : (
        <span style={{ color: 'white', fontWeight: 900, fontSize: size * 0.34, fontFamily: 'Arial Black, Arial', userSelect: 'none' }}>
          {initials}
        </span>
      )}
    </div>
  );
}

// ── Custom player upload ─────────────────────────────────────────────────────
interface CustomUploadProps {
  onAdd: (player: Player) => void;
}

function CustomUpload({ onAdd }: CustomUploadProps) {
  const [step, setStep] = useState<'idle' | 'preview'>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('ST');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    setStep('preview');
  }, []);

  const handleSave = () => {
    if (!preview || !name.trim()) return;
    const newPlayer: Player = {
      id: 'custom_' + Date.now().toString(36),
      name: name.trim(),
      fullName: name.trim(),
      club: 'custom',
      position,
      positionGroup: ['GK'].includes(position) ? 'GK' : ['CB','LB','RB','LWB','RWB'].includes(position) ? 'DEF' : ['CM','CAM','CDM','LM','RM'].includes(position) ? 'MID' : 'ATT',
      imageUrl: preview,
      isCustom: true,
    };
    onAdd(newPlayer);
    setStep('idle');
    setPreview(null);
    setName('');
  };

  if (step === 'idle') return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <button onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-300 text-xs text-gray-400 hover:border-violet-400 hover:text-violet-600 transition-all w-full">
        <span className="text-lg">📸</span>
        <span>Upload custom player photo</span>
      </button>
    </>
  );

  return (
    <div className="flex items-center gap-2 p-2 rounded-xl border border-violet-200 bg-violet-50">
      {preview && <img src={preview} alt="" className="w-12 h-12 object-cover rounded-full border border-violet-300 bg-white" />}
      <div className="flex-1 flex flex-col gap-1">
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Player name" autoFocus
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-400" />
        <select value={position} onChange={e => setPosition(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
          {['GK','CB','LB','RB','CDM','CM','CAM','LM','RM','LW','RW','ST','CF'].map(p => <option key={p}>{p}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <button onClick={handleSave} disabled={!name.trim()}
          className="text-[10px] px-2 py-1 rounded-lg bg-violet-600 text-white font-bold disabled:opacity-40">Save</button>
        <button onClick={() => { setStep('idle'); setPreview(null); }}
          className="text-[10px] px-2 py-1 rounded-lg bg-gray-100 text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

// ── Main Picker ──────────────────────────────────────────────────────────────
interface PlayerPickerProps {
  slotId: string;
  team: 'home' | 'away';
  currentPlayerId: string | null;
  onSelect: (playerId: string | null) => void;
  onClose: () => void;
}

export function PlayerPicker({ slotId, team, currentPlayerId, onSelect, onClose }: PlayerPickerProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [customPlayers, setCustomPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState('');
  const [clubFilter, setClubFilter] = useState<string | null>(null);
  const [posFilter, setPosFilter] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/data/players.json').then(r => r.json()).then(setPlayers).catch(() => {});
    // Load custom players from localStorage
    try {
      const stored = JSON.parse(localStorage.getItem('tactics-app:custom-players') || '[]');
      setCustomPlayers(stored);
    } catch {}
    setTimeout(() => searchRef.current?.focus(), 80);
  }, []);

  const handleAddCustom = (player: Player) => {
    const updated = [player, ...customPlayers];
    setCustomPlayers(updated);
    localStorage.setItem('tactics-app:custom-players', JSON.stringify(updated));
  };

  const allPlayers = useMemo(() => [...customPlayers, ...players], [players, customPlayers]);

  const filtered = useMemo(() => allPlayers.filter(p => {
    if (clubFilter && p.club !== clubFilter && !(clubFilter === 'custom' && p.isCustom)) return false;
    if (posFilter  && p.positionGroup !== posFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) ||
        (p.fullName ?? '').toLowerCase().includes(q) ||
        p.position.toLowerCase().includes(q);
    }
    return true;
  }), [allPlayers, search, clubFilter, posFilter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ width: 660, maxHeight: '82vh' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-black text-sm text-gray-900 uppercase tracking-widest">
              {team === 'home' ? '🏠' : '✈'} Assign player — <span className="text-violet-600">{slotId}</span>
            </h2>
            <p className="text-[10px] text-gray-400 mt-0.5">{filtered.length} players · click to assign</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-lg flex items-center justify-center transition-all">×</button>
        </div>

        {/* Search + filters */}
        <div className="px-4 py-3 border-b border-gray-100 space-y-2 shrink-0">
          <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search player name…"
            className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder-gray-300" />

          {/* Club chips */}
          <div className="flex flex-wrap gap-1">
            {customPlayers.length > 0 && (
              <button onClick={() => setClubFilter(clubFilter === 'custom' ? null : 'custom')}
                className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold transition-all ${clubFilter === 'custom' ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                My Players
              </button>
            )}
            {Object.entries(CLUB_LABELS).map(([key, label]) => (
              <button key={key} onClick={() => setClubFilter(clubFilter === key ? null : key)}
                className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold transition-all ${clubFilter === key ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
                style={clubFilter === key ? { background: CLUB_COLORS[key] ?? '#555', borderColor: CLUB_COLORS[key] } : {}}>
                {label}
              </button>
            ))}
          </div>

          {/* Position + clear */}
          <div className="flex gap-1.5 items-center">
            {POS_GROUPS.map(pos => (
              <button key={pos} onClick={() => setPosFilter(posFilter === pos ? null : pos)}
                className={`text-xs px-3 py-0.5 rounded-lg font-bold transition-all ${posFilter === pos ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {pos}
              </button>
            ))}
            {currentPlayerId && (
              <button onClick={() => { onSelect(null); onClose(); }}
                className="ml-auto text-xs px-3 py-0.5 rounded-lg font-bold bg-red-50 text-red-500 hover:bg-red-100 transition-all">
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Custom upload */}
        <div className="px-4 py-2 border-b border-gray-100 shrink-0">
          <CustomUpload onAdd={handleAddCustom} />
        </div>

        {/* Player grid */}
        <div className="overflow-y-auto flex-1 p-4">
          {filtered.length === 0 && (
            <p className="text-center text-gray-300 py-8 text-sm">No players match.</p>
          )}
          <div className="grid grid-cols-3 gap-2">
            {filtered.map(player => {
              const isActive = player.id === currentPlayerId;
              return (
                <button key={player.id} onClick={() => { onSelect(player.id); onClose(); }}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all hover:border-violet-400 hover:bg-violet-50 active:scale-95 ${isActive ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-300' : 'border-gray-100 bg-gray-50'}`}>
                  <PlayerAvatar player={player} size={42} />
                  <div className="min-w-0">
                    <div className="text-[11px] font-black text-gray-900 truncate leading-tight">{player.name}</div>
                    <div className="text-[9px] text-gray-400 truncate">{player.isCustom ? 'My player' : (CLUB_LABELS[player.club] ?? player.club)}</div>
                    <span className="inline-block mt-0.5 text-[8px] font-black bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">{player.position}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
