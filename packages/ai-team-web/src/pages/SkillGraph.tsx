// Skill Graph - D3.js force-directed visualization
// Renders team members (squares) + skills (circles) with weighted edges

import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { api } from '../lib/api';

interface SkillNode {
  id: string;
  name: string;
  category: 'technical' | 'soft' | 'domain' | 'tool';
  avgScore: number;
  memberCount: number;
}

interface MemberNode {
  id: string;
  name: string;
  team: string;
  role: string;
  level: string;
  skillCount: number;
}

interface GraphLink {
  source: string;
  target: string;
  score: number;
}

interface GraphData {
  skills: SkillNode[];
  members: MemberNode[];
  links: GraphLink[];
}

const CATEGORY_COLORS: Record<string, string> = {
  technical: '#4f46e5',  // indigo
  soft: '#10b981',       // emerald
  domain: '#a855f7',     // purple
  tool: '#f59e0b',       // amber
};

const TEAM_COLORS: Record<string, string> = {
  'Web Platform': '#3b82f6',
  'Platform': '#ef4444',
  'Mobile': '#10b981',
  'Data': '#a855f7',
};

export function SkillGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [dataSource, setDataSource] = useState<'api' | 'static' | 'none'>('none');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (await api.isAvailable()) {
          const resp = await fetch('/api/skills/graph');
          const json = (await resp.json()) as GraphData;
          setData(json);
          setDataSource('api');
        } else {
          // Try static fallback (re-aggregate from local team data)
          const teamResp = await fetch(`${import.meta.env.BASE_URL}data/team.json`);
          const team = await teamResp.json();
          const members = team.members ?? [];
          const skills = team.skills ?? [];
          const skillStats = new Map<string, { total: number; count: number }>();
          for (const m of members) {
            for (const s of m.skills ?? []) {
              const cur = skillStats.get(s.skillId) ?? { total: 0, count: 0 };
              cur.total += s.score;
              cur.count += 1;
              skillStats.set(s.skillId, cur);
            }
          }
          const skillNodes = skills.map((s: any) => {
            const stat = skillStats.get(s.id);
            return { ...s, avgScore: stat ? Math.round(stat.total / stat.count) : 0, memberCount: stat?.count ?? 0 };
          });
          const memberNodes = members.map((m: any) => ({
            id: m.id, name: m.name, team: m.team, role: m.role, level: m.level ?? '', skillCount: (m.skills ?? []).length,
          }));
          const links: GraphLink[] = [];
          for (const m of members) {
            for (const s of m.skills ?? []) {
              links.push({ source: m.id, target: s.skillId, score: s.score });
            }
          }
          setData({ skills: skillNodes, members: memberNodes, links });
          setDataSource('static');
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredData = useMemo(() => {
    if (!data) return null;
    let skills = data.skills;
    let members = data.members;
    let links = data.links;
    if (categoryFilter !== 'all') {
      skills = skills.filter((s) => s.category === categoryFilter);
      const skillIds = new Set(skills.map((s) => s.id));
      links = links.filter((l) => skillIds.has(l.target));
      const memberIds = new Set(links.map((l) => l.source));
      members = members.filter((m) => memberIds.has(m.id));
    }
    if (teamFilter !== 'all') {
      members = members.filter((m) => m.team === teamFilter);
      const memberIds = new Set(members.map((m) => m.id));
      links = links.filter((l) => memberIds.has(l.source));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      skills = skills.filter((s) => s.name.toLowerCase().includes(q));
      members = members.filter((m) => m.name.toLowerCase().includes(q));
    }
    return { skills, members, links };
  }, [data, categoryFilter, teamFilter, search]);

  useEffect(() => {
    if (!filteredData || !svgRef.current) return;
    const width = 900;
    const height = 600;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('preserveAspectRatio', 'xMidYMid meet');

    // Arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#cbd5e1');

    const nodes: any[] = [
      ...filteredData.skills.map((s) => ({ ...s, type: 'skill' })),
      ...filteredData.members.map((m) => ({ ...m, type: 'member' })),
    ];
    const links = filteredData.links.map((l) => ({ ...l }));

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(80).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(30));

    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', (d: any) => Math.max(0.5, d.score / 30))
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', 'url(#arrowhead)');

    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d: any) => {
        setHoveredNode(d);
        d3.select(event.currentTarget).select('circle, rect').attr('stroke', '#1e293b').attr('stroke-width', 2);
      })
      .on('mouseleave', (event) => {
        setHoveredNode(null);
        d3.select(event.currentTarget).select('circle, rect').attr('stroke', '#fff').attr('stroke-width', 1.5);
      })
      .call(d3.drag<any, any>()
        .on('start', (event, d: any) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d: any) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d: any) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    // Skill nodes: circles
    node.filter((d: any) => d.type === 'skill')
      .append('circle')
      .attr('r', (d: any) => 8 + d.avgScore / 8)
      .attr('fill', (d: any) => CATEGORY_COLORS[d.category] ?? '#94a3b8')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);

    // Member nodes: rounded squares
    node.filter((d: any) => d.type === 'member')
      .append('rect')
      .attr('width', (d: any) => 14 + d.skillCount * 2)
      .attr('height', (d: any) => 14 + d.skillCount * 2)
      .attr('x', (d: any) => -(7 + d.skillCount))
      .attr('y', (d: any) => -(7 + d.skillCount))
      .attr('rx', 3)
      .attr('fill', (d: any) => TEAM_COLORS[d.team] ?? '#64748b')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);

    // Labels
    node.append('text')
      .text((d: any) => d.name)
      .attr('font-size', 10)
      .attr('text-anchor', 'middle')
      .attr('dy', (d: any) => (d.type === 'skill' ? 8 + d.avgScore / 8 + 12 : 7 + d.skillCount * 2 + 12))
      .attr('fill', '#1e293b')
      .attr('pointer-events', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
  }, [filteredData]);

  const allCategories = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.skills.map((s) => s.category)));
  }, [data]);

  const allTeams = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.members.map((m) => m.team)));
  }, [data]);

  if (loading) return <div className="text-slate-500">加载技能图谱...</div>;
  if (error) return <div className="text-rose-600">错误: {error}</div>;
  if (!data) return <div className="text-slate-500">暂无数据</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">技能图谱</h2>
          <p className="mt-1 text-sm text-slate-500">
            {data.skills.length} 技能 · {data.members.length} 成员 · {data.links.length} 关联
            {dataSource === 'static' && <span className="ml-2 badge-amber">静态数据</span>}
            {dataSource === 'api' && <span className="ml-2 badge-green">● 实时</span>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap items-center gap-3">
        <div>
          <label className="text-xs text-slate-500">类别</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800">
            <option value="all">全部</option>
            {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">团队</label>
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
            className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800">
            <option value="all">全部</option>
            {allTeams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="搜索技能或成员..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div className="flex gap-2 text-xs">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: CATEGORY_COLORS.technical }}></span>技术</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: CATEGORY_COLORS.soft }}></span>软技能</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: CATEGORY_COLORS.domain }}></span>领域</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: CATEGORY_COLORS.tool }}></span>工具</span>
        </div>
      </div>

      {/* Graph + legend */}
      <div className="card relative">
        <svg ref={svgRef} style={{ width: '100%', height: 600, display: 'block' }} />
        {hoveredNode && (
          <div className="absolute right-4 top-4 max-w-xs rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800">
            {hoveredNode.type === 'skill' ? (
              <>
                <div className="font-semibold text-slate-900 dark:text-slate-50">{hoveredNode.name}</div>
                <div className="mt-1 text-xs text-slate-500">类别: {hoveredNode.category}</div>
                <div className="text-xs text-slate-500">平均分: <span className="font-bold text-brand-600">{hoveredNode.avgScore}</span>/100</div>
                <div className="text-xs text-slate-500">掌握人数: {hoveredNode.memberCount}</div>
              </>
            ) : (
              <>
                <div className="font-semibold text-slate-900 dark:text-slate-50">{hoveredNode.name}</div>
                <div className="mt-1 text-xs text-slate-500">团队: {hoveredNode.team}</div>
                <div className="text-xs text-slate-500">角色: {hoveredNode.role}{hoveredNode.level ? ` · ${hoveredNode.level}` : ''}</div>
                <div className="text-xs text-slate-500">技能数: {hoveredNode.skillCount}</div>
              </>
            )}
          </div>
        )}
        <div className="mt-3 text-center text-xs text-slate-400">
          圆 = 技能 (大小 ∝ 平均分) · 方 = 成员 (大小 ∝ 掌握技能数) · 可拖拽
        </div>
      </div>
    </div>
  );
}
