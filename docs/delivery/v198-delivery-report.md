V198 ships the ReuseBar component — presentational UI for the
V193 cross-session suggestion reuse helpers. Drop it into the
candidate-interview page so the interviewer can re-pick questions
the same candidate already adopted for the same focus area.

Component (components/interview/ReuseBar.tsx, 80 lines):
  - Pure presentational. Uses `useMemo` to keep the candidate list
    stable across re-renders unless inputs change.
  - Renders the empty-state card (`data-state="empty"`) when no
    candidate matches the focus tag.
  - Lists candidates as click-to-pick buttons; each button carries
    `data-testid`, `data-score` (4-decimal reuse score), and
    `data-adoption-count` so downstream agents / Playwright can
    lock the regression in place.
  - Capped output: defaults to 5 candidates.

Test coverage: 3 tests, all green.
  - empty state when focus tag doesn't match anything,
  - ready state with score / adoption-count attributes,
  - onPick callback fires with the right questionId / question.

tsc --noEmit clean. Verify:readme 40/40.

NEXT: V199 EvalDashboardPage, V200 LiveNoiseMeterComponent.
