// V134: cleanup pass — SkillGraphV2 tooltipConfig + legacy warning smoke
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  SkillGraphV2,
  buildSkillNode,
  buildMemberNode,
  buildGraphLink,
  computeNodePositions,
  applyZoomTransform,
  applyPanTransform,
  TooltipRenderer,
  DEFAULT_ZOOM_CONFIG,
  DEFAULT_PAN_CONFIG,
  DEFAULT_TOOLTIP_CONFIG,
  type SkillNode,
  type MemberNode,
  type GraphLink,
  type TooltipConfig,
} from '../src/components/views/index.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------- SkillGraphV2 accepts tooltipConfig ----------
describe('V134 SkillGraphV2 tooltipConfig integration', () => {
  const skills: SkillNode[] = [
    buildSkillNode({ id: 'ts', name: 'TypeScript', avgScore: 90, category: 'technical', memberCount: 3 }),
    buildSkillNode({ id: 'react', name: 'React', avgScore: 85, category: 'tool', memberCount: 5 }),
  ];
  const members: MemberNode[] = [buildMemberNode({ id: 'm1', name: 'Alice', team: 'Platform', role: 'lead', level: 'senior', skillCount: 4 })];
  const links: GraphLink[] = [buildGraphLink({ source: 'ts', target: 'react', score: 80 })];

  it('renders SVG with the configured nodes', () => {
    render(<SkillGraphV2 skills={skills} members={members} links={links} />);
    expect(screen.getByText('TypeScript')).toBeTruthy();
    expect(screen.getByText('React')).toBeTruthy();
  });

  it('accepts custom tooltipConfig without error', () => {
    const tooltipConfig: TooltipConfig = {
      ...DEFAULT_TOOLTIP_CONFIG,
      offsetX: 24,
      offsetY: 16,
      className: 'custom-tooltip',
    };
    render(
      <SkillGraphV2
        skills={skills}
        members={members}
        links={links}
        tooltipConfig={tooltipConfig}
      />
    );
    expect(screen.getByText('TypeScript')).toBeTruthy();
  });

  it('uses default tooltipConfig when not provided', () => {
    render(<SkillGraphV2 skills={skills} members={members} links={links} />);
    expect(screen.getByText('TypeScript')).toBeTruthy();
  });

  it('zoom + pan transforms compose with tooltipConfig offsets', () => {
    const positioned = computeNodePositions(skills, members, { width: 800, height: 600 });
    expect(positioned.length).toBeGreaterThan(0);
    const first = positioned[0]!;
    const zoomed = applyZoomTransform({ x: first.x, y: first.y }, DEFAULT_ZOOM_CONFIG);
    const panned = applyPanTransform(zoomed, DEFAULT_PAN_CONFIG);
    const tooltip = new TooltipRenderer(DEFAULT_TOOLTIP_CONFIG);
    const html = tooltip.render({ title: first.id, content: panned.x + ',' + panned.y });
    expect(html).toContain('left:');
    expect(html).toContain('top:');
  });
});

// ---------- Skill graph pure helpers ----------
describe('V134 skill graph pure helpers', () => {
  it('buildSkillNode returns a node with defaults', () => {
    const n = buildSkillNode({ id: 'a', name: 'A', avgScore: 0, category: 'technical', memberCount: 0 });
    expect(n.id).toBe('a');
    expect(n.name).toBe('A');
    expect(n.avgScore).toBe(0);
  });

  it('buildMemberNode returns a node with team', () => {
    const m = buildMemberNode({ id: 'm1', name: 'Bob', team: 'Growth', role: 'lead', level: 'mid', skillCount: 3 });
    expect(m.team).toBe('Growth');
  });

  it('buildGraphLink returns a link with score', () => {
    const l = buildGraphLink({ source: 'a', target: 'b', score: 50 });
    expect(l.score).toBe(50);
  });

  it('zoom clamps scale to [minScale, maxScale]', () => {
    const huge = applyZoomTransform({ x: 0, y: 0 }, { ...DEFAULT_ZOOM_CONFIG, initialScale: 10 });
    expect(huge.scale).toBeLessThanOrEqual(DEFAULT_ZOOM_CONFIG.maxScale);
  });

  it('pan applies offset to position', () => {
    const p = applyPanTransform({ x: 10, y: 20 }, { ...DEFAULT_PAN_CONFIG, offsetX: 5, offsetY: 15 });
    expect(p.x).toBe(15);
    expect(p.y).toBe(35);
  });
});