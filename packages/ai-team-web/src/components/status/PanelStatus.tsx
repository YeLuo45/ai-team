// V142: StatusDot + Panel status indicators

import { useState, useCallback } from "react";
import { Badge } from '../design-system/index.js';
import { StatusDot, type ModuleStatus } from '../hero/HeroLanding.js';

// ---------- Types ----------
export type PanelStatus = ModuleStatus;

export interface PanelStatusInfo {
  status: PanelStatus;
  count?: number;
  unit?: string;
  message?: string;
}

export interface PanelStatusHook {
  status: PanelStatus;
  info: PanelStatusInfo;
  setStatus: (next: PanelStatus) => void;
  updateInfo: (patch: Partial<PanelStatusInfo>) => void;
}

// ---------- Pure helpers ----------
export function statusToTone(status: PanelStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'healthy':
      return 'success';
    case 'degraded':
      return 'warning';
    case 'blocked':
      return 'danger';
    case 'idle':
    default:
      return 'neutral';
  }
}

export function statusToBadgeLabel(status: PanelStatus): string {
  switch (status) {
    case 'healthy':
      return '健康';
    case 'degraded':
      return '降级';
    case 'blocked':
      return '阻塞';
    case 'idle':
    default:
      return '空闲';
  }
}

export function statusPriority(status: PanelStatus): number {
  switch (status) {
    case 'healthy':
      return 0;
    case 'idle':
      return 1;
    case 'degraded':
      return 2;
    case 'blocked':
    default:
      return 3;
  }
}

export function buildPanelStatus(partial: Partial<PanelStatusInfo> & { status: PanelStatus }): PanelStatusInfo {
  return {
    status: partial.status,
    count: partial.count,
    unit: partial.unit,
    message: partial.message,
  };
}

// ---------- PanelStatusIndicator ----------
export interface PanelStatusIndicatorProps {
  info: PanelStatusInfo;
  testId?: string;
  showCount?: boolean;
  compact?: boolean;
}

export function PanelStatusIndicator({ info, testId = 'panel-status', showCount = true, compact = false }: PanelStatusIndicatorProps) {
  return (
    <div
      data-testid={testId}
      data-status={info.status}
      data-tone={statusToTone(info.status)}
      className="inline-flex items-center gap-2"
    >
      <StatusDot status={info.status} label={info.message ?? statusToBadgeLabel(info.status)} />
      {showCount && info.count !== undefined && (
        <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-900 dark:text-slate-100`}>
          {info.count}
          {info.unit && <span className="ml-0.5 text-slate-500 dark:text-slate-400">{info.unit}</span>}
        </span>
      )}
      <Badge tone={statusToTone(info.status)} className={compact ? 'text-[10px]' : 'text-xs'}>
        {statusToBadgeLabel(info.status)}
      </Badge>
    </div>
  );
}

// ---------- Panel status grid (4 panels) ----------
export interface PanelStatusGridProps {
  panels: Array<{ key: string; label: string; info: PanelStatusInfo }>;
  testId?: string;
}

export function PanelStatusGrid({ panels, testId = 'panel-status-grid' }: PanelStatusGridProps) {
  return (
    <div data-testid={testId} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {panels.map((p) => (
        <div
          key={p.key}
          data-testid={`${testId}-${p.key}`}
          className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="text-xs text-slate-500 dark:text-slate-400">{p.label}</div>
          <div className="mt-2">
            <PanelStatusIndicator info={p.info} testId={`${testId}-status-${p.key}`} compact />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- usePanelStatus hook ----------
export function usePanelStatus(options?: { initialStatus?: PanelStatus; initialInfo?: Partial<PanelStatusInfo> }): PanelStatusHook {
  const initialStatus = options?.initialStatus ?? 'idle';
  const initialInfo: PanelStatusInfo = {
    status: initialStatus,
    ...(options?.initialInfo ?? {}),
  };
  const [info, setInfo] = useState<PanelStatusInfo>(initialInfo);

  const setStatus = useCallback((next: PanelStatus) => {
    setInfo((prev) => ({ ...prev, status: next }));
  }, []);

  const updateInfo = useCallback((patch: Partial<PanelStatusInfo>) => {
    setInfo((prev) => ({ ...prev, ...patch }));
  }, []);

  return { status: info.status, info, setStatus, updateInfo };
}
