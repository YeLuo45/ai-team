// V124: D3 SkillGraph V2 — zoom/pan/tooltip/下钻 (RED tests)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  SkillGraphV2,
  ZoomController,
  TooltipRenderer,
  NodeSelector,
  computeGraphLayout,
  computeNodePositions,
  applyZoomTransform,
  applyPanTransform,
  nodeToScreen,
  screenToNode,
  DEFAULT_ZOOM_CONFIG,
  DEFAULT_PAN_CONFIG,
  DEFAULT_TOOLTIP_CONFIG,
  buildSkillNode,
  buildMemberNode,
  buildGraphLink,
  filterNodesByScore,
  filterLinksByScore,
  clusterNodesByCategory,
  type SkillNode,
  type MemberNode,
  type GraphLink,
  type GraphLayout,
  type ZoomConfig,
  type PanConfig,
} from '../src/components/views/SkillGraphV2.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------- buildSkillNode / buildMemberNode / buildGraphLink ----------
describe('V124 node + link builders', () => {
  it('buildSkillNode produces valid skill shape', () => {
    const n = buildSkillNode({ id: 's1', name: 'TypeScript', category: 'technical', avgScore: 80, memberCount: 3 });
    expect(n.id).toBe('s1');
    expect(n.name).toBe('TypeScript');
    expect(n.category).toBe('technical');
    expect(n.avgScore).toBe(80);
    expect(n.memberCount).toBe(3);
  });

  it('buildMemberNode produces valid member shape', () => {
    const m = buildMemberNode({ id: 'm1', name: 'Alice', team: 'Web', role: 'FE', level: 'P5', skillCount: 5 });
    expect(m.id).toBe('m1');
    expect(m.skillCount).toBe(5);
  });

  it('buildGraphLink produces valid link', () => {
    const l = buildGraphLink({ source: 'm1', target: 's1', score: 80 });
    expect(l.source).toBe('m1');
    expect(l.target).toBe('s1');
    expect(l.score).toBe(80);
  });
});

// ---------- computeNodePositions / computeGraphLayout ----------
describe('V124 layout computation', () => {
  const skills: SkillNode[] = [
    buildSkillNode({ id: 's1', name: 'TypeScript', category: 'technical', avgScore: 80, memberCount: 3 }),
    buildSkillNode({ id: 's2', name: 'React', category: 'technical', avgScore: 70, memberCount: 2 }),
  ];
  const members: MemberNode[] = [
    buildMemberNode({ id: 'm1', name: 'Alice', team: 'Web', role: 'FE', level: 'P5', skillCount: 2 }),
  ];
  const links: GraphLink[] = [
    buildGraphLink({ source: 'm1', target: 's1', score: 80 }),
    buildGraphLink({ source: 'm1', target: 's2', score: 70 }),
  ];

  it('computeNodePositions returns one entry per node', () => {
    const positions = computeNodePositions(skills, members, { width: 800, height: 600 });
    expect(positions.length).toBe(skills.length + members.length);
    for (const p of positions) {
      expect(typeof p.x).toBe('number');
      expect(typeof p.y).toBe('number');
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(800);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(600);
    }
  });

  it('computeGraphLayout aggregates nodes + links + viewport', () => {
    const layout = computeGraphLayout(skills, members, links);
    expect(layout.nodes.length).toBe(3);
    expect(layout.links.length).toBe(2);
    expect(layout.viewport).toBeDefined();
    expect(layout.viewport.width).toBeGreaterThan(0);
    expect(layout.viewport.height).toBeGreaterThan(0);
  });
});

// ---------- applyZoomTransform / applyPanTransform ----------
describe('V124 zoom + pan transforms', () => {
  it('applyZoomTransform scales coordinates', () => {
    const cfg: ZoomConfig = { ...DEFAULT_ZOOM_CONFIG, initialScale: 2 };
    const result = applyZoomTransform({ x: 100, y: 100 }, cfg);
    expect(result.x).toBe(200);
    expect(result.y).toBe(200);
  });

  it('applyZoomTransform clamps to min/max scale', () => {
    const tooSmall = applyZoomTransform({ x: 10, y: 10 }, { ...DEFAULT_ZOOM_CONFIG, initialScale: 0.01 });
    expect(tooSmall.scale).toBe(DEFAULT_ZOOM_CONFIG.minScale);

    const tooBig = applyZoomTransform({ x: 10, y: 10 }, { ...DEFAULT_ZOOM_CONFIG, initialScale: 999 });
    expect(tooBig.scale).toBe(DEFAULT_ZOOM_CONFIG.maxScale);
  });

  it('applyPanTransform translates coordinates', () => {
    const cfg: PanConfig = { ...DEFAULT_PAN_CONFIG, offsetX: 50, offsetY: 30 };
    const result = applyPanTransform({ x: 100, y: 100 }, cfg);
    expect(result.x).toBe(150);
    expect(result.y).toBe(130);
  });

  it('DEFAULT_ZOOM_CONFIG has min/max/initial scale', () => {
    expect(DEFAULT_ZOOM_CONFIG.minScale).toBeGreaterThan(0);
    expect(DEFAULT_ZOOM_CONFIG.maxScale).toBeGreaterThan(DEFAULT_ZOOM_CONFIG.minScale);
    expect(DEFAULT_ZOOM_CONFIG.initialScale).toBeGreaterThanOrEqual(DEFAULT_ZOOM_CONFIG.minScale);
  });

  it('DEFAULT_PAN_CONFIG defaults to no offset', () => {
    expect(DEFAULT_PAN_CONFIG.offsetX).toBe(0);
    expect(DEFAULT_PAN_CONFIG.offsetY).toBe(0);
  });
});

