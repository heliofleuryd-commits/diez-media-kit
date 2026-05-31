'use client';

import { useState, useEffect, useRef } from 'react';
import {
  loadSceneTemplates, saveSceneTemplate, deleteSceneTemplate, updateSceneTemplate,
  loadAnimationTemplates, saveAnimationTemplate, deleteAnimationTemplate,
  exportTemplate, importTemplate,
  type SceneTemplate, type AnimationTemplate,
} from '@/lib/football/storage';
import type { SceneState, AnimationAction } from '@/lib/football/types';

interface TemplatePanelProps {
  scene: SceneState;
  actions: AnimationAction[];
  duration: number;
  prompt: string;
  onLoadScene: (scene: SceneState) => void;
  onLoadAnimation: (scene: SceneState, actions: AnimationAction[], duration: number, prompt: string) => void;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function TemplatePanel({ scene, actions, duration, prompt, onLoadScene, onLoadAnimation }: TemplatePanelProps) {
  const [tab, setTab] = useState<'scene' | 'animation'>('scene');
  const [sceneTemplates, setSceneTemplates] = useState<SceneTemplate[]>([]);
  const [animTemplates, setAnimTemplates] = useState<AnimationTemplate[]>([]);
  const [saveName, setSaveName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    setSceneTemplates(loadSceneTemplates());
    setAnimTemplates(loadAnimationTemplates());
  };

  useEffect(() => { refresh(); }, []);

  const handleSave = () => {
    const name = saveName.trim() || scene.name;
    if (tab === 'scene') {
      saveSceneTemplate(name, scene);
    } else {
      saveAnimationTemplate(name, prompt, duration, scene, actions);
    }
    setSaveName('');
    refresh();
  };

  const handleDelete = (id: string) => {
    if (tab === 'scene') deleteSceneTemplate(id);
    else deleteAnimationTemplate(id);
    refresh();
  };

  const handleRename = (id: string, name: string) => {
    if (tab === 'scene') updateSceneTemplate(id, name);
    setEditingId(null);
    refresh();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const t = await importTemplate(file);
      if ('actions' in t) {
        saveAnimationTemplate(t.name, (t as AnimationTemplate).prompt, (t as AnimationTemplate).duration, t.scene, (t as AnimationTemplate).actions);
      } else {
        saveSceneTemplate(t.name, t.scene);
      }
      refresh();
    } catch { alert('Invalid template file'); }
    e.target.value = '';
  };

  const items = tab === 'scene' ? sceneTemplates : animTemplates;

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="flex text-[10px] font-bold border-b border-gray-100">
        <button
          onClick={() => setTab('scene')}
          className={`flex-1 py-2 transition-all ${tab === 'scene' ? 'border-b-2 border-violet-600 text-violet-700' : 'text-gray-400'}`}
        >
          📋 Scenes ({sceneTemplates.length})
        </button>
        <button
          onClick={() => setTab('animation')}
          className={`flex-1 py-2 transition-all ${tab === 'animation' ? 'border-b-2 border-violet-600 text-violet-700' : 'text-gray-400'}`}
        >
          🎬 Animations ({animTemplates.length})
        </button>
      </div>

      {/* Save row */}
      <div className="p-3 border-b border-gray-100 flex gap-1.5">
        <input
          type="text"
          value={saveName}
          onChange={e => setSaveName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder={scene.name}
          className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <button
          onClick={handleSave}
          className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white font-bold hover:bg-violet-700 transition-all whitespace-nowrap"
        >
          Save
        </button>
      </div>

      {/* Template list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {items.length === 0 && (
          <p className="text-center text-[10px] text-gray-300 py-6">No saved {tab === 'scene' ? 'scenes' : 'animations'} yet.</p>
        )}
        {items.map(t => (
          <div key={t.id} className="group flex items-start gap-2 p-2.5 rounded-xl border border-gray-100 bg-gray-50 hover:border-violet-200 hover:bg-violet-50 transition-all">
            <button
              className="flex-1 text-left min-w-0"
              onClick={() => {
                if (tab === 'scene') onLoadScene(t.scene);
                else {
                  const at = t as AnimationTemplate;
                  onLoadAnimation(at.scene, at.actions, at.duration, at.prompt);
                }
              }}
            >
              {editingId === t.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => handleRename(t.id, editName)}
                  onKeyDown={e => e.key === 'Enter' && handleRename(t.id, editName)}
                  onClick={e => e.stopPropagation()}
                  className="w-full text-xs font-bold border-b border-violet-400 bg-transparent outline-none"
                />
              ) : (
                <div className="text-xs font-bold text-gray-800 truncate">{t.name}</div>
              )}
              <div className="text-[9px] text-gray-400 mt-0.5">{timeAgo(t.createdAt)}</div>
            </button>
            {/* Actions */}
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
              <button
                title="Rename"
                onClick={() => { setEditingId(t.id); setEditName(t.name); }}
                className="text-[10px] w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-100"
              >✎</button>
              <button
                title="Export"
                onClick={() => exportTemplate(t)}
                className="text-[10px] w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50"
              >↓</button>
              <button
                title="Delete"
                onClick={() => handleDelete(t.id)}
                className="text-[10px] w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50"
              >×</button>
            </div>
          </div>
        ))}
      </div>

      {/* Import */}
      <div className="border-t border-gray-100 p-3 shrink-0">
        <input ref={importRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        <button
          onClick={() => importRef.current?.click()}
          className="w-full text-[10px] py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-violet-400 hover:text-violet-600 transition-all"
        >
          ↑ Import .json template
        </button>
      </div>
    </div>
  );
}
