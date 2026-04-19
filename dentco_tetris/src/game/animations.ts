import type { ColorId } from '../constants/colors';
import { COLOR_HEX } from '../constants/colors';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

let textId = 1;

export interface VisualState {
  particles: Particle[];
  floatingTexts: FloatingText[];
  flash: number;
  shake: number;
}

export function createVisualState(): VisualState {
  return {
    particles: [],
    floatingTexts: [],
    flash: 0,
    shake: 0,
  };
}

export function spawnBlastParticles(state: VisualState, row: number, col: number, color: ColorId): void {
  const hex = COLOR_HEX[color];
  for (let i = 0; i < 7; i += 1) {
    state.particles.push({
      x: col + 0.5,
      y: row + 0.5,
      vx: (Math.random() - 0.5) * 2.8,
      vy: -Math.random() * 2.4,
      life: 380 + Math.random() * 220,
      maxLife: 620,
      radius: 0.06 + Math.random() * 0.05,
      color: hex,
    });
  }
}

export function spawnOutbreakPulse(state: VisualState, row: number, col: number): void {
  for (let i = 0; i < 6; i += 1) {
    state.particles.push({
      x: col + 0.5,
      y: row + 0.5,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      life: 220 + Math.random() * 140,
      maxLife: 420,
      radius: 0.05 + Math.random() * 0.03,
      color: '#2D355C',
    });
  }
}

export function pushFloatingText(state: VisualState, text: string, color = '#F0EFF8'): void {
  state.floatingTexts.push({
    id: textId,
    x: 3.5,
    y: 5,
    text,
    color,
    life: 900,
    maxLife: 900,
  });
  textId += 1;
}

export function triggerFlash(state: VisualState, amount = 1): void {
  state.flash = Math.min(1, state.flash + amount);
}

export function triggerShake(state: VisualState, amount = 1): void {
  state.shake = Math.min(1, state.shake + amount);
}

export function updateVisualState(state: VisualState, deltaMs: number): void {
  if (state.flash > 0) {
    state.flash = Math.max(0, state.flash - deltaMs * 0.0048);
  }

  if (state.shake > 0) {
    state.shake = Math.max(0, state.shake - deltaMs * 0.0055);
  }

  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.life -= deltaMs;
    p.x += p.vx * deltaMs * 0.001;
    p.y += p.vy * deltaMs * 0.001;
    p.vy += 3.4 * deltaMs * 0.001;

    if (p.life <= 0) {
      state.particles.splice(i, 1);
    }
  }

  for (let i = state.floatingTexts.length - 1; i >= 0; i -= 1) {
    const text = state.floatingTexts[i];
    text.life -= deltaMs;
    text.y -= deltaMs * 0.0015;
    if (text.life <= 0) {
      state.floatingTexts.splice(i, 1);
    }
  }
}
