// Main TUI app with router and 4 views

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import Gradient from 'ink-gradient';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { ApiClient } from './api.js';
import type { Candidate, Member, Interview, Training } from '@ai-team/core';

type View = 'dashboard' | 'candidates' | 'members' | 'interviews' | 'help';

interface AppState {
  view: View;
  team: { candidates: Candidate[]; members: Member[]; interviews: Interview[]; trainings: Training[] } | null;
  stats: Awaited<ReturnType<ApiClient['getStats']>> | null;
  loading: boolean;
  error: string | null;
  formMode: 'addCandidate' | 'addMember' | null;
  selectedIdx: number;
  selectedInterview: Interview | null;
}

const VIEW_LABELS: Record<View, string> = {
  dashboard: 'Dashboard',
  candidates: 'Candidates',
  members: 'Members',
  interviews: 'Interviews',
  help: 'Help',
};

export function App({ api }: { api: ApiClient }) {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>({
    view: 'dashboard',
    team: null,
    stats: null,
    loading: true,
    error: null,
    formMode: null,
    selectedIdx: 0,
    selectedInterview: null,
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [team, stats] = await Promise.all([api.getTeam(), api.getStats()]);
      setState((s) => ({ ...s, team, stats, loading: false }));
    } catch (err) {
      setState((s) => ({ ...s, error: (err as Error).message, loading: false }));
    }
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Global key handler
  useInput((input, key) => {
    if (state.formMode) return; // Forms handle their own input
    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
      return;
    }
    if (input === '?') {
      setState((s) => ({ ...s, view: 'help' }));
      return;
    }
    if (input === 'r') {
      refresh();
      return;
    }
    if (input === '1') setState((s) => ({ ...s, view: 'dashboard', selectedIdx: 0, selectedInterview: null }));
    if (input === '2') setState((s) => ({ ...s, view: 'candidates', selectedIdx: 0, selectedInterview: null }));
    if (input === '3') setState((s) => ({ ...s, view: 'members', selectedIdx: 0, selectedInterview: null }));
    if (input === '4') setState((s) => ({ ...s, view: 'interviews', selectedIdx: 0, selectedInterview: null }));
    if (input === 'a' && state.view === 'candidates') setState((s) => ({ ...s, formMode: 'addCandidate' }));
    if (input === 'a' && state.view === 'members') setState((s) => ({ ...s, formMode: 'addMember' }));
    if (input === 'd' && state.view === 'candidates' && state.team) {
      const c = state.team.candidates[state.selectedIdx];
      if (c) {
        api.deleteCandidate(c.id).then(refresh).catch((e) => setState((s) => ({ ...s, error: e.message })));
      }
    }
    if (input === 'i' && state.view === 'candidates' && state.team) {
      const c = state.team.candidates[state.selectedIdx];
      if (c) {
        api
          .startInterview(c.id, 'technical')
          .then((r) => {
            setState((s) => ({ ...s, selectedInterview: r.interview, view: 'interviews' }));
            refresh();
          })
          .catch((e) => setState((s) => ({ ...s, error: e.message })));
      }
    }
    if (key.upArrow) {
      setState((s) => {
        return { ...s, selectedIdx: Math.max(0, s.selectedIdx - 1) };
      });
    }
    if (key.downArrow) {
      setState((s) => {
        const list = s.view === 'candidates' ? s.team?.candidates ?? []
          : s.view === 'interviews' ? s.team?.interviews ?? []
          : [];
        const max = list.length - 1;
        return { ...s, selectedIdx: Math.min(Math.max(0, max), s.selectedIdx + 1) };
      });
    }
    if (key.return && state.view === 'interviews' && state.team) {
      const iv = state.team.interviews[state.selectedIdx];
      if (iv) setState((s) => ({ ...s, selectedInterview: iv }));
    }
    if (key.escape) {
      setState((s) => ({ ...s, selectedInterview: null, view: s.view }));
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Header view={state.view} />
      {state.error && <Text color="red">⚠ {state.error}</Text>}
      {state.loading && !state.team ? (
        <Box>
          <Spinner type="dots" />
          <Text> Loading from server...</Text>
        </Box>
      ) : state.formMode === 'addCandidate' ? (
        <AddCandidateForm
          api={api}
          onCancel={() => setState((s) => ({ ...s, formMode: null }))}
          onSubmit={async (data) => {
            await api.addCandidate(data);
            setState((s) => ({ ...s, formMode: null }));
            refresh();
          }}
        />
      ) : state.formMode === 'addMember' ? (
        <AddMemberForm
          api={api}
          onCancel={() => setState((s) => ({ ...s, formMode: null }))}
          onSubmit={async (data) => {
            await api.addMember(data);
            setState((s) => ({ ...s, formMode: null }));
            refresh();
          }}
        />
      ) : (
        <>
          {state.view === 'dashboard' && <DashboardView stats={state.stats} team={state.team} />}
          {state.view === 'candidates' && <CandidatesView team={state.team} selectedIdx={state.selectedIdx} />}
          {state.view === 'members' && <MembersView team={state.team} />}
          {state.view === 'interviews' && (
            <InterviewsView
              team={state.team}
              selectedIdx={state.selectedIdx}
              selectedInterview={state.selectedInterview}
            />
          )}
          {state.view === 'help' && <HelpView />}
        </>
      )}
      <Footer view={state.view} />
    </Box>
  );
}

function Header({ view }: { view: View }) {
  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column">
      <Gradient name="rainbow">
        <Text bold>◆ ai-team TUI · AI 驱动的团队管理</Text>
      </Gradient>
      <Box marginTop={1}>
        <Text dimColor>Tab: </Text>
        {(['dashboard', 'candidates', 'members', 'interviews'] as View[]).map((v, i) => (
          <Text key={v}>
            {view === v ? <Text color="cyan" bold>[{i + 1}] {VIEW_LABELS[v]}</Text> : <Text dimColor> [{i + 1}] {VIEW_LABELS[v]} </Text>}
          </Text>
        ))}
      </Box>
    </Box>
  );
}

function Footer({ view }: { view: View }) {
  let hint = '';
  if (view === 'candidates') hint = 'a 添加 · i 启动面试 · d 删除 · r 刷新';
  else if (view === 'members') hint = 'a 添加 · r 刷新';
  else if (view === 'interviews') hint = '↑↓ 切换 · Enter 查看 · r 刷新';
  else hint = '1-4 切换页 · r 刷新 · ? 帮助 · q 退出';
  return (
    <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
      <Text dimColor>{hint}</Text>
    </Box>
  );
}

// ============ Views ============

function DashboardView({ stats, team }: { stats: AppState['stats']; team: AppState['team'] }) {
  if (!stats || !team) return <Text dimColor>暂无数据</Text>;
  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <StatBox label="在职成员" value={String(stats.activeMembers)} sub={`总计 ${stats.totalMembers}`} />
        <StatBox label="候选人" value={String(stats.candidates)} sub="招聘中" />
        <StatBox label="面试总数" value={String(stats.totalInterviews)} sub={`完成 ${stats.completedInterviews}`} />
        <StatBox label="平均评分" value={String(stats.avgScore)} sub="满分 100" />
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text bold>最近面试</Text>
        {team.interviews.slice(-3).reverse().map((iv) => (
          <Text key={iv.id}>
            · {iv.id}  候选人 {iv.candidateId.slice(-6)}  {iv.evaluation?.overall ?? '-'}/100  {iv.status}
          </Text>
        ))}
        {team.interviews.length === 0 && <Text dimColor>暂无面试</Text>}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text bold>团队分布</Text>
        {Object.entries(stats.teamCounts).map(([t, c]) => (
          <Text key={t}>· {t}: {c} 人</Text>
        ))}
        {Object.keys(stats.teamCounts).length === 0 && <Text dimColor>暂无团队</Text>}
      </Box>
    </Box>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={2} marginRight={1}>
      <Text dimColor>{label}</Text>
      <Text bold color="cyan">{value}</Text>
      <Text dimColor>{sub}</Text>
    </Box>
  );
}

