# Plan: Patientenakte als Klienten-Dashboard

Stand: 16. August 2026

## Ziel

Die Patientenakte wird zur klaren Startseite für die Arbeit mit einer Person. Sie zeigt die wichtigsten Fakten, Verläufe, Risiken und nächsten Schritte auf einen Blick. Detailseiten bleiben für tiefe Bearbeitung erhalten.

Der Plan unterstützt die wichtigste Produkt-Priorität aus `docs/user-priority-feedback.md`:

- einfache, intuitive Nutzung mit wenig Einarbeitung,
- sichtbare und anpassbare Energie- und Referenzwerte,
- bessere Ernährungsplan-Arbeit mit Portionen und Einschränkungen,
- sichere Import- und Export-Abläufe.

## Festgestellte Ursachen und Leitentscheidungen

1. Die falsche Anzeige „Bereit seit drei Tagen“ ist im Code erklärbar. Für die Stufe `plan` nutzt `lib/patient-journey.ts` ohne Beratung das Anlagedatum der Patientenakte. Die heutige Übernahme steht bereits in `patient_intake_submissions.reviewed_at`, wird dafür aber noch nicht genutzt.
2. Sobald eine Patientenakte vorhanden ist, ist ihr gespeicherter Name die verbindliche Anzeige. Der Name der früheren Einladung bleibt nur in der Ereignis-Historie sichtbar. So kann „Spiros“ nicht dauerhaft den Aktennamen „Spuridon“ überschreiben.
3. Die Patientenakte startet künftig mit `Übersicht`. Der heutige Workflow wird zu einer kleineren Karte oder einem Detailbereich. Begriffe wie Intake, Assessment und Follow-up stehen nicht mehr im Mittelpunkt der Startseite.
4. Der Kalorienrechner erhält eine gemeinsame Rechenlogik. Die Patientenübersicht und die Rechner-Seite verwenden danach dieselben Ergebnisse.
5. Der automatische Ernährungsplan ist in der ersten Version ein erklärbarer Vorschlag. Harte Regeln wie Allergien, Unverträglichkeiten und ausgeschlossene Kostformen dürfen nie verletzt werden. Der Vorschlag wird erst nach einer bewussten Prüfung gespeichert.

## Meilenstein 1: Aufnahme-Ereignisse und richtige Übergabe

### Ergebnis

- Die Aufnahme zeigt große, verständliche Ereignisse mit echtem Datum und Uhrzeit:
  - Einladung erstellt,
  - Fragebogen eingegangen,
  - geprüft und übernommen,
  - Patientenakte angelegt oder aktualisiert.
- „Bereit seit …“ beginnt mit dem echten Übernahmezeitpunkt (`reviewedAt`) oder der letzten Beratung. Das alte Anlagedatum ist nur die letzte sichere Rückfall-Option.
- Die Listen-, Board- und Zeitachsenansicht verwenden dieselben Ereignis-Texte.
- Nach „Geprüft und übernehmen“ ist `Patientenakte öffnen` die Hauptaktion. `Ernährungsplan erstellen` bleibt als zweite Aktion. `Später` bleibt verfügbar.
- Die Hauptaktion der Plan-Stufe heißt `Patientenakte öffnen`.
- Der Aktenname ist nach der Übernahme die verbindliche Anzeige. Der frühere Einladungsname ist als Herkunft nachvollziehbar.

### Wahrscheinliche Dateien

- `lib/patient-journey.ts`
- `lib/intake-format.ts`
- `components/intake-list-view.tsx`
- `components/intake-board-view.tsx`
- `components/intake-timeline-view.tsx`
- `components/intake-row-action.tsx`
- `app/(app)/patienten/aufnahmen/aufnahmen-client.tsx`

### Prüfung

- Neue reine Tests für Zeitpunkte und Texte.
- Playwright-Test für Prüfen → Übernehmen → Patientenakte öffnen.
- Fälle: neue Person, vorhandene Akte, alter Fragebogen mit heutiger Übernahme, Beratung vorhanden, abweichender Einladungsname.
- `npm run typecheck`, `npm run lint` und relevante Playwright-Tests mit `--workers=1`.

### GitHub-Meilenstein

Eigener Commit und Push nach erfolgreicher Prüfung.

## Meilenstein 2: Neue Übersicht der Patientenakte

### Ergebnis

Die Patientenakte öffnet auf einer neuen Startseite `Übersicht`.

Oben stehen kompakte Kerndaten:

- Alter, Größe, aktuelles Gewicht und BMI,
- Zielgewicht und Gewichtsänderung,
- Grundumsatz, Gesamtbedarf, Kalorienziel und PAL,
- Hauptziel, Indikationen, Ernährungsweise,
- Allergien und Unverträglichkeiten mit klarer Warnfarbe,
- nächster Termin, letzter Kontakt und aktueller Ernährungsplan.

Darunter stehen wenige, nützliche Verläufe:

- Gewicht und BMI,
- Kalorienziel im Verhältnis zum geschätzten Bedarf,
- wahlweise relevante Labor- oder Aktivitätswerte, wenn Daten vorhanden sind.

Weitere Teile:

