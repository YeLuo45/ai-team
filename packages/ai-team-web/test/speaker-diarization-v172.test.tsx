// V172: Speaker diarization tests.
//   1. Pure helpers (buildSpeakerTimeline / countSpeakers / dominantSpeaker /
//      totalSpanMs / formatMmSs)
//   2. SpeakerDiarizationView component (empty / rendering / per-speaker bar)

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  buildSpeakerTimeline,
  countSpeakers,
  dominantSpeaker,
  formatMmSs,
  totalSpanMs,
  type SpeakerTurn,
} from '../src/lib/stt/speaker-timeline';
import type { SttTranscriptChunk } from '../src/lib/stt/types';
import { SpeakerDiarizationView } from '../src/components/interview/SpeakerDiarizationView';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-05T10:00:00.000Z').getTime());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function chunk(over: Partial<SttTranscriptChunk>, text?: string): SttTranscriptChunk {
  return {
    text: text ?? over.text ?? '...',
    isFinal: over.isFinal ?? true,
    speaker: over.speaker,
    timestamp: over.timestamp,
    confidence: over.confidence,
  };
}

// ====================================================================
// 1. Pure helpers
// ====================================================================

describe('buildSpeakerTimeline', () => {
  it('returns empty when given no chunks', () => {
    expect(buildSpeakerTimeline([])).toEqual([]);
  });

  it('drops empty-text chunks', () => {
    const turns = buildSpeakerTimeline([chunk({ speaker: 'interviewer' }, '   ')]);
    expect(turns).toEqual([]);
  });

  it('normalises undefined speaker to "unknown"', () => {
    const turns = buildSpeakerTimeline([
      chunk({ speaker: undefined, timestamp: 0 }, '无名发言'),
    ]);
    expect(turns[0]?.speaker).toBe('unknown');
  });

  it('collapses consecutive same-speaker chunks (within gap window) into one turn', () => {
    const turns = buildSpeakerTimeline([
      chunk({ speaker: 'candidate', timestamp: 1000 }, '你好'),
      chunk({ speaker: 'candidate', timestamp: 1500 }, '我是候选人'),
    ]);
    expect(turns.length).toBe(1);
    expect(turns[0]?.speaker).toBe('candidate');
    expect(turns[0]?.chunkCount).toBe(2);
    expect(turns[0]?.text).toContain('你好');
    expect(turns[0]?.text).toContain('我是候选人');
  });

  it('splits turns when speakers differ', () => {
    const turns = buildSpeakerTimeline([
      chunk({ speaker: 'candidate', timestamp: 0 }, '你好'),
      chunk({ speaker: 'interviewer', timestamp: 2000 }, '请介绍下自己'),
    ]);
    expect(turns.length).toBe(2);
    expect(turns[0]?.speaker).toBe('candidate');
    expect(turns[1]?.speaker).toBe('interviewer');
  });

  it('splits turns when the gap exceeds the backfill window', () => {
    const turns = buildSpeakerTimeline([
      chunk({ speaker: 'candidate', timestamp: 0 }, '你好'),
      // Gap of 10s — beyond the GAP_BACKFILL_MS window (1s).
      chunk({ speaker: 'candidate', timestamp: 10000 }, '很久后'),
    ]);
    expect(turns.length).toBe(2);
  });

  it('preserves chronological order', () => {
    const turns = buildSpeakerTimeline([
      chunk({ speaker: 'candidate', timestamp: 3000 }, 'b'),
      chunk({ speaker: 'interviewer', timestamp: 1000 }, 'a'),
      chunk({ speaker: 'candidate', timestamp: 5000 }, 'c'),
    ]);
    expect(turns.map((t) => t.startMs)).toEqual([1000, 3000, 5000]);
  });

  it('infers timestamps from the previous chunk when not supplied', () => {
    const turns = buildSpeakerTimeline([
      chunk({ speaker: 'candidate', text: 'first' }),
      chunk({ speaker: 'candidate', text: 'second' }),
    ]);
    // Second chunk gets a default startMs > first endMs so the gap-backfill
    // doesn't merge them.
    expect(turns[0]?.endMs).toBeLessThanOrEqual((turns[1]?.startMs ?? 0));
  });
});

