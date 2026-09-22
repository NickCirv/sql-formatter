# Source review — sql-formatter

## Revision and method

Inspected public commit: [`8528ee665789771a2d718f4c8930db765901918c`](https://github.com/NickCirv/sql-formatter/commit/8528ee665789771a2d718f4c8930db765901918c). Source tree: `2189fec37381b088fdfa232af366731fb98f24eb`. Capture scope: all eligible text files; 6 of 6 eligible files.

This review read captured implementation and documentation. It did not install dependencies, execute project commands, call project APIs, check package publication or establish live CI status. Examples are source-derived, not captured execution transcripts.

## Claim ledger

| Claim | Evidence | Status |
| --- | --- | --- |
| Tokenizer, option routing and different file/directory write behavior | [index.js](https://github.com/NickCirv/sql-formatter/blob/8528ee665789771a2d718f4c8930db765901918c/index.js) | Verified in inspected source; execution unverified |

## Findings and verification gaps

This is a formatter, not a SQL validator or migration runner. Supported dialect names do not imply complete grammar coverage. The directory scan is nonrecursive. Inspect diffs and test SQL semantics before using formatted output, especially for procedural or dialect-specific constructs. This project’s name overlaps other packages; use the explicit repository checkout.

The captured smoke test only asks Node to syntax-check the entrypoint. It does not exercise behavior, integrations or failure paths. Neither that test nor installation was run in this review.

| Dimension | Result |
| --- | --- |
| Purpose and documented commands | Partially verified: static source inspection |
| Clean installation and examples | Unverified |
| Test suite and live CI | Unverified |
| Performance and security guarantees | Unverified |
| Publication | Local documentation only |

## Documentation inventory

- [README.md](https://github.com/NickCirv/sql-formatter/blob/8528ee665789771a2d718f4c8930db765901918c/README.md) — Rewritten; historic section anchors retained where practical.
- [LICENSE](https://github.com/NickCirv/sql-formatter/blob/8528ee665789771a2d718f4c8930db765901918c/LICENSE) — protected document preserved unchanged.

## Captured source inventory

- [LICENSE](https://github.com/NickCirv/sql-formatter/blob/8528ee665789771a2d718f4c8930db765901918c/LICENSE) — Git blob `05b804beeec7d1a6c933d087387ba4adf6463d93`.
- [README.md](https://github.com/NickCirv/sql-formatter/blob/8528ee665789771a2d718f4c8930db765901918c/README.md) — Git blob `8338a35769d5fb1d648e4977397424fc7dc22f31`.
- [package.json](https://github.com/NickCirv/sql-formatter/blob/8528ee665789771a2d718f4c8930db765901918c/package.json) — Git blob `47e1da51f25681b1953afe4b7ca484136511da20`.
- [.github/workflows/ci.yml](https://github.com/NickCirv/sql-formatter/blob/8528ee665789771a2d718f4c8930db765901918c/.github/workflows/ci.yml) — Git blob `44515034a394670de44454a7a1bd2c7ef0c9836e`.
- [index.js](https://github.com/NickCirv/sql-formatter/blob/8528ee665789771a2d718f4c8930db765901918c/index.js) — Git blob `6fd291bad767b1c6a81124fbd41826d3ed09325f`.
- [test/smoke.test.js](https://github.com/NickCirv/sql-formatter/blob/8528ee665789771a2d718f4c8930db765901918c/test/smoke.test.js) — Git blob `ebbccaaf2583b4850575f835313e4b0afd21bff7`.

## Scope boundary

Capture excludes lockfiles, binary artwork, generated output, vendored dependencies and files above the acquisition size limit. The tree records their existence; no verification claim is made for omitted content. Protected documents and historical records are not replaced.

## Reference coverage

Added [command reference](REFERENCE.md) from the argument parser, command handlers and source-defined help at the pinned revision. README examples remain unexecuted.
