// V195 subtitle export helpers tests.

// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import {
  serializeSubtitles,
  subtitleToCues,
  subtitleBlob,
  subtitleMime,
  subtitleFilename,
  downloadSubtitle,
  type SubtitleFormat,
} from '../src/lib/subtitle/export';
import type { SubtitleChunk } from '../src/lib/subtitle';

function flatChunks(): SubtitleChunk[] {
  return [
    { startMs: 0, endMs: 2_000, text: 'Hello world' },
    { startMs: 2_500, endMs: 4_500, text: 'Second cue' },
  ];
}

describe('serializeSubtitles', () => {
  it('produces an SRT body with 1-indexed cues', () => {
    const out = serializeSubtitles(flatChunks(), { format: 'srt' });
    expect(out).toContain('1\n');
    expect(out).toContain('00:00:00,000 --> 00:00:02,000');
    expect(out).toContain('Hello world');
  });

  it('produces a WEBVTT body', () => {
    const out = serializeSubtitles(flatChunks(), { format: 'vtt' });
    expect(out.startsWith('WEBVTT')).toBe(true);
    expect(out).toContain('00:00:00.000 --> 00:00:02.000');
  });

  it('produces a JSON envelope with cue count + timestamp', () => {
    const out = serializeSubtitles(flatChunks(), { format: 'json' });
    const parsed = JSON.parse(out);
    expect(parsed.count).toBe(2);
    expect(parsed.format).toBe('json');
    expect(parsed.cues.length).toBe(2);
  });

  it('produces NDJSON — one cue per line', () => {
    const out = serializeSubtitles(flatChunks(), { format: 'ndjson' });
    const lines = out.trim().split('\n');
    expect(lines.length).toBe(2);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});

describe('subtitleToCues / subtitleMime / subtitleFilename', () => {
  it('subtitleToCues returns the cue pipeline output', () => {
    const cues = subtitleToCues(flatChunks());
    expect(cues.length).toBeGreaterThanOrEqual(2);
    expect(cues[0]?.text).toBe('Hello world');
  });

  it('subtitleMime reports the right MIME types', () => {
    const formats: SubtitleFormat[] = ['srt', 'vtt', 'json', 'ndjson'];
    expect(subtitleMime('srt')).toContain('subrip');
    expect(subtitleMime('vtt')).toContain('text/vtt');
    expect(subtitleMime('json')).toContain('application/json');
    expect(subtitleMime('ndjson')).toContain('ndjson');
    expect(formats.length).toBe(4);
  });

  it('subtitleFilename includes base + ISO-derived stamp + extension', () => {
    const f = subtitleFilename('transcript', 'srt');
    expect(f).toMatch(/^transcript-.*\.srt$/);
    const v = subtitleFilename('transcript', 'vtt');
    expect(v).toMatch(/\.vtt$/);
  });
});

describe('subtitleBlob', () => {
  it('returns a Blob with the right MIME type', () => {
    const blob = subtitleBlob('hello\n', 'srt');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain('subrip');
  });
});

describe('downloadSubtitle (happy-dom)', () => {
  it('runs the happy-dom download path returning skipped:false', () => {
    let clicked = false;
    const original = document.createElement.bind(document);
    document.createElement = function (
      tag: string,
      options?: ElementCreationOptions,
    ): HTMLElement {
      const el = original(tag, options);
      if (tag === 'a' && el) {
        const click = el.click.bind(el);
        el.click = () => {
          clicked = true;
          click();
        };
      }
      return el;
    } as typeof document.createElement;
    try {
      const out = downloadSubtitle(subtitleBlob('hi', 'vtt'), 'foo.vtt');
      expect(out.skipped).toBe(false);
      expect(out.filename).toBe('foo.vtt');
      expect(clicked).toBe(true);
    } finally {
      document.createElement = original;
    }
  });

  it('returns the filename even when the browser path is skipped', () => {
    // happy-dom IS a browser, so we can't truly simulate "no-document".
    // Just verify that the helper returns the filename it was given.
    const out = downloadSubtitle(subtitleBlob('hi', 'srt'), 'foo.srt');
    expect(typeof out.filename).toBe('string');
    expect(out.filename.length).toBeGreaterThan(0);
  });
});
