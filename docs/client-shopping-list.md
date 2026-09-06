# Einkaufsliste für Klienten

## Ziel und Einstieg

Unterstützt Priorität 1 aus `user-priority-feedback.md`: intuitive Bedienung ohne Einarbeitung. Der konkrete Anlass ist der Wocheneinkauf. Im persönlichen Plan führt „Für nächste Woche einkaufen“ direkt zur fertigen Liste. Die Hauptnavigation bleibt bei ihren bestehenden Bereichen; Einkauf ist eine Unterseite von Plan.

Die alte Beraterroute `/ernaehrungsplan/einkaufsliste` und ihr Menüeintrag sind entfernt. Institutionelle Einkaufs-/Produktionsfunktionen bleiben bestehen.

## Bedienkonzept

- Nächste Kalenderwoche, Montag bis Sonntag, ist voreingestellt. „Diese Woche“ ist die einzige gleichrangige Alternative. Zeitraum immer mit Datum.
- Keine Planauswahl, kein Erstellen-Dialog: Freigegebene Mahlzeiten liefern die Liste unmittelbar. Ein fehlender Plan erzeugt einen erklärenden Leerzustand; ein Ladefehler bekommt einen eigenen Wiederholen-Button.
- Eine klare Hierarchie: Woche, offene Zutaten, Lebensmittelgruppen. Große Abhakflächen, zurückhaltende Farbe, keine Nährstofftabellen oder Gesamtgewichte.
- Zutaten werden mit geplanten Mengen zusammengeführt. Keine erfundenen Packungsgrößen, Stückzahlen oder Roh-/Gargewicht-Umrechnungen. Verschiedene Lebensmittel-IDs werden nicht automatisch vermischt.
- „Schon zu Hause“ und „eingekauft“ werden beide abgehakt. Erledigtes bleibt rückgängig machbar in einer aufklappbaren Gruppe.
- Rezept und Plantag werden erst unter „Wofür brauche ich das?“ sichtbar.
- Teilen über die Systemfunktion, ersatzweise Zwischenablage, enthält nur offene Zutaten. Teilpläne und unaufgelöste Zutaten werden auch im geteilten Text gekennzeichnet.

## Verlässlichkeit und Grenzen

Die Liste liest aktuelle Freigaben beim Öffnen/Neuladen. Abhakungen liegen im lokalen Browserspeicher, getrennt nach Konto und Kalenderwoche. Ein Lebensmittel mit geänderter Gesamtmenge wird wieder offen; reine Rezept-/Tagesverschiebungen bei gleicher Menge behalten ihren Haken. Es gibt keine Synchronisierung zwischen Geräten und keine zugesicherte Offline-Verfügbarkeit der Seite. Speicherfehler werden sichtbar erklärt.

Die Datenabfrage nutzt ausschließlich die angemeldete Sitzung und aktive eigene Klientenverknüpfungen. Nur aktive/freigegebene, nicht ersetzte Pläne des Zeitraums werden gelesen. Rezeptzutaten und Lebensmittel bleiben RLS-geschützt. Nicht lesbare oder leere Rezepte werden als unvollständig ausgewiesen. Es werden keine Berechtigungen erweitert.

Die Freigabe eines Tages sagt nicht aus, dass jede Mahlzeit dieses Tages geplant ist. Die Anzeige „Tage mit Plan“ zählt Tage mit mindestens einem Eintrag. Persönliche Zusatzartikel, Vorratsmengen, Haushaltsportionen und Offline-Synchronisierung sind nicht Teil dieses Ablaufs.
