import type { SceneState, AnimationAction } from './types';

export interface SceneTemplate {
  id: string;
  name: string;
  createdAt: number;
  scene: SceneState;
}

export interface AnimationTemplate {
  id: string;
  name: string;
  createdAt: number;
  prompt: string;
  duration: number;
  scene: SceneState;
  actions: AnimationAction[];
}

const SCENE_KEY = 'tactics-app:scene-templates';
const ANIM_KEY  = 'tactics-app:animation-templates';

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// ── Scene templates ──────────────────────────────────────────────────────────

export function loadSceneTemplates(): SceneTemplate[] {
  try { return JSON.parse(localStorage.getItem(SCENE_KEY) || '[]'); } catch { return []; }
}

export function saveSceneTemplate(name: string, scene: SceneState): SceneTemplate {
  const t: SceneTemplate = { id: uid(), name, createdAt: Date.now(), scene };
  const all = loadSceneTemplates();
  all.unshift(t);
  localStorage.setItem(SCENE_KEY, JSON.stringify(all.slice(0, 50)));
  return t;
}

export function deleteSceneTemplate(id: string): void {
  const all = loadSceneTemplates().filter(t => t.id !== id);
  localStorage.setItem(SCENE_KEY, JSON.stringify(all));
}

export function updateSceneTemplate(id: string, name: string): void {
  const all = loadSceneTemplates().map(t => t.id === id ? { ...t, name } : t);
  localStorage.setItem(SCENE_KEY, JSON.stringify(all));
}

// ── Animation templates ───────────────────────────────────────────────────────

export function loadAnimationTemplates(): AnimationTemplate[] {
  try { return JSON.parse(localStorage.getItem(ANIM_KEY) || '[]'); } catch { return []; }
}

export function saveAnimationTemplate(
  name: string, prompt: string, duration: number,
  scene: SceneState, actions: AnimationAction[]
): AnimationTemplate {
  const t: AnimationTemplate = { id: uid(), name, prompt, duration, createdAt: Date.now(), scene, actions };
  const all = loadAnimationTemplates();
  all.unshift(t);
  localStorage.setItem(ANIM_KEY, JSON.stringify(all.slice(0, 50)));
  return t;
}

export function deleteAnimationTemplate(id: string): void {
  const all = loadAnimationTemplates().filter(t => t.id !== id);
  localStorage.setItem(ANIM_KEY, JSON.stringify(all));
}

// ── Export / Import ───────────────────────────────────────────────────────────

export function exportTemplate(template: SceneTemplate | AnimationTemplate): void {
  const json = JSON.stringify(template, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${template.name.replace(/\s+/g, '_').toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importTemplate(file: File): Promise<SceneTemplate | AnimationTemplate> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try { resolve(JSON.parse(e.target?.result as string)); }
      catch { reject(new Error('Invalid template file')); }
    };
    reader.readAsText(file);
  });
}
