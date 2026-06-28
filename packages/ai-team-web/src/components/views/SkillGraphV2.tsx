// V124: D3 SkillGraph V2 — zoom/pan/tooltip/下钻 — pure logic + React component

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';

// ---------- Types ----------
export interface SkillNode {
  id: string;
  name: string;
  category: 'technical' | 'soft' | 'domain' | 'tool' | string;
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

export interface GraphLayout {
  nodes: Array<SkillNode | MemberNode>;
  links: GraphLink[];
  viewport: { width: number; height: number };
}

export interface ZoomConfig {
  minScale: number;
  maxScale: number;
  initialScale: number;
  step: number;
}

export interface PanConfig {
  offsetX: number;
  offsetY: number;
}

export interface TooltipConfig {
  offsetX: number;
  offsetY: number;
  className: string;
}

export interface TooltipData {
  title: string;
  content: string;
}

// ---------- Defaults ----------
export const DEFAULT_ZOOM_CONFIG: ZoomConfig = {
  minScale: 0.25,
  maxScale: 4,
  initialScale: 1,
  step: 1.2,
};

export const DEFAULT_PAN_CONFIG: PanConfig = {
  offsetX: 0,
  offsetY: 0,
};

export const DEFAULT_TOOLTIP_CONFIG: TooltipConfig = {
  offsetX: 12,
  offsetY: 12,
  className: 'skill-graph-tooltip',
};

// ---------- Builders ----------
export function buildSkillNode(input: {
  id: string;
  name: string;
  category: string;
  avgScore: number;
  memberCount: number;
}): SkillNode {
  return {
    id: input.id,
    name: input.name,
    category: input.category,
    avgScore: input.avgScore,
    memberCount: input.memberCount,
  };
}

export function buildMemberNode(input: {
  id: string;
  name: string;
  team: string;
  role: string;
  level: string;
  skillCount: number;
}): MemberNode {
  return {
    id: input.id,
    name: input.name,
    team: input.team,
    role: input.role,
    level: input.level,
    skillCount: input.skillCount,
  };
}

export function buildGraphLink(input: { source: string; target: string; score: number }): GraphLink {
  return { source: input.source, target: input.target, score: input.score };
}

// ---------- Layout ----------
export interface PositionedNode {
  id: string;
  x: number;
  y: number;
  type: 'skill' | 'member';
}

export function computeNodePositions(
  skills: SkillNode[],
  members: MemberNode[],
  viewport: { width: number; height: number }
): PositionedNode[] {
  const all = [...skills.map((s) => ({ ...s, _type: 'skill' as const })), ...members.map((m) => ({ ...m, _type: 'member' as const }))];
  const radius = Math.min(viewport.width, viewport.height) * 0.35;
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  return all.map((node, i) => {
    const angle = (2 * Math.PI * i) / all.length;
    return {
      id: node.id,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      type: node._type,
    };
  });
}

export function computeGraphLayout(
  skills: SkillNode[],
  members: MemberNode[],
  links: GraphLink[],
  viewport: { width: number; height: number } = { width: 800, height: 600 }
): GraphLayout {
  return { nodes: [...skills, ...members], links, viewport };
}

// ---------- Transforms ----------
export interface Point {
  x: number;
  y: number;
}

export interface ZoomState extends Point {
  scale: number;
}

export function applyZoomTransform(point: Point, config: ZoomConfig): ZoomState {
  // Use the requested scale, then clamp to bounds
  const raw = config.initialScale;
  const scale = Math.max(config.minScale, Math.min(config.maxScale, raw));
  return { x: point.x * scale, y: point.y * scale, scale };
}

export function applyPanTransform(point: Point, config: PanConfig): Point {
  return { x: point.x + config.offsetX, y: point.y + config.offsetY };
}

export function nodeToScreen(point: Point, zoom: { scale: number }, pan: PanConfig): Point {
  // Scale first, then pan
  return applyPanTransform({ x: point.x * zoom.scale, y: point.y * zoom.scale }, pan);
}

export function screenToNode(point: Point, zoom: { scale: number }, pan: PanConfig): Point {
  return {
    x: (point.x - pan.offsetX) / zoom.scale,
    y: (point.y - pan.offsetY) / zoom.scale,
  };
}

// ---------- Filters ----------
export function filterNodesByScore(nodes: SkillNode[], minScore: number): SkillNode[] {
  return nodes.filter((n) => n.avgScore >= minScore);
}

export function filterLinksByScore(links: GraphLink[], minScore: number): GraphLink[] {
  return links.filter((l) => l.score >= minScore);
}

export function clusterNodesByCategory(nodes: SkillNode[]): Record<string, SkillNode[]> {
  const out: Record<string, SkillNode[]> = {};
  for (const n of nodes) {
    if (!out[n.category]) out[n.category] = [];
    out[n.category].push(n);
  }
  return out;
}

// ---------- ZoomController ----------
type ZoomListener = (scale: number) => void;

export class ZoomController {
  private current: number;
  private listeners: Set<ZoomListener> = new Set();
  constructor(private config: ZoomConfig) {
    this.current = config.initialScale;
  }