- `Originale Aufnahme öffnen` zeigt die eingegangenen Angaben in einem Dialog. Das bestehende Prüf-Layout wird wiederverwendet.
- Eine Ereignisleiste zeigt Einladung, Aufnahme, Übernahme, Messungen, Beratungen, Pläne und Termine in verständlicher Reihenfolge. Sie nutzt dieselben Phasenfarben wie die Aufnahmen.
- Eine Karte `Nächster sinnvoller Schritt` gibt direkte Aktionen zur Akte, zum Plan, zur Messung oder zur Beratung.
- Fehlende Daten werden als klare Aufgaben gezeigt. Es gibt keine erfundenen Werte.
- Die Seite bleibt auf kleinen Bildschirmen gut lesbar. Tabs dürfen nicht abgeschnitten werden oder die Seite seitlich verschieben.

### Wahrscheinliche Dateien

- neue Komponente `components/patient-overview-tab.tsx`
- `app/(app)/patienten/[id]/patient-detail-client.tsx`
- `components/patient-tabs.tsx`
- `components/patient-stats-tab.tsx`
- `components/patient-intake-review.tsx`
- `lib/data/patient-workspace.ts`

### Prüfung

- Leere Akte, teilweise gefüllte Akte und vollständige Akte.
- Desktop-, Tablet- und Mobilansicht.
- Bedienung nur mit Tastatur sowie sinnvolle Beschriftungen für Diagramme.
- Playwright-Test für Start auf `Übersicht`, Dialog der Original-Aufnahme und direkte Aktionen.
- `npm run typecheck`, `npm run lint`, relevante Playwright-Tests und bei breiten Änderungen `npm run build`.

### GitHub-Meilenstein

Eigener Commit und Push nach erfolgreicher visueller und funktionaler Prüfung.

## Meilenstein 3: Kalorienrechner reparieren und einbetten

### Ergebnis

- Formeln, Grenzwerte und Makro-Verteilung liegen in einer gemeinsamen, reinen Rechenfunktion.
- Rechner-Seite und Patientenübersicht zeigen dieselben Werte.
- Die Auswahl einer Person lädt aktuelle Körperdaten, PAL und gespeicherte Ziele zuverlässig.
- Ein Wechsel der Formel oder Person hinterlässt keine alten Werte.
- Das Kreisdiagramm und die Makro-Anzeige funktionieren bei 0, sehr kleinen und sehr großen Werten sowie auf kleinen Bildschirmen.
- Der Graph bekommt eine verständliche Skala. Ein Wert über 4.000 kcal wird nicht mehr optisch bei 100 Prozent abgeschnitten, ohne dies zu erklären.
- Speichern wartet auf die Datenbank-Antwort. Erst danach erscheint die Erfolgsmeldung.

### Wahrscheinliche Dateien

- neue Rechenlogik unter `lib/nutrition/energy-calculation.ts`
- `app/(app)/kalorienrechner/page.tsx`
- `components/patient-overview-tab.tsx`
- `components/patient-tabs/aktivitaet-tab.tsx`

### Prüfung

- Reine Tests für Mifflin-St Jeor, Harris-Benedict, BMI, PAL, Zieländerung und Makros.
- Playwright-Test für Laden, Ändern und Speichern einer Person.
- Visuelle Prüfung der Diagramme bei mehreren Fenstergrößen.
- `npm run typecheck`, `npm run lint` und relevante Playwright-Tests.

### GitHub-Meilenstein

Eigener Commit und Push nach erfolgreicher Prüfung.

## Meilenstein 4: Wochenkalender auf dem Praxis-Dashboard

### Ergebnis

- Der Kalender zeigt eine echte Kalenderwoche von Montag bis Sonntag.
- Vorige und nächste Woche können direkt gewechselt werden. `Heute` springt zurück zur aktuellen Woche.
- Samstag und Sonntag sind sichtbar und dezent ausgegraut.
- Die gewählte Tagesliste bleibt direkt unter der Woche.
- Der Link `Großen Kalender öffnen` entfällt.
- `Termin eintragen` bleibt als klare Aktion erhalten.

### Wahrscheinliche Dateien

- `app/(app)/dashboard/dashboard-overview-client.tsx`
- eventuell gemeinsame Datums-Hilfe unter `lib/`

### Prüfung

- Wochenwechsel über Monats- und Jahresgrenzen.
- Richtige Markierung von heute, gewähltem Tag und Wochenende.
- Desktop- und Mobilansicht.
- Playwright-Test für Navigation und Tagesauswahl.
- `npm run typecheck`, `npm run lint` und relevante Playwright-Tests.

### GitHub-Meilenstein

Eigener Commit und Push nach erfolgreicher Prüfung.

## Meilenstein 5: Sicherer Ernährungsplan-Vorschlag mit Import und Export

### Berechtigungen

- `owner`, `admin` und `dietitian` dürfen Vorschläge erzeugen und prüfen.
- `assistant` darf nur öffnen oder exportieren, falls die bestehende Rechte-Struktur dies erlaubt.
- `institution_admin` erhält diese Funktion nur im passenden Einrichtungs-Ablauf.
- Die Prüfung erfolgt auf dem Server. Eine versteckte Schaltfläche allein ist keine Zugriffskontrolle.

