# Datenschutzinformation: kostenloser Action-Kern

Stand: 20. August 2026

Diese Information beschreibt den kostenlosen Kern von Docs Impact Gate in den
öffentlichen Versionen 0.1.0 und 0.2.0. Sie ist keine Rechtsberatung. Der
Audit-Modus ändert den beschriebenen Datenfluss und die Datenspeicherung nicht.

## Verarbeitete Daten

Die Action verarbeitet innerhalb des GitHub-Runners:

- Repository-Inhaber und Repository-Name,
- Pull-Request-Nummer und Pull-Request-Text,
- die von GitHub gemeldeten Namen geänderter Dateien,
- die repository-lokale Docs-Impact-Policy.

Dateiinhalte, Quellcode, Patches, vollständige Diffs, Commit-Inhalte und private
Personenverzeichnisse werden vom kostenlosen Kern nicht abgerufen.

## Zweck und Datenfluss

Die Daten werden ausschließlich verwendet, um repository-lokale
Dokumentations-, Changelog- und Versionsregeln auszuwerten. Es gibt im
kostenlosen Kern keinen vom Produktanbieter betriebenen Server, keine
Telemetrie, keine Werbung und keine Weitergabe an einen Zahlungsdienst.

GitHub führt den Workflow im vom Repository-Inhaber gewählten Runner aus. Die
Action ruft über den bereitgestellten GitHub-Token nur die Liste geänderter
Pull-Request-Dateien ab. Ergebnisse werden als Step Summary und Action-Outputs
innerhalb des GitHub-Workflows bereitgestellt.

## Speicherung

Docs Impact Gate unterhält im kostenlosen Kern keinen eigenen Datenspeicher.
Workflow-Protokolle, Summaries und deren Aufbewahrungsdauer werden durch die
GitHub- und Repository-Einstellungen des Nutzers bestimmt. Entscheidungstexte
werden weder im Report noch in Action-Outputs wiedergegeben.

## Secrets

Der GitHub-Token wird vor Erstellung des API-Clients bei GitHub Actions als
Secret registriert. Bekannte Tokenformen, der exakte Token und der rohe
Pull-Request-Text werden aus Fehlermeldungen entfernt.

## Noch nicht umfasst

Checkout, Lizenzvalidierung, zentrale Team-Policies und Lemon-Squeezy-Zahlungen
sind nicht implementiert. Für diese späteren Funktionen ist vor Aktivierung
eine aktualisierte Datenschutzbewertung erforderlich.

## Verantwortlicher und Kontakt

Verantwortliche Stelle: Jan Voigtmann, Publisher FastPhive, Deutschland.

Datenschutzkontakt: jan.voigtmann@gmail.com