// ---------- nodeToScreen / screenToNode ----------
describe('V124 coordinate transforms', () => {
  it('nodeToScreen applies zoom + pan', () => {
    const screen = nodeToScreen({ x: 100, y: 100 }, { scale: 2 }, { offsetX: 50, offsetY: 30 });
    expect(screen.x).toBe(250);
    expect(screen.y).toBe(230);
  });

  it('screenToNode reverses transform', () => {
    const node = screenToNode({ x: 250, y: 230 }, { scale: 2 }, { offsetX: 50, offsetY: 30 });
    expect(node.x).toBeCloseTo(100);
    expect(node.y).toBeCloseTo(100);
  });
});

// ---------- filterNodesByScore / filterLinksByScore ----------
describe('V124 filtering', () => {
  const skills: SkillNode[] = [
    buildSkillNode({ id: 's1', name: 'TS', category: 'technical', avgScore: 80, memberCount: 3 }),
    buildSkillNode({ id: 's2', name: 'React', category: 'technical', avgScore: 50, memberCount: 2 }),
    buildSkillNode({ id: 's3', name: 'CSS', category: 'technical', avgScore: 30, memberCount: 1 }),
  ];
  const links: GraphLink[] = [
    buildGraphLink({ source: 'm1', target: 's1', score: 80 }),
    buildGraphLink({ source: 'm1', target: 's2', score: 50 }),
    buildGraphLink({ source: 'm1', target: 's3', score: 30 }),
  ];

  it('filterNodesByScore filters by minScore', () => {
    const filtered = filterNodesByScore(skills, 50);
    expect(filtered.length).toBe(2);
    expect(filtered.map((n) => n.id)).toEqual(['s1', 's2']);
  });

  it('filterLinksByScore filters links by minScore', () => {
    const filtered = filterLinksByScore(links, 50);
    expect(filtered.length).toBe(2);
  });
});

// ---------- clusterNodesByCategory ----------
describe('V124 clustering', () => {
  it('groups nodes by category', () => {
    const skills: SkillNode[] = [
      buildSkillNode({ id: 's1', name: 'TS', category: 'technical', avgScore: 80, memberCount: 1 }),
      buildSkillNode({ id: 's2', name: 'Communication', category: 'soft', avgScore: 70, memberCount: 1 }),
    ];
    const clusters = clusterNodesByCategory(skills);
    expect(Object.keys(clusters).sort()).toEqual(['soft', 'technical']);
    expect(clusters.technical?.length).toBe(1);
    expect(clusters.soft?.length).toBe(1);
  });
});

// ---------- ZoomController ----------
describe('V124 ZoomController', () => {
  it('zooms in / out within bounds', () => {
    const ctl = new ZoomController({ ...DEFAULT_ZOOM_CONFIG, initialScale: 1 });
    ctl.zoomIn();
    expect(ctl.getScale()).toBeGreaterThan(1);
    ctl.zoomOut();
    expect(ctl.getScale()).toBe(1);
    ctl.zoomOut();
    expect(ctl.getScale()).toBeLessThan(1);
  });

  it('clamps at min/max', () => {
    const ctl = new ZoomController(DEFAULT_ZOOM_CONFIG);
    for (let i = 0; i < 50; i++) ctl.zoomIn();
    expect(ctl.getScale()).toBe(DEFAULT_ZOOM_CONFIG.maxScale);
    for (let i = 0; i < 100; i++) ctl.zoomOut();
    expect(ctl.getScale()).toBe(DEFAULT_ZOOM_CONFIG.minScale);
  });

  it('reset restores initial scale', () => {
    const ctl = new ZoomController(DEFAULT_ZOOM_CONFIG);
    ctl.zoomIn();
    ctl.reset();
    expect(ctl.getScale()).toBe(DEFAULT_ZOOM_CONFIG.initialScale);
  });

  it('subscribe fires on scale change', () => {
    const ctl = new ZoomController(DEFAULT_ZOOM_CONFIG);
    const cb = vi.fn();
    ctl.subscribe(cb);
    ctl.zoomIn();
    expect(cb).toHaveBeenCalled();
  });
});

