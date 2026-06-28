// V136: SkillGraphV2 detail drawer (skill + member)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  SkillGraphV2,
  SkillDetailPanel,
  MemberDetailPanel,
  SkillGraphToolbar,
  buildSkillNode,
  buildMemberNode,
  buildGraphLink,
  filterNodesByScore,
  filterLinksByScore,
  clusterNodesByCategory,
  useSkillDrawerState,
  useMemberDrawerState,
  combineDrawerStates,
  type SkillNode,
  type MemberNode,
  type GraphLink,
  type DrawerState,
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
  buildSkillNode({ id: 'css', name: 'CSS', avgScore: 60, category: 'tool', memberCount: 2 }),
];
const members: MemberNode[] = [buildMemberNode({ id: 'm1', name: 'Alice', team: 'Platform', role: 'lead', level: 'senior', skillCount: 4 })];
const links: GraphLink[] = [
  buildGraphLink({ source: 'ts', target: 'react', score: 80 }),
  buildGraphLink({ source: 'react', target: 'css', score: 30 }),
];

// ---------- SkillDetailPanel ----------
describe('V136 SkillDetailPanel', () => {
  it('renders all skill fields', () => {
    const ts = skills[0]!;
    render(<SkillDetailPanel skill={ts} />);
    expect(screen.getByTestId('skill-detail-panel')).toBeTruthy();
    expect(screen.getByTestId('skill-detail-panel').textContent).toContain('TypeScript');
    expect(screen.getByTestId('skill-detail-panel').textContent).toContain('technical');
    expect(screen.getByTestId('skill-detail-panel').textContent).toContain('90');
    expect(screen.getByTestId('skill-detail-panel').textContent).toContain('3');
  });

  it('renders score tier badge', () => {
    render(<SkillDetailPanel skill={skills[0]!} />);
    const badge = screen.getByTestId('skill-tier');
    expect(badge).toBeTruthy();
    expect(badge.getAttribute('data-tier')).toBe('expert');
  });
});

// ---------- MemberDetailPanel ----------
describe('V136 MemberDetailPanel', () => {
  it('renders all member fields', () => {
    render(<MemberDetailPanel member={members[0]!} />);
    expect(screen.getByTestId('member-detail-panel')).toBeTruthy();
    expect(screen.getByTestId('member-detail-panel').textContent).toContain('Alice');
    expect(screen.getByTestId('member-detail-panel').textContent).toContain('Platform');
    expect(screen.getByTestId('member-detail-panel').textContent).toContain('lead');
    expect(screen.getByTestId('member-detail-panel').textContent).toContain('senior');
  });
});

// ---------- SkillGraphToolbar ----------
describe('V136 SkillGraphToolbar', () => {
  it('zoom controls render with labels', () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onReset = vi.fn();
    render(<SkillGraphToolbar scale={1} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onReset={onReset} />);
    expect(screen.getByTestId('zoom-in')).toBeTruthy();
    expect(screen.getByTestId('zoom-out')).toBeTruthy();
    expect(screen.getByTestId('zoom-reset')).toBeTruthy();
    expect(screen.getByTestId('zoom-readout').textContent).toContain('1.00');
  });

  it('invokes zoom handlers', () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onReset = vi.fn();
    render(<SkillGraphToolbar scale={2} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onReset={onReset} />);
    fireEvent.click(screen.getByTestId('zoom-in'));
    fireEvent.click(screen.getByTestId('zoom-out'));
    fireEvent.click(screen.getByTestId('zoom-reset'));
    expect(onZoomIn).toHaveBeenCalled();
    expect(onZoomOut).toHaveBeenCalled();
    expect(onReset).toHaveBeenCalled();
  });
});

// ---------- Filtering + clustering ----------
describe('V136 filtering + clustering', () => {
  it('filterNodesByScore keeps nodes with score >= threshold', () => {
    const out = filterNodesByScore(skills, 80);
    expect(out.length).toBe(2);
    expect(out.find((s) => s.id === 'css')).toBeUndefined();
  });

  it('filterLinksByScore keeps links with score >= threshold', () => {
    const out = filterLinksByScore(links, 50);
    expect(out.length).toBe(1);
    expect(out[0]!.source).toBe('ts');
  });

  it('clusterNodesByCategory groups by category', () => {
    const clusters = clusterNodesByCategory(skills);
    expect(clusters.technical?.length).toBe(1);
    expect(clusters.tool?.length).toBe(2);
  });
});

// ---------- Drawer state hooks ----------
describe('V136 drawer state hooks', () => {
  it('useSkillDrawerState returns null initially', () => {
    function Probe() {
      const state = useSkillDrawerState();
      return <div data-testid="state">{state.skill ? 'open' : 'closed'}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('state').textContent).toBe('closed');
  });

  it('useMemberDrawerState returns null initially', () => {
    function Probe() {
      const state = useMemberDrawerState();
      return <div data-testid="state">{state.member ? 'open' : 'closed'}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('state').textContent).toBe('closed');
  });

  it('combineDrawerStates merges skill + member drawer states', () => {
    const skill: DrawerState<SkillNode> = { item: skills[0]!, open: true };
    const member: DrawerState<MemberNode> = { item: members[0]!, open: false };
    const combined = combineDrawerStates(skill, member);
    expect(combined.skill?.id).toBe('ts');
    expect(combined.member?.id).toBe('m1');
    expect(combined.skillOpen).toBe(true);
    expect(combined.memberOpen).toBe(false);
  });
});

// ---------- SkillGraphV2 detail panel integration ----------
describe('V136 SkillGraphV2 with detailPanel prop', () => {
  it('uses custom detailPanel when provided', () => {
    render(
      <SkillGraphV2
        skills={skills}
        members={members}
        links={links}
        detailPanel={<div data-testid="custom-detail">CUSTOM</div>}
      />
    );
    fireEvent.click(screen.getByTestId('node-ts'));
    expect(screen.getByTestId('node-drawer')).toBeTruthy();
    expect(screen.getByTestId('custom-detail')).toBeTruthy();
    expect(screen.getByTestId('custom-detail').textContent).toBe('CUSTOM');
  });
});