  getScale(): number {
    return this.current;
  }

  zoomIn(): void {
    this.setScale(this.current * this.config.step);
  }

  zoomOut(): void {
    this.setScale(this.current / this.config.step);
  }

  reset(): void {
    this.setScale(this.config.initialScale);
  }

  setScale(scale: number): void {
    const next = Math.max(this.config.minScale, Math.min(this.config.maxScale, scale));
    if (next !== this.current) {
      this.current = next;
      for (const l of this.listeners) l(this.current);
    }
  }

  subscribe(listener: ZoomListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

// ---------- NodeSelector ----------
type SelectionListener = (id: string | null) => void;

export class NodeSelector {
  private current: string | null = null;
  private listeners: Set<SelectionListener> = new Set();

  get(): string | null {
    return this.current;
  }

  select(id: string): void {
    if (this.current !== id) {
      this.current = id;
      for (const l of this.listeners) l(this.current);
    }
  }

  clear(): void {
    if (this.current !== null) {
      this.current = null;
      for (const l of this.listeners) l(this.current);
    }
  }

  subscribe(listener: SelectionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

// ---------- TooltipRenderer ----------
export class TooltipRenderer {
  constructor(private config: TooltipConfig) {}

  render(data: TooltipData): string {
    const safe = (s: string) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    return `<div class="${this.config.className}" style="position:absolute;left:${this.config.offsetX}px;top:${this.config.offsetY}px;pointer-events:none"><strong>${safe(data.title)}</strong><br/>${safe(data.content)}</div>`;
  }
}

// ---------- SkillGraphV2 React component ----------
export interface SkillGraphV2Props {
  skills: SkillNode[];
  members: MemberNode[];
  links: GraphLink[];
  minScore?: number;
  width?: number;
  height?: number;
  zoomConfig?: ZoomConfig;
  panConfig?: PanConfig;
  tooltipConfig?: TooltipConfig;
  onNodeSelect?: (id: string | null) => void;
  detailPanel?: ReactNode;
}

export function SkillGraphV2({
  skills,
  members,
  links,
  minScore = 0,
  width = 800,
  height = 600,
  zoomConfig = DEFAULT_ZOOM_CONFIG,
  panConfig = DEFAULT_PAN_CONFIG,
  onNodeSelect,
  detailPanel,
}: SkillGraphV2Props) {
  const tooltipConfig: unknown = DEFAULT_TOOLTIP_CONFIG;
  void tooltipConfig;
  const filteredSkills = useMemo(() => filterNodesByScore(skills, minScore), [skills, minScore]);
  const filteredLinks = useMemo(() => filterLinksByScore(links, minScore), [links, minScore]);
  const positions = useMemo(
    () => computeNodePositions(filteredSkills, members, { width, height }),
    [filteredSkills, members, width, height]
  );
  const positionMap = useMemo(() => {
    const m = new Map<string, PositionedNode>();
    for (const p of positions) m.set(p.id, p);
    return m;
  }, [positions]);

  const [zoomState, setZoomState] = useState<ZoomState>({ x: 0, y: 0, scale: zoomConfig.initialScale });
  const [panState, setPanState] = useState<PanConfig>(panConfig);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const zoomRef = useRef<ZoomController | null>(null);
  const selRef = useRef<NodeSelector | null>(null);

  useEffect(() => {
    if (!zoomRef.current) zoomRef.current = new ZoomController(zoomConfig);
    zoomRef.current.setScale(zoomState.scale);
    const unsub = zoomRef.current.subscribe((scale) => setZoomState((prev) => ({ ...prev, scale })));
    return () => {
      unsub();
    };
  }, [zoomConfig, zoomState.scale]);

  useEffect(() => {
    setPanState(panConfig);
  }, [panConfig]);

  useEffect(() => {
    if (!selRef.current) selRef.current = new NodeSelector();
    const sel = selRef.current;
    const unsub = sel.subscribe((id) => {
      setSelectedId(id);
      onNodeSelect?.(id);
    });
    return () => {
      unsub();
    };
  }, [onNodeSelect]);

  function handleZoomIn() {
    zoomRef.current?.zoomIn();
  }
  function handleZoomOut() {
    zoomRef.current?.zoomOut();
  }
  function handleZoomReset() {
    zoomRef.current?.reset();
  }

  function handleNodeClick(id: string) {
    selRef.current?.select(id);
  }
  function handleCloseDrawer() {
    selRef.current?.clear();
  }

  const selectedNode = selectedId ? skills.find((s) => s.id === selectedId) ?? members.find((m) => m.id === selectedId) ?? null : null;

  return (
    <div data-testid="skill-graph-v2" className="relative" style={{ width, height }}>
      <svg width={width} height={height} className="bg-slate-50 dark:bg-slate-900">
        <g transform={`translate(${panState.offsetX}, ${panState.offsetY}) scale(${zoomState.scale})`}>
          {filteredLinks.map((l) => {
            const src = positionMap.get(l.source);
            const tgt = positionMap.get(l.target);
            if (!src || !tgt) return null;
            const opacity = Math.max(0.1, Math.min(1, l.score / 100));
            return (
              <line
                key={`${l.source}-${l.target}`}
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke="#94a3b8"
                strokeOpacity={opacity}
                strokeWidth={Math.max(0.5, l.score / 25)}
              />
            );
          })}
          {filteredSkills.map((s) => {
            const p = positionMap.get(s.id);
            if (!p) return null;
            const r = 8 + s.memberCount * 2;
            const fill = s.category === 'technical' ? '#4f46e5' : s.category === 'soft' ? '#10b981' : '#a855f7';
            return (
              <g key={s.id} data-testid={`node-${s.id}`} onClick={() => handleNodeClick(s.id)} className="cursor-pointer">
                <circle cx={p.x} cy={p.y} r={r} fill={fill} opacity={selectedId === s.id ? 1 : 0.7} />
                <text x={p.x} y={p.y + r + 12} textAnchor="middle" fontSize="10" fill="#475569">
                  {s.name}
                </text>
              </g>
            );
          })}
          {members.map((m) => {
            const p = positionMap.get(m.id);
            if (!p) return null;
            const size = 8 + m.skillCount * 2;
            return (
              <g key={m.id} data-testid={`node-${m.id}`} onClick={() => handleNodeClick(m.id)} className="cursor-pointer">
                <rect x={p.x - size / 2} y={p.y - size / 2} width={size} height={size} fill="#f59e0b" opacity={selectedId === m.id ? 1 : 0.7} />
                <text x={p.x} y={p.y + size / 2 + 12} textAnchor="middle" fontSize="10" fill="#475569">
                  {m.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute right-2 top-2 flex flex-col gap-1 rounded border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <button data-testid="zoom-in" onClick={handleZoomIn} className="rounded px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-700">+</button>
        <button data-testid="zoom-out" onClick={handleZoomOut} className="rounded px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-700">−</button>
        <button data-testid="zoom-reset" onClick={handleZoomReset} className="rounded px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-700">⌂</button>
        <span data-testid="zoom-readout" className="rounded bg-slate-100 px-2 py-1 text-center text-xs dark:bg-slate-700">
          {zoomState.scale.toFixed(2)}×
        </span>
      </div>

      {selectedNode && (
        <div
          data-testid="node-drawer"
          className="absolute right-2 top-20 w-64 rounded border border-slate-200 bg-white p-3 shadow-md dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between">
            <strong className="text-sm">{'name' in selectedNode ? selectedNode.name : (selectedNode as { id: string }).id}</strong>
            <button onClick={handleCloseDrawer} className="text-xs text-slate-500 hover:text-slate-700">×</button>
          </div>
          {detailPanel ?? (
            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              {'avgScore' in selectedNode && (
                <p>平均分：{selectedNode.avgScore}</p>
              )}
              {'team' in selectedNode && (
                <p>团队：{selectedNode.team}</p>
              )}
              {'role' in selectedNode && (
                <p>角色：{selectedNode.role}</p>
              )}
              {'level' in selectedNode && (
                <p>职级：{selectedNode.level}</p>
              )}
              {'category' in selectedNode && (
                <p>分类：{selectedNode.category}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}