// ---------- NodeSelector ----------
describe('V124 NodeSelector', () => {
  it('returns null when no selection', () => {
    const sel = new NodeSelector();
    expect(sel.get()).toBeNull();
  });

  it('select / get / clear', () => {
    const sel = new NodeSelector();
    sel.select('m1');
    expect(sel.get()).toBe('m1');
    sel.clear();
    expect(sel.get()).toBeNull();
  });

  it('subscribe fires on select / clear', () => {
    const sel = new NodeSelector();
    const cb = vi.fn();
    sel.subscribe(cb);
    sel.select('s1');
    sel.clear();
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('subscribe can be unsubscribed', () => {
    const sel = new NodeSelector();
    const cb = vi.fn();
    const unsub = sel.subscribe(cb);
    sel.select('s1');
    unsub();
    sel.select('s2');
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

// ---------- DEFAULT_TOOLTIP_CONFIG ----------
describe('V124 TooltipRenderer', () => {
  it('renders title and content', () => {
    const t = new TooltipRenderer(DEFAULT_TOOLTIP_CONFIG);
    const html = t.render({ title: 'Alice', content: 'FE / Web' });
    expect(html).toContain('Alice');
    expect(html).toContain('FE');
  });

  it('respects offset', () => {
    const t = new TooltipRenderer({ ...DEFAULT_TOOLTIP_CONFIG, offsetX: 20, offsetY: 10 });
    const html = t.render({ title: 'Bob', content: 'x' });
    expect(html).toContain('left:20px');
    expect(html).toContain('top:10px');
  });

  it('escape HTML', () => {
    const t = new TooltipRenderer(DEFAULT_TOOLTIP_CONFIG);
    const html = t.render({ title: '<script>alert(1)</script>', content: 'y' });
    expect(html).not.toContain('<script>');
  });
});

// ---------- SkillGraphV2 component ----------
describe('V124 SkillGraphV2 component', () => {
  const skills: SkillNode[] = [
    buildSkillNode({ id: 's1', name: 'TypeScript', category: 'technical', avgScore: 80, memberCount: 3 }),
  ];
  const members: MemberNode[] = [
    buildMemberNode({ id: 'm1', name: 'Alice', team: 'Web', role: 'FE', level: 'P5', skillCount: 1 }),
  ];
  const links: GraphLink[] = [buildGraphLink({ source: 'm1', target: 's1', score: 80 })];

  it('renders SVG container with nodes + links', () => {
    render(
      <MemoryRouter>
        <SkillGraphV2 skills={skills} members={members} links={links} />
      </MemoryRouter>
    );
    expect(screen.getByTestId('skill-graph-v2')).toBeTruthy();
    expect(screen.getByTestId('node-s1')).toBeTruthy();
    expect(screen.getByTestId('node-m1')).toBeTruthy();
  });

  it('zoom in button increases scale', () => {
    render(
      <MemoryRouter>
        <SkillGraphV2 skills={skills} members={members} links={links} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('zoom-in'));
    const readout = screen.getByTestId('zoom-readout');
    expect(parseFloat(readout.textContent ?? '1')).toBeGreaterThan(1);
  });

  it('zoom out button decreases scale', () => {
    render(
      <MemoryRouter>
        <SkillGraphV2 skills={skills} members={members} links={links} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('zoom-out'));
    const readout = screen.getByTestId('zoom-readout');
    expect(parseFloat(readout.textContent ?? '1')).toBeLessThan(1);
  });

  it('reset button restores default', () => {
    render(
      <MemoryRouter>
        <SkillGraphV2 skills={skills} members={members} links={links} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('zoom-in'));
    fireEvent.click(screen.getByTestId('zoom-reset'));
    const readout = screen.getByTestId('zoom-readout');
    expect(parseFloat(readout.textContent ?? '0')).toBeCloseTo(1);
  });

  it('clicking a node opens drawer with details', () => {
    render(
      <MemoryRouter>
        <SkillGraphV2 skills={skills} members={members} links={links} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('node-s1'));
    expect(screen.getByTestId('node-drawer')).toBeTruthy();
  });

  it('filter input narrows down to high-score nodes', () => {
    const moreSkills: SkillNode[] = [
      ...skills,
      buildSkillNode({ id: 's2', name: 'CSS', category: 'technical', avgScore: 30, memberCount: 1 }),
    ];
    render(
      <MemoryRouter>
        <SkillGraphV2 skills={moreSkills} members={members} links={links} minScore={50} />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('node-s2')).toBeNull();
    expect(screen.getByTestId('node-s1')).toBeTruthy();
  });
});