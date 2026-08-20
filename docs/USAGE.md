# Docs Impact Gate verwenden

## Voraussetzungen

- Ein GitHub-Repository mit Pull Requests und GitHub Actions.
- Ein Workflow für das Ereignis `pull_request`.
- Leserechte für Repository-Inhalte und Pull-Request-Metadaten.
- Für die lokale Entwicklung Node.js 24 und npm.

Die Action ist für die Node-24-Action-Runtime (`node24`) gebündelt. Sie wurde
lokal, in einem öffentlichen Demo-Repository und im GitHub Marketplace-Release
`v0.1.0` validiert.

## Workflow

Nach der Einrichtung eines Publisher-Repositorys muss die Action auf einen
vollständigen Commit-SHA gepinnt werden. Platzhalter in diesem Beispiel dürfen
nicht unverändert übernommen werden:

```yaml
name: Docs Impact Gate

on:
  pull_request:

permissions:
  contents: read
  pull-requests: read

jobs:
  docs-impact:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<full-commit-sha>
      - uses: <publisher>/<repository>@<full-commit-sha>
        with:
          github-token: ${{ github.token }}
          policy-file: .github/docs-impact.yml
```

`pull_request_target` darf nicht verwendet werden. Die Action soll mit dem
Code und der Policy des Pull Requests unter minimalen Leserechten laufen.

## Ein- und Ausgaben

| Name | Typ | Pflicht | Standard | Bedeutung |
| --- | --- | --- | --- | --- |
| `github-token` | String | ja | – | Lesender GitHub-Token zum Abruf der geänderten Dateinamen. |
| `policy-file` | String | nein | `.github/docs-impact.yml` | Repository-relativer Pfad zur Policy. |

| Ausgabe | Bedeutung |
| --- | --- |
| `result` | `pass` oder `fail`. |
| `violations-count` | Anzahl der verletzten Regeln als Dezimalzahl. |
| `report` | Deterministischer Markdown-Bericht ohne Entscheidungstexte oder Quellcode. |

## Policy-Schema

Die Policy verwendet YAML, `version: 1` und mindestens eine Regel. Unbekannte
Schlüssel, doppelte Regel-IDs, absolute Pfade und Pfad-Traversal werden
abgelehnt. `decision` ist genau einer der Werte `docs`, `changelog` oder
`version`. `min_reason_length` ist optional, standardmäßig 15 und darf zwischen
10 und 500 Unicode-Codepoints liegen.

```yaml
version: 1
rules:
  - id: production-docs
    description: Production source changes require user or architecture documentation.
    if_changed:
      - src/**
    require_any:
      - docs/USAGE.md
      - docs/ARCHITECTURE.md
    decision: docs
    min_reason_length: 15
  - id: release-note
    description: Production source changes require an explicit changelog decision.
    if_changed:
      - src/**
    require_any:
      - CHANGELOG.md
    decision: changelog
    min_reason_length: 15
  - id: version-decision
    description: Production source changes require an explicit package-version decision.
    if_changed:
      - src/**
    require_any:
      - package.json
    decision: version
    min_reason_length: 15
```

Pro Regel gilt: Ändert sich eine Datei passend zu `if_changed`, muss entweder
mindestens eine Datei passend zu `require_any` geändert werden oder im
Pull-Request-Text eine ausreichend lange Begründung für den angegebenen
`decision`-Schlüssel stehen.

## Bestehen durch eine Dokumentationsänderung

Bei einer Änderung an `src/ui/button.ts` erfüllt beispielsweise eine
gleichzeitige Änderung an `docs/USAGE.md` die Regel `production-docs`. Für
weitere ausgelöste Regeln gelten deren eigene Pfade oder Entscheidungen.

## Bestehen durch explizite Entscheidungen

Wenn keine der erwarteten Dateien geändert werden soll, kann der
Pull-Request-Text genau einen eingezäunten YAML-Block enthalten:

```docs-impact
docs: Internal refactor only; user behavior remains unchanged.
changelog: No release note because behavior remains unchanged.
version: No package API or distributed artifact changed.
```

Es sind nur diese drei Schlüssel und einfache Textwerte erlaubt. Mehrere
`docs-impact`-Blöcke, YAML-Aliase, verschachtelte Werte, Listen und unbekannte
Schlüssel führen zu einem Fehler.

## Fehler beheben

Bei einer Regelverletzung setzt die Action `result=fail`, veröffentlicht zuerst
den Bericht und markiert danach den Step als fehlgeschlagen. Der Bericht nennt
Regel, Auslöser, erwartete Pfade und Ergebnis, aber nie den Begründungstext.
Zum Beheben entweder eine passende Datei ändern oder eine konkrete Begründung
für den verlangten Entscheidungsschlüssel ergänzen. Konfigurations- und
API-Fehler werden bereinigt und schließen die Prüfung sicher mit Fehler.

## Sicherheits- und Datenschutzgrenzen

- Abgerufen werden nur Pull-Request-Metadaten und geänderte Dateinamen.
- Quellcode, Dateiinhalte, Patches und vollständige Diffs werden weder gelesen
  noch an einen externen Dienst hochgeladen.
- Pull-Request-Inhalte werden nicht als Shell-Code ausgeführt; die Action führt
  überhaupt keine Shell-Kommandos aus.
- `pull_request_target` wird nicht unterstützt oder empfohlen.
- Der GitHub-Token wird vor Client-Erstellung maskiert; Secrets, rohe
  Pull-Request-Texte und Entscheidungstexte werden nicht geloggt.

## Bekannte Grenzen

- Ab 3.000 von der GitHub-API gelieferten Dateien schlägt die Action sicher
  fehl, da die Dateiliste an dieser API-Grenze unvollständig sein kann.
- Die lokale Policy liegt im geprüften Repository und kann in einem Pull
  Request mitgeändert werden. Bezahltes Rule-Locking ist noch nicht
  implementiert.
- Die Installation aus dem GitHub Marketplace und drei Szenarien im
  öffentlichen Demo-Repository wurden getestet.
- Checkout, Lizenzvalidierung, Pro-/Team-Funktionen und externe Analytics sind
  noch nicht implementiert.

## Lokale Prüfung

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run check
```

`src/` ist die maßgebliche Quelle. `dist/` wird mit `npm run build` erzeugt und
für die direkte Ausführung als JavaScript Action mit versioniert.
`npm run check` baut das Bundle vor den Tests und startet es zusätzlich in zwei
lokalen End-to-End-Szenarien gegen einen kontrollierten GitHub-API-Ersatz.
