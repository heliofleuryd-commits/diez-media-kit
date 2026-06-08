'use client';

import { useState, useEffect, useMemo } from 'react';

interface SkillMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  size: number;
  updatedAt: string;
}

const MASTER_PROMPT = `You are an elite TikTok football scriptwriter. I'm attaching a "Channel Profile" — a deep structural analysis of a creator's voice, hooks, narrative beats, and storytelling techniques, built from studying dozens of their highest-performing videos.

Study it closely, then write me a complete, ready-to-record script in their exact style for this topic: [YOUR TOPIC HERE]

Requirements:
- Match their voice, persona, and relationship with the viewer
- Open with one of their signature hook formulas — don't invent a generic one
- Follow their narrative structure beat-by-beat, in order — don't skip steps
- Weave in real, specific facts (matches, minutes, players, score progressions) — emotion is the DELIVERY, facts are the CONTENT. Emotion alone is empty poetry.
- Clean spoken words only — no [CAM], no [BROLL], no camera directions, no brackets
- Target length: 2–2.5 minutes read aloud naturally at a natural pace (roughly 280–350 words)

After the script, give me:
- Hook: (the opening line alone)
- Caption: (under 150 characters)
- Hashtags: (6–8 relevant tags)`;

function formatBytes(b: number) {
  return b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`;
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-[10px] font-bold uppercase tracking-wider text-gray-500"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
      </svg>
      {copied ? 'Copied ✓' : label}
    </button>
  );
}

function SkillRow({ skill }: { skill: SkillMeta }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[12.5px] text-gray-900 truncate">{skill.name}</div>
          <div className="text-[10px] text-gray-400 font-semibold mt-0.5">{formatBytes(skill.size)} · updated {new Date(skill.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
        </div>
        <a
          href={`/api/football/skills/${skill.id}`}
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-white shrink-0"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download
        </a>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className="text-gray-400 transition-transform shrink-0" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-3.5 py-2.5">
          <p className="text-[11px] text-gray-500 leading-relaxed">{skill.description}</p>
        </div>
      )}
    </div>
  );
}

export function SkillsLibrary() {
  const [skills, setSkills] = useState<SkillMeta[] | null>(null);

  useEffect(() => {
    fetch('/api/football/skills').then(r => r.json()).then(d => { if (d.ok) setSkills(d.skills); }).catch(() => {});
  }, []);

  const grouped = useMemo(() => {
    if (!skills) return [];
    const byCategory = new Map<string, SkillMeta[]>();
    for (const s of skills) {
      if (!byCategory.has(s.category)) byCategory.set(s.category, []);
      byCategory.get(s.category)!.push(s);
    }
    return Array.from(byCategory.entries());
  }, [skills]);

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="max-w-3xl mx-auto px-5 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Skill Library</h1>
          <p className="text-[12px] text-gray-500 mt-1">
            Voice profiles and format templates extracted from top football creators — download any skill and load it into Claude to write in that exact style.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">How to use — paste this prompt with the skill attached</span>
            <CopyButton text={MASTER_PROMPT} label="Copy prompt" />
          </div>
          <pre className="text-[10.5px] text-gray-600 leading-relaxed whitespace-pre-wrap font-mono overflow-x-auto">{MASTER_PROMPT}</pre>
          <ol className="mt-3 space-y-1 text-[11px] text-gray-500">
            <li>1. Download the skill file (.md) below.</li>
            <li>2. In Claude Desktop, attach it to a chat (or add it to a Project's Knowledge).</li>
            <li>3. Paste the prompt above, swap in your topic, and send.</li>
          </ol>
        </div>

        {skills === null ? (
          <p className="text-[11px] text-gray-400 italic">Loading…</p>
        ) : (
          <div className="space-y-6">
            {grouped.map(([category, items]) => (
              <div key={category}>
                <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">{category} · {items.length}</h2>
                <div className="space-y-2">
                  {items.map(s => <SkillRow key={s.id} skill={s} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
