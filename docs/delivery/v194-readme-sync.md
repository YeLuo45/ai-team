V194 ships a documentation-only update — the root README.md now
includes a "Recent additions (V165-V192, candidate-suggestion
pipeline)" section after the existing V20-V31 entries. Each
version group (V165-V169, V170, V171-V174, V175-V182, V186,
V183-V185, V187, V189-V192, V190) lists the modules that ship in
`packages/ai-team-web/src/lib/*` or `components/*` so newcomers can
navigate the surface area without spelunking the delivery folder.

Verification: 40/40 README commands still pass (`npm run
verify:readme`). tsc --noEmit clean.

Source change: `README.md` only — no application code touched.
