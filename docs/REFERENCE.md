# Command reference

Use `node index.js` from the pinned source checkout described in the [README](../README.md). The entries below describe the inspected implementation.

| Command or argument | Behavior |
| --- | --- |
| `FILE` | Read one SQL file and print formatted SQL by default. |
| `DIRECTORY` | Format immediate .sql files in place by default. |
| `stdin` | Supply SQL through a pipe when no file is selected. |
| `--dialect NAME` | Select mysql, postgres, sqlite, mssql or generic token handling. |
| `--indent N` | Set indentation width; defaults to two spaces. |
| `--uppercase` | Convert recognized keywords to uppercase. |
| `--lowercase` | Convert recognized keywords to lowercase; cannot combine with --uppercase. |
| `--output FILE` | Write single-input output to a file. |
| `--check` | Compare formatting without applying changes and exit 1 for differences. |
| `--watch` | Watch a file and rewrite it when it changes. |
| `--json` | Emit formatting metadata. |

For prerequisites, file writes, external services and known limitations, see [Behavior and limits](../README.md#behavior-and-limits).

Implementation: [index.js](https://github.com/NickCirv/sql-formatter/blob/8528ee665789771a2d718f4c8930db765901918c/index.js); [review evidence](RESEARCH.md).
