// V136: Skill + Member detail panels + Drawer state hooks + Toolbar

import { ReactNode, useState } from 'react';
import { TooltipRenderer, DEFAULT_TOOLTIP_CONFIG } from './SkillGraphV2.js';

// ---------- Types ----------
export interface SkillNode {
  id: string;
  name: string;
  category: string;
  avgScore: number;
  memberCount: number;
}

export interface MemberNode {
  id: string;
  name: string;
  team: string;
  role: string;
  level: string;
  skillCount: number;
}

export interface GraphLink {
  source: string;
  target: string;
  score: number;
}

export interface DrawerState<T> {
  item: T | null;
  open: boolean;
}

export interface CombinedDrawerState {
  skill: SkillNode | null;
  member: MemberNode | null;
  skillOpen: boolean;
  memberOpen: boolean;
}

// ---------- Score tier ----------
export function scoreTier(score: number): 'novice' | 'intermediate' | 'advanced' | 'expert' {
  if (score >= 85) return 'expert';
  if (score >= 70) return 'advanced';
  if (score >= 50) return 'intermediate';
  return 'novice';
}

// ---------- SkillDetailPanel ----------
export function SkillDetailPanel({ skill }: { skill: SkillNode }) {
  const tier = scoreTier(skill.avgScore);
  const tierLabel =
    tier === 'expert' ? '专家' : tier === 'advanced' ? '高级' : tier === 'intermediate' ? '中级' : '初级';
  return (
    <div data-testid="skill-detail-panel" className="text-xs">
      <div className="flex items-center justify-between">
        <strong className="text-sm">{skill.name}</strong>
        <span
          data-testid="skill-tier"
          data-tier={tier}
          className={`rounded px-2 py-0.5 text-xs ${tier === 'expert' ? 'bg-emerald-100 text-emerald-700' : tier === 'advanced' ? 'bg-sky-100 text-sky-700' : tier === 'intermediate' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}
        >
          {tierLabel}
        </span>
      </div>
      <dl className="mt-2 space-y-1">
        <div className="flex justify-between">
          <dt className="text-slate-500">分类</dt>
          <dd>{skill.category}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">均分</dt>
          <dd>{skill.avgScore}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">成员数</dt>
          <dd>{skill.memberCount}</dd>
        </div>
      </dl>
    </div>
  );
}

// ---------- MemberDetailPanel ----------
export function MemberDetailPanel({ member }: { member: MemberNode }) {
  return (
    <div data-testid="member-detail-panel" className="text-xs">
      <div className="flex items-center justify-between">
        <strong className="text-sm">{member.name}</strong>
        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{member.level}</span>
      </div>
      <dl className="mt-2 space-y-1">
        <div className="flex justify-between">
          <dt className="text-slate-500">团队</dt>
          <dd>{member.team}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">角色</dt>
          <dd>{member.role}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">技能数</dt>
          <dd>{member.skillCount}</dd>
        </div>
      </dl>
    </div>
  );
}

// ---------- SkillGraphToolbar ----------
export interface SkillGraphToolbarProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  extra?: ReactNode;
}

export function SkillGraphToolbar({ scale, onZoomIn, onZoomOut, onReset, extra }: SkillGraphToolbarProps) {
  return (
    <div
      data-testid="skill-graph-toolbar"
      className="absolute right-2 top-2 flex flex-col gap-1 rounded border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-800"
    >
      <button data-testid="zoom-in" onClick={onZoomIn} aria-label="放大" className="rounded px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-700">+</button>
      <button data-testid="zoom-out" onClick={onZoomOut} aria-label="缩小" className="rounded px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-700">−</button>
      <button data-testid="zoom-reset" onClick={onReset} aria-label="重置" className="rounded px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-700">⌂</button>
      <span data-testid="zoom-readout" className="rounded bg-slate-100 px-2 py-1 text-center text-xs dark:bg-slate-700">
        {scale.toFixed(2)}×
      </span>
      {extra}
    </div>
  );
}

// ---------- Pure helpers ----------
export function filterNodesByScore<T extends { avgScore?: number }>(nodes: T[], threshold: number): T[] {
  return nodes.filter((n) => (n.avgScore ?? 0) >= threshold);
}

export function filterLinksByScore<T extends { score: number }>(links: T[], threshold: number): T[] {
  return links.filter((l) => l.score >= threshold);
}

export function clusterNodesByCategory(nodes: SkillNode[]): Record<string, SkillNode[]> {
  const out: Record<string, SkillNode[]> = {};
  for (const n of nodes) {
    if (!out[n.category]) out[n.category] = [];
    out[n.category]!.push(n);
  }
  return out;
}

// ---------- Drawer state hooks ----------
export function useSkillDrawerState(): DrawerState<SkillNode> {
  const [skill, _setSkill] = useState<SkillNode | null>(null);
  return { item: skill, open: skill !== null };
}

export function useMemberDrawerState(): DrawerState<MemberNode> {
  const [member, setMember] = useState<MemberNode | null>(null);
  void setMember;
  return { item: member, open: member !== null };
}

export function combineDrawerStates(skill: DrawerState<SkillNode>, member: DrawerState<MemberNode>): CombinedDrawerState {
  return {
    skill: skill.item,
    member: member.item,
    skillOpen: skill.open,
    memberOpen: member.open,
  };
}

// Re-export TooltipRenderer for convenience
export { TooltipRenderer, DEFAULT_TOOLTIP_CONFIG };