describe('countSpeakers / dominantSpeaker / totalSpanMs / formatMmSs', () => {
  it('countSpeakers returns stable interviewer → candidate → unknown order', () => {
    const turns: SpeakerTurn[] = [
      {
        speaker: 'unknown',
        startMs: 0,
        endMs: 1000,
        text: 'a',
        chunkCount: 1,
      },
      {
        speaker: 'candidate',
        startMs: 1000,
        endMs: 5000,
        text: 'b',
        chunkCount: 2,
      },
      {
        speaker: 'interviewer',
        startMs: 5000,
        endMs: 9000,
        text: 'c',
        chunkCount: 1,
      },
    ];
    const stats = countSpeakers(turns);
    expect(stats.map((s) => s.speaker)).toEqual([
      'interviewer',
      'candidate',
      'unknown',
    ]);
    expect(stats.find((s) => s.speaker === 'candidate')?.textChars).toBe(1);
    expect(stats.find((s) => s.speaker === 'candidate')?.chunks).toBe(2);
  });

  it('dominantSpeaker returns the speaker with the most talk time', () => {
    const turns: SpeakerTurn[] = [
      { speaker: 'candidate', startMs: 0, endMs: 1000, text: 'a', chunkCount: 1 },
      { speaker: 'interviewer', startMs: 1000, endMs: 8000, text: 'long', chunkCount: 2 },
    ];
    expect(dominantSpeaker(turns)).toBe('interviewer');
  });

  it('dominantSpeaker returns null on empty timeline', () => {
    expect(dominantSpeaker([])).toBeNull();
  });

  it('totalSpanMs returns max - min across all turns', () => {
    const turns: SpeakerTurn[] = [
      { speaker: 'candidate', startMs: 1000, endMs: 3000, text: 'a', chunkCount: 1 },
      { speaker: 'interviewer', startMs: 5000, endMs: 9000, text: 'b', chunkCount: 1 },
    ];
    expect(totalSpanMs(turns)).toBe(8000);
  });

  it('totalSpanMs is 0 on empty input', () => {
    expect(totalSpanMs([])).toBe(0);
  });

  it('formatMmSs rounds and pads', () => {
    expect(formatMmSs(0)).toBe('00:00');
    expect(formatMmSs(59_000)).toBe('00:59');
    expect(formatMmSs(60_000)).toBe('01:00');
    expect(formatMmSs(75_500)).toBe('01:15');
    expect(formatMmSs(-1)).toBe('00:00');
    expect(formatMmSs(NaN)).toBe('00:00');
  });
});

// ====================================================================
// 2. SpeakerDiarizationView
// ====================================================================

describe('SpeakerDiarizationView', () => {
  it('renders the empty state when no turns exist', () => {
    const { container } = render(
      <SpeakerDiarizationView chunks={[]} testId="sd" />,
    );
    expect(container.querySelector('[data-testid="sd-empty"]')).toBeTruthy();
  });

  it('renders title + summary chips for a populated timeline', () => {
    const { container } = render(
      <SpeakerDiarizationView
        chunks={[
          chunk({ speaker: 'interviewer', timestamp: 0 }, '请自我介绍'),
          chunk({ speaker: 'candidate', timestamp: 3000 }, '你好我是候选人'),
        ]}
        testId="sd"
      />,
    );
    expect(container.querySelector('[data-testid="sd-content"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="sd-title"]')?.textContent).toContain(
      '扬声器日记',
    );
    expect(container.querySelector('[data-testid="sd-summary"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="sd-turns"]')?.textContent).toContain('2');
  });

  it('paints per-speaker bar segments proportional to total time', () => {
    const { container } = render(
      <SpeakerDiarizationView
        chunks={[
          chunk({ speaker: 'interviewer', timestamp: 0 }, 'a very long interviewer monologue'),
          chunk({ speaker: 'candidate', timestamp: 5000 }, 'short'),
        ]}
        testId="sd"
      />,
    );
    const intv = container.querySelector('[data-testid="sd-bar-interviewer"]') as HTMLElement | null;
    const cand = container.querySelector('[data-testid="sd-bar-candidate"]') as HTMLElement | null;
    expect(intv).toBeTruthy();
    expect(cand).toBeTruthy();
    const intvPct = Number(intv?.getAttribute('data-pct') ?? 0);
    const candPct = Number(cand?.getAttribute('data-pct') ?? 0);
    expect(intvPct).toBeGreaterThan(candPct);
  });

  it('shows the dominant speaker badge when one speaker dominates', () => {
    const { container } = render(
      <SpeakerDiarizationView
        chunks={[
          chunk({ speaker: 'interviewer', timestamp: 0 }, 'long monologue'),
          chunk({ speaker: 'interviewer', timestamp: 5000 }, 'another paragraph here'),
        ]}
        testId="sd"
      />,
    );
    expect(container.querySelector('[data-testid="sd-dominant"]')?.textContent).toContain(
      '面试官',
    );
  });

  it('renders per-turn rows with speaker + time range + text', () => {
    const { container } = render(
      <SpeakerDiarizationView
        chunks={[chunk({ speaker: 'candidate', timestamp: 5000 }, '我是候选人')]}
        testId="sd"
      />,
    );
    const turn = container.querySelector('[data-testid="sd-turn"]') as HTMLElement | null;
    expect(turn).toBeTruthy();
    expect(turn?.getAttribute('data-speaker')).toBe('candidate');
    expect(container.querySelector('[data-testid="sd-turn-text"]')?.textContent).toContain(
      '我是候选人',
    );
    expect(container.querySelector('[data-testid="sd-turn-time"]')?.textContent).toMatch(
      /\d{2}:\d{2}/,
    );
  });

  it('limits the number of rendered turns when limit is provided', () => {
    // Alternating speakers with explicit timestamps so chunks don't
    // collapse into one merge. With limit=3 the rendered <li> count
    // stays at 3 even though the source has 10 chunks.
    const chunks: SttTranscriptChunk[] = [];
    for (let i = 0; i < 10; i++) {
      const speaker = i % 2 === 0 ? 'interviewer' : 'candidate';
      chunks.push(
        chunk({ speaker, timestamp: i * 1000 }, `chunk-${i}`),
      );
    }
    const { container } = render(
      <SpeakerDiarizationView chunks={chunks} limit={3} testId="sd" />,
    );
    expect(container.querySelectorAll('[data-testid="sd-turn"]').length).toBe(3);
    // The summary chip still reflects the total number of turns.
    expect(container.querySelector('[data-testid="sd-turns"]')?.textContent).toContain('10');
  });
});
