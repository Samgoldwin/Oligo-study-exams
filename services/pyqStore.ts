/**
 * PYQ Analysis history — localStorage, per-browser.
 * Every generated plan is saved so students can reopen past analyses from the
 * sidebar (like chat conversations).
 */

import type { StudyPlan } from '../types';

const KEY = 'syncai.pyq.history.v1';
const MAX_ITEMS = 30;

export interface PyqHistoryItem {
  id: string;
  subject: string;
  createdAt: number;
  plan: StudyPlan;
}

function safeParse(raw: string | null): PyqHistoryItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listPyqHistory(): PyqHistoryItem[] {
  try {
    return safeParse(localStorage.getItem(KEY)).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function savePyqPlan(plan: StudyPlan): PyqHistoryItem {
  const item: PyqHistoryItem = {
    id: `pyq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    subject: plan.subject || 'Question Bank',
    createdAt: Date.now(),
    plan,
  };
  const next = [item, ...listPyqHistory()].slice(0, MAX_ITEMS);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full — non-fatal */
  }
  return item;
}

export function removePyqHistory(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(listPyqHistory().filter((i) => i.id !== id)));
  } catch {
    /* non-fatal */
  }
}

export function clearPyqHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* non-fatal */
  }
}
