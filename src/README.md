# Production Source

`src/` ist die maßgebliche Quelle des kostenlosen Action-Kerns aus Zyklus 2.

| Modul | Verantwortung |
| --- | --- |
| `domain.ts` | Stabile Typen für Policy, Entscheidungen und Auswertung. |
| `policy.ts` | Striktes YAML-Schema sowie Workspace- und Pfadgrenzen. |
| `decisions.ts` | Sicherer Parser für genau einen optionalen `docs-impact`-Block. |
| `evaluate.ts` | Reine, deterministische Regel-Auswertung. |
| `github.ts` | Lesender Adapter für PR-Metadaten und geänderte Dateinamen. |
| `report.ts` | Begrenzter, maskierter Markdown-Bericht. |
| `run.ts` | Injizierbare Ablaufsteuerung und Fehlerbereinigung. |
| `index.ts` | Dünner Produktionsadapter für das GitHub Actions Toolkit. |

Tests liegen in `tests/`. Der Build `npm run build` erzeugt `dist/index.js`,
`dist/package.json` und `dist/licenses.txt`. Diese Dateien werden für die
Ausführung der JavaScript Action versioniert, dürfen aber nicht direkt editiert
werden.

Lokale Gates: `npm test`, `npm run typecheck`, `npm run build` und gesammelt
`npm run check`.