### Eingaben

- Person und Zeitraum,
- Kalorien- und Nährstoffziele,
- Allergien, Unverträglichkeiten, Ernährungstyp und Ausschlüsse,
- Indikationen und Ziele,
- Mahlzeitenzahl und bevorzugte Zeitfenster,
- vorhandene Vorlagen, Rezepte, Portionsgrößen und Lebensmittelquellen,
- optional eine strukturierte JSON- oder CSV-Datei für zusätzliche Regeln.

### Ablauf

1. Das System prüft, ob Pflichtdaten fehlen oder Regeln widersprüchlich sind.
2. Es wählt zuerst passende gespeicherte Vorlagen und Rezepte.
3. Ein nachvollziehbarer Optimierer passt Portionen an Ziele und Grenzen an.
4. Harte Regeln schließen Kandidaten vollständig aus. Weiche Ziele beeinflussen die Bewertung.
5. Eine Vorschau zeigt pro Tag Nährwerte, Abweichungen, verletzte weiche Ziele und die Herkunft jeder Auswahl.
6. Erst `Als Entwurf übernehmen` schreibt den Plan in die Patientenakte.
7. Jeder Lauf wird mit Benutzer, Zeitpunkt, Eingaben und Ergebnis nachvollziehbar protokolliert.

### Import und Export

- Versioniertes JSON-Format als verlustfreie Hauptform.
- CSV als einfache Austauschform für Regeln und Planzeilen.
- Vor dem Import: Schema-Prüfung, Vorschau, verständliche Fehler und keine teilweise Übernahme.
- Export enthält Ziele, Regeln, Planzeilen, Portionswerte, Datenquellen und Prüfhinweise.
- Bestehende PDF- und CSV-Ausgaben für Patienten bleiben getrennt von diesem Arbeitsformat.

### Umsetzungsstand am 16. August 2026

- Erledigt: erklärbarer Vorschlag aus passenden Rezepten, serverseitige Rollenprüfung und bewusste Übernahme als Entwurf.
- Erledigt: versionierte Inari-JSON für einen Tagesplan. Export und Import prüfen Rolle sowie Lebensmittel- und Rezeptverweise auf dem Server. Der Import zeigt eine Vorschau und ersetzt erst nach Bestätigung die Slots des gewählten Tages.
- Noch offen: CSV-Austausch, mehrere Tage in einer Datei sowie das vollständige Optimieren von weichen Zielwerten und Portionsgrößen.

### Sicherheit

- Kein stilles Überschreiben eines vorhandenen Plans.
- Keine automatische klinische Entscheidung.
- Schwere Allergene sind harte Sperren.
- Jede Berechnung bleibt auf feste Quelldaten und gespeicherte Regeln zurückführbar.
- Wenn später ein Sprachmodell ergänzt wird, darf es nur strukturierte Vorschläge liefern. Der Server prüft jede Zeile erneut gegen dieselben festen Regeln.

### Prüfung

- Reine Tests für harte und weiche Regeln, Portionen, Zielabweichungen und widersprüchliche Eingaben.
- Zugriffstests für alle Rollen.
- Importtests mit gültigen, alten, unvollständigen und manipulierten Dateien.
- Playwright-Test von Vorschau bis bewusster Übernahme.
- `npm run validate:nutrients`, sofern die lizenzierte BLS-Datei vorhanden ist.
- `npm run lint`, `npm run typecheck`, relevante Playwright-Tests und `npm run build`.

### GitHub-Meilenstein

Eigener Commit und Push nach erfolgreicher Prüfung.

## Meilenstein 6: Abschluss, Design und Dokumentation

### Ergebnis

- Gemeinsame visuelle Prüfung der Aufnahme, Patientenakte, Rechner-Seite und des Praxis-Dashboards.
- Behebung von Abständen, abgeschnittenen Tabs, unklaren Farben und fehlerhaften Dialogen.
- Prüfung mit echten Datenmengen und leeren Zuständen.
- Aktualisierung von `documentation.md` und der passenden Statushinweise in `docs/user-priority-feedback.md`.
- Abschließender kompletter Prüf-Lauf.

### GitHub-Meilenstein

Abschluss-Commit und Push. Danach gibt es eine kurze Übergabe mit den neuen Abläufen, bekannten Grenzen und den wichtigsten Lernpunkten.

## Reihenfolge

Die Reihenfolge bleibt fest: erst falsche Fakten und sichere Übergabe, dann die neue Patientenübersicht, danach der gemeinsame Rechner, der Kalender und zuletzt der größere Plan-Vorschlag. So bleibt jeder Schritt einzeln prüfbar und nutzbar.

## Lernbild

Die Patientenakte wird wie das Cockpit eines Autos aufgebaut. Oben stehen Geschwindigkeit, Reichweite und Warnlampen. Die Werkstatt-Unterlagen bleiben erreichbar, liegen aber nicht auf dem Lenkrad. Jede Phase baut ein verlässliches Instrument ein und prüft es, bevor das nächste folgt.