function CandidatesView({ team, selectedIdx }: { team: AppState['team']; selectedIdx: number }) {
  if (!team) return <Text dimColor>Loading...</Text>;
  if (team.candidates.length === 0) {
    return (
      <Box marginY={1} flexDirection="column">
        <Text dimColor>暂无候选人 (按 a 添加)</Text>
      </Box>
    );
  }
  return (
    <Box marginY={1} flexDirection="column">
      {team.candidates.map((c, i) => (
        <Text key={c.id} inverse={i === selectedIdx}>
          {i === selectedIdx ? '▶ ' : '  '}
          {c.name.padEnd(12)} {c.position.padEnd(15)} <Text color="yellow">{c.status.padEnd(10)}</Text> {c.source}
        </Text>
      ))}
    </Box>
  );
}

function MembersView({ team }: { team: AppState['team'] }) {
  if (!team) return <Text dimColor>Loading...</Text>;
  if (team.members.length === 0) {
    return (
      <Box marginY={1} flexDirection="column">
        <Text dimColor>暂无成员 (按 a 添加)</Text>
      </Box>
    );
  }
  const byTeam = new Map<string, Member[]>();
  for (const m of team.members) {
    const list = byTeam.get(m.team) ?? [];
    list.push(m);
    byTeam.set(m.team, list);
  }
  return (
    <Box marginY={1} flexDirection="column">
      {[...byTeam.entries()].map(([t, ms]) => (
        <Box key={t} flexDirection="column" marginBottom={1}>
          <Text bold color="cyan">▸ {t} ({ms.length})</Text>
          {ms.map((m) => (
            <Text key={m.id}>
              {'   '}{m.name.padEnd(12)} {m.role.padEnd(15)} {m.level ?? ''}  {m.status === 'active' ? <Text color="green">● 在职</Text> : <Text dimColor>○ {m.status}</Text>}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}

function InterviewsView({ team, selectedIdx, selectedInterview }: { team: AppState['team']; selectedIdx: number; selectedInterview: Interview | null }) {
  if (!team) return <Text dimColor>Loading...</Text>;
  if (team.interviews.length === 0) {
    return (
      <Box marginY={1} flexDirection="column">
        <Text dimColor>暂无面试 (到 Candidates 页按 i 启动)</Text>
      </Box>
    );
  }
  if (selectedInterview) {
    const iv = selectedInterview;
    return (
      <Box marginY={1} flexDirection="column">
        <Text bold color="cyan">面试详情: {iv.id}</Text>
        <Text dimColor>候选人 {iv.candidateId} · {iv.position} · {iv.type} · {iv.status}</Text>
        {iv.evaluation && (
          <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="green" paddingX={1}>
            <Text>总分: <Text bold color="green">{iv.evaluation.overall}/100</Text> · 推荐: {iv.evaluation.recommendation}</Text>
            <Text>技术 {iv.evaluation.breakdown.technical} · 沟通 {iv.evaluation.breakdown.communication} · 解题 {iv.evaluation.breakdown.problemSolving} · 文化 {iv.evaluation.breakdown.culture}</Text>
            <Text dimColor>{iv.evaluation.summary}</Text>
            {iv.evaluation.strengths.length > 0 && (
              <Box flexDirection="column" marginTop={1}>
                <Text color="green">优势:</Text>
                {iv.evaluation.strengths.map((s, i) => <Text key={i}>  · {s}</Text>)}
              </Box>
            )}
            {iv.evaluation.concerns.length > 0 && (
              <Box flexDirection="column" marginTop={1}>
                <Text color="red">顾虑:</Text>
                {iv.evaluation.concerns.map((s, i) => <Text key={i}>  · {s}</Text>)}
              </Box>
            )}
          </Box>
        )}
        <Box flexDirection="column" marginTop={1}>
          <Text bold>对话 ({iv.turns.length} 轮):</Text>
          {iv.turns.map((t, i) => (
            <Text key={i}>
              {t.role === 'interviewer' ? <Text color="cyan" bold>面试官</Text> : <Text color="yellow" bold>候选人</Text>}: {t.content}
            </Text>
          ))}
        </Box>
        <Text dimColor>按 Esc 返回列表</Text>
      </Box>
    );
  }
  return (
    <Box marginY={1} flexDirection="column">
      {team.interviews.slice().reverse().map((iv, i) => (
        <Text key={iv.id} inverse={i === selectedIdx}>
          {i === selectedIdx ? '▶ ' : '  '}
          {iv.id}  候选人 {iv.candidateId.slice(-6)}  {iv.evaluation?.overall ?? '-'}分  {iv.status}
        </Text>
      ))}
    </Box>
  );
}

function HelpView() {
  return (
    <Box marginY={1} flexDirection="column">
      <Text bold color="cyan">快捷键</Text>
      <Text>1/2/3/4    切换页 (Dashboard/Candidates/Members/Interviews)</Text>
      <Text>↑↓        列表导航</Text>
      <Text>Enter     进入/提交</Text>
      <Text>Esc       返回</Text>
      <Text>a         添加 (Candidates / Members)</Text>
      <Text>i         启动面试 (Candidates 页)</Text>
      <Text>d         删除 (Candidates 页)</Text>
      <Text>r         刷新数据</Text>
      <Text>?         显示此帮助</Text>
      <Text>q / Ctrl-C 退出</Text>
      <Text dimColor>数据由 @ai-team/server (localhost:3000) 提供</Text>
    </Box>
  );
}

// ============ Forms ============

function AddCandidateForm({ onSubmit, onCancel }: { api: ApiClient; onSubmit: (data: Partial<Candidate>) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('other');
  const [step] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useInput((input, key) => {
    void input;
    if (key.escape) onCancel();
    if (key.return && step === 4) {
      setSubmitting(true);
      onSubmit({
        name: name || '未命名',
        position: position || '未指定',
        source: source as Candidate['source'],
        ...(email && { email }),
      }).catch(() => setSubmitting(false));
    }
  });

  const fields: Array<[string, string, React.ReactNode]> = [
    ['姓名', name, <TextInput value={name} onChange={setName} />],
    ['岗位', position, <TextInput value={position} onChange={setPosition} />],
    ['邮箱', email, <TextInput value={email} onChange={setEmail} />],
    ['来源', source, <TextInput value={source} onChange={setSource} />],
    ['提交', '', <Text color="green">按 Enter 提交 (Esc 取消)</Text>],
  ];

  return (
    <Box marginY={1} flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
      <Text bold color="yellow">添加候选人</Text>
      {fields.map(([label, value, input], i) => (
        <Box key={label}>
          <Text>{label.padEnd(8)}: </Text>
          {i === step ? input : <Text>{value}</Text>}
        </Box>
      ))}
      <Text dimColor>Tab/↑↓ 切换字段 · Enter 提交 · Esc 取消</Text>
      {submitting && <Spinner type="dots" />}
    </Box>
  );
}

function AddMemberForm({ onSubmit, onCancel }: { api: ApiClient; onSubmit: (data: Partial<Member>) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [team, setTeam] = useState('');
  const [level, setLevel] = useState('P5');
  const [step] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useInput((input, key) => {
    void input;
    if (key.escape) onCancel();
    if (key.return && step === 4) {
      setSubmitting(true);
      onSubmit({
        name: name || '未命名',
        role: role || '工程师',
        team: team || 'Default',
        level: level as Member['level'],
      }).catch(() => setSubmitting(false));
    }
  });

  const fields: Array<[string, string, React.ReactNode]> = [
    ['姓名', name, <TextInput value={name} onChange={setName} />],
    ['角色', role, <TextInput value={role} onChange={setRole} />],
    ['团队', team, <TextInput value={team} onChange={setTeam} />],
    ['职级', level, <TextInput value={level} onChange={setLevel} />],
    ['提交', '', <Text color="green">按 Enter 提交 (Esc 取消)</Text>],
  ];

  return (
    <Box marginY={1} flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
      <Text bold color="yellow">添加成员</Text>
      {fields.map(([label, value, input], i) => (
        <Box key={label}>
          <Text>{label.padEnd(8)}: </Text>
          {i === step ? input : <Text>{value}</Text>}
        </Box>
      ))}
      <Text dimColor>Tab/↑↓ 切换字段 · Enter 提交 · Esc 取消</Text>
      {submitting && <Spinner type="dots" />}
    </Box>
  );
}
