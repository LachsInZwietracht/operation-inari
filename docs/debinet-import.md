# DEBInet Import — Planungsdokument

## Was ist DEBInet?

DEBInet (Deutsches Ernährungsberatungs- und -informationsnetz) ist ein webbasiertes Tool zur Erfassung von Ernährungsprotokollen unter [debinet.de](https://debinet.de). Es wird von Ernährungsberatern und in der Forschung eingesetzt, um detaillierte Ernährungsprotokolle digital zu erfassen und auszuwerten.

## Aktuelle PRODI-Integration

Die bestehende Desktop-PRODI-Software bietet eine Import-Funktion für DEBInet-Protokolle:
- Patienten erfassen ihre Ernährung über DEBInet
- Die Daten werden exportiert (CSV/strukturiertes Format)
- PRODI importiert die Daten und führt eine Nährstoffanalyse durch
- Die importierten Daten werden den BLS-Codes (Bundeslebensmittelschlüssel) zugeordnet

## Geplanter Ansatz für Prodi (Web)

### Import-Workflow

1. **Export aus DEBInet**: Patient oder Berater exportiert das Ernährungsprotokoll als CSV oder strukturierte Datei
2. **Upload in Prodi**: Import-Button auf der Protokollseite eines Patienten
3. **Mapping-Preview**: Vorschau der Zuordnung von DEBInet-Lebensmitteln zu unserer Datenbank (BLS-Codes)
4. **Bestätigung & Import**: Berater prüft und bestätigt die Zuordnung
5. **Protokoll erstellt**: Importierte Daten werden als `NutritionProtocol` gespeichert

### Datenmapping

DEBInet verwendet eigene Lebensmittelbezeichnungen, die auf BLS-Codes gemappt werden müssen:

| DEBInet-Feld | Prodi-Feld | Mapping |
|--------------|-----------|---------|
| Lebensmittelname | `Food.name` | Fuzzy-Match oder BLS-Code-Lookup |
| BLS-Code | `Food.id` / `Food.source` | Direktes Mapping über BLS-Schlüssel |
| Menge (g) | `ProtocolEntry.amount` | 1:1 |
| Mahlzeit | `ProtocolEntry.mealSlot` | Mapping auf unsere `MealSlotType` |
| Datum | `ProtocolDay.date` | ISO-Format |
| Uhrzeit | `ProtocolEntry.time` | HH:mm |

### CSV-Format (erwartet)

```csv
Datum;Uhrzeit;Mahlzeit;BLS-Code;Lebensmittel;Menge_g
2026-03-10;07:30;Frühstück;B100100;Vollkornbrot;80
2026-03-10;07:30;Frühstück;F100100;Butter;10
2026-03-10;12:00;Mittagessen;G100100;Reis gekocht;200
```

### UI-Spezifikation

- **Import-Button**: Auf der Protokollseite (`/patienten/[id]/protokolle`) als sekundäre Aktion neben "Neues Protokoll"
- **File-Upload-Dialog**: Drag & Drop oder Datei-Auswahl (`.csv`-Dateien)
- **Mapping-Preview**:
  - Tabelle mit allen importierten Zeilen
  - Grüne Markierung: Erfolgreich zugeordnet (BLS-Code gefunden)
  - Gelbe Markierung: Ähnliches Lebensmittel gefunden (Fuzzy-Match)
  - Rote Markierung: Kein passendes Lebensmittel (manuelles Mapping nötig)
  - Dropdown für manuelle Zuordnung bei gelben/roten Einträgen
- **Zusammenfassung**: Anzahl importierter Tage, Einträge, Zuordnungsquote

### Technische Anforderungen

- CSV-Parser (z.B. `papaparse`)
- BLS-Code-Mapping-Tabelle (eigene Lookup-Tabelle oder Fuzzy-Search über `Food.source`)
- Mahlzeiten-Mapping: "Frühstück" → `fruehstueck`, "Mittagessen" → `mittagessen`, etc.
- Fehlerbehandlung für ungültige/unvollständige Daten

### Abhängigkeiten

- Vollständige BLS-Datenbank (aktuell nur ~50 Mock-Lebensmittel)
- DEBInet-Export-Format-Dokumentation (muss verifiziert werden)
- Backend (Supabase) für persistente Speicherung der importierten Protokolle

## Status

**Nicht implementiert** — Dieses Dokument dient der Planung. Die Implementierung erfolgt nach:
1. Vollständiger BLS-Datenbank-Integration
2. Supabase-Backend-Migration
3. Klärung des exakten DEBInet-Export-Formats
