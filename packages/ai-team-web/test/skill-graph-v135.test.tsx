// V135: SkillGraphV2 tooltip + Drawer integration (RED tests)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
  type GraphLayout,
} from '../src/components/views/index.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const skills: SkillNode[] = [
  buildSkillNode({ id: 'ts', name: 'TypeScript', avgScore: 90, category: 'technical', memberCount: 3 }),
  buildSkillNode({ id: 'react', name: 'React', avgScore: 85, category: 'tool', memberCount: 5 }),
];
const members: MemberNode[] = [buildMemberNode({ id: 'm1', name: 'Alice', team: 'Platform', role: 'lead', level: 'senior', skillCount: 4 })];
const links: GraphLink[] = [buildGraphLink({ source: 'ts', target: 'react', score: 80 })];

// ---------- Tooltip on hover ----------
describe('V135 SkillGraphV2 tooltip on hover', () => {
  it('does not show tooltip initially', () => {
    render(<SkillGraphV2 skills={skills} members={members} links={links} />);
    expect(screen.queryByTestId('node-tooltip')).toBeNull();
  });

  it('shows tooltip on mouse enter a skill node', () => {
    render(<SkillGraphV2 skills={skills} members={members} links={links} />);
    fireEvent.mouseEnter(screen.getByTestId('node-ts'));
    expect(screen.getByTestId('node-tooltip')).toBeTruthy();
    expect(screen.getByTestId('node-tooltip').textContent).toContain('TypeScript');
  });

  it('shows tooltip on mouse enter a member node', () => {
    render(<SkillGraphV2 skills={skills} members={members} links={links} />);
    fireEvent.mouseEnter(screen.getByTestId('node-m1'));
    expect(screen.getByTestId('node-tooltip')).toBeTruthy();
    expect(screen.getByTestId('node-tooltip').textContent).toContain('Alice');
  });

  it('hides tooltip on mouse leave', () => {
    render(<SkillGraphV2 skills={skills} members={members} links={links} />);
    const node = screen.getByTestId('node-ts');
    fireEvent.mouseEnter(node);
    expect(screen.getByTestId('node-tooltip')).toBeTruthy();
    fireEvent.mouseLeave(node);
    expect(screen.queryByTestId('node-tooltip')).toBeNull();
  });

  it('tooltip shows member-specific fields (team / role / level)', () => {
    render(<SkillGraphV2 skills={skills} members={members} links={links} />);
    fireEvent.mouseEnter(screen.getByTestId('node-m1'));
    const tip = screen.getByTestId('node-tooltip');
    expect(tip.textContent).toContain('Platform');
    expect(tip.textContent).toContain('lead');
    expect(tip.textContent).toContain('senior');
  });

  it('tooltip shows skill-specific fields (category / avgScore / memberCount)', () => {
    render(<SkillGraphV2 skills={skills} members={members} links={links} />);
    fireEvent.mouseEnter(screen.getByTestId('node-ts'));
    const tip = screen.getByTestId('node-tooltip');
    expect(tip.textContent).toContain('technical');
    expect(tip.textContent).toContain('90');
    expect(tip.textContent).toContain('3');
  });

  it('tooltip hidden when a node is selected (drawer takes over)', () => {
    render(<SkillGraphV2 skills={skills} members={members} links={links} />);
    fireEvent.mouseEnter(screen.getByTestId('node-ts'));
    expect(screen.getByTestId('node-tooltip')).toBeTruthy();
    fireEvent.click(screen.getByTestId('node-ts'));
    // drawer opens, tooltip should be hidden
    expect(screen.getByTestId('node-drawer')).toBeTruthy();
    expect(screen.queryByTestId('node-tooltip')).toBeNull();
  });
});

// ---------- Drawer detail ----------
describe('V135 SkillGraphV2 Drawer detail', () => {
  it('click opens drawer with node name', () => {
    render(<SkillGraphV2 skills={skills} members={members} links={links} />);
    fireEvent.click(screen.getByTestId('node-ts'));
    const drawer = screen.getByTestId('node-drawer');
    expect(drawer.textContent).toContain('TypeScript');
  });

  it('close button clears drawer', () => {
    render(<SkillGraphV2 skills={skills} members={members} links={links} />);
    fireEvent.click(screen.getByTestId('node-ts'));
    expect(screen.getByTestId('node-drawer')).toBeTruthy();
    // find the close button (×) inside the drawer
    const closeBtn = screen.getByTestId('node-drawer').querySelector('button') as HTMLButtonElement;
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('node-drawer')).toBeNull();
  });

  it('onNodeSelect callback fires with selected id', () => {
    const onSelect = vi.fn();
    render(<SkillGraphV2 skills={skills} members={members} links={links} onNodeSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('node-m1'));
    expect(onSelect).toHaveBeenCalledWith('m1');
  });
});

// ---------- Zoom controls ----------
describe('V135 SkillGraphV2 zoom + pan integration', () => {
  it('zoom in button scales up', () => {
    render(<SkillGraphV2 skills={skills} members={members} links={links} />);
    const before = screen.getByTestId('zoom-readout').textContent;
    fireEvent.click(screen.getByTestId('zoom-in'));
    const after = screen.getByTestId('zoom-readout').textContent;
    expect(before).not.toBe(after);
  });

  it('zoom out button scales down', () => {
    render(<SkillGraphV2 skills={skills} members={members} links={links} />);
    const before = screen.getByTestId('zoom-readout').textContent;
    fireEvent.click(screen.getByTestId('zoom-out'));
    const after = screen.getByTestId('zoom-readout').textContent;
    expect(before).not.toBe(after);
  });

  it('zoom reset button restores initial scale', () => {
    render(<SkillGraphV2 skills={skills} members={members} links={links} />);
    fireEvent.click(screen.getByTestId('zoom-in'));
    fireEvent.click(screen.getByTestId('zoom-reset'));
    const after = screen.getByTestId('zoom-readout').textContent;
    expect(after).toContain('1.00');
  });
});

// ---------- TooltipRenderer + node helpers ----------
describe('V135 pure helpers', () => {
  it('buildGraphLink round-trips score', () => {
    const l = buildGraphLink({ source: 'a', target: 'b', score: 60 });
    expect(l.score).toBe(60);
  });

  it('TooltipRenderer renders HTML with offset', () => {
    const t = new TooltipRenderer({ ...DEFAULT_TOOLTIP_CONFIG, offsetX: 10, offsetY: 5 });
    const html = t.render({ title: 'X', content: 'Y' });
    expect(html).toContain('left:10px');
    expect(html).toContain('top:5px');
    expect(html).toContain('X');
  });

  it('applyPanTransform composes with multiple offsets', () => {
    const p1 = applyPanTransform({ x: 0, y: 0 }, { ...DEFAULT_PAN_CONFIG, offsetX: 10, offsetY: 5 });
    const p2 = applyPanTransform(p1, { ...DEFAULT_PAN_CONFIG, offsetX: 20, offsetY: 10 });
    expect(p2.x).toBe(30);
    expect(p2.y).toBe(15);
  });

  it('applyZoomTransform applies initialScale', () => {
    const r = applyZoomTransform({ x: 50, y: 50 }, { ...DEFAULT_ZOOM_CONFIG, initialScale: 2 });
    expect(r.x).toBe(100);
    expect(r.y).toBe(100);
  });
});