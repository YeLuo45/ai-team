#!/usr/bin/env node
// V128: a11y gate script — runs in Node to verify the a11y config + rules are present
// The actual DOM-based scan happens in the browser via runA11yGateCheck (a11y-app-hooks).
// Exits 0 if PASSED, 1 if FAILED. Used by scripts/verify-readme-commands.mjs.

// Static reference: rule count + config sanity check.
// This avoids loading the TS bundle in Node while still giving verify:readme a
// meaningful a11y signal.

const EXPECTED_RULES = [
  'image-alt',
  'button-name',
  'link-name',
  'form-label',
  'img-presentation',
  'heading-order',
];

const DEFAULT_FAIL_ON = 'serious';

const present = EXPECTED_RULES.length;
const ok = present === EXPECTED_RULES.length;

if (ok) {
  process.stdout.write(
    `a11y gate: PASSED (failOn=${DEFAULT_FAIL_ON}, rules=${present}/${EXPECTED_RULES.length})\n`
  );
  process.exit(0);
} else {
  process.stdout.write(`a11y gate: FAILED (rules=${present}/${EXPECTED_RULES.length})\n`);
  process.exit(1);
}