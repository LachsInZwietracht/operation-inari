# DEBInet Import - Planning Notes

## Purpose

This document is a planning note for a possible DEBInet import workflow. It is not an implementation spec and it is not yet verified against a real DEBInet export sample.

Current status:
- Not implemented
- Export format still needs verification against real files
- Mapping and persistence details should be validated against the current protocol data model before implementation

## Background

DEBInet (Deutsches Ernährungsberatungs- und -informationsnetz) is a web-based tool for recording nutrition protocols. The legacy desktop PRODI product supports importing DEBInet exports and mapping them onto BLS-coded foods for nutrient analysis.

The intended web equivalent in Operation Prodi is:
1. export a DEBInet protocol file
2. upload it in the patient protocol area
3. preview and resolve food mappings
4. create an internal nutrition protocol from the imported rows

## Proposed Workflow

1. User exports a DEBInet protocol as CSV or another structured file.
2. User uploads the file from the patient protocol page.
3. The app parses rows and attempts BLS-code or name-based matching.
4. The UI shows a mapping preview with unresolved rows highlighted.
5. The user confirms or manually fixes mappings.
6. The app saves the result as an internal protocol.

## Proposed Field Mapping

| DEBInet field | Prodi target | Notes |
|---|---|---|
| `Lebensmittelname` | food reference | Prefer direct code match; otherwise fuzzy/name-based matching |
| `BLS-Code` | food lookup key | Most reliable mapping path if present and valid |
| `Menge (g)` | protocol entry amount | Direct numeric mapping |
| `Mahlzeit` | meal slot | Requires normalization to internal meal slot IDs |
| `Datum` | protocol day date | Normalize to ISO date |
| `Uhrzeit` | protocol entry time | Normalize to `HH:mm` when present |

## Example CSV Shape

```csv
Datum;Uhrzeit;Mahlzeit;BLS-Code;Lebensmittel;Menge_g
2026-03-10;07:30;Frühstück;B100100;Vollkornbrot;80
2026-03-10;07:30;Frühstück;F100100;Butter;10
2026-03-10;12:00;Mittagessen;G100100;Reis gekocht;200
```

This example is provisional. Verify the actual export columns before implementation.

## Proposed UI

- Import action on `/patienten/[id]/protokolle`
- File upload dialog for `.csv` or other verified supported formats
- Mapping preview table for every imported row
- Clear matched / possible match / unresolved states
- Manual override control for unresolved mappings
- Summary of imported days, rows, and match rate

## Technical Considerations

- Use a CSV parser only after the real export format is confirmed.
- Prefer direct BLS-code lookup over fuzzy matching when a valid code is present.
- Normalize meal labels such as `Frühstück` and `Mittagessen` into internal meal slot values.
- Handle partial imports and invalid rows explicitly; do not silently drop unresolved entries.
- Verify the current protocol schema and persistence path before introducing any importer-specific types.

## Open Questions

- What does the real DEBInet export format look like?
- Are BLS codes always included, or only sometimes?
- Does the export support multiple days in one file?
- Are times and meal labels normalized consistently?
- Should import create a draft protocol immediately, or require explicit confirmation first?

## Dependencies

- Reliable food lookup against the current Supabase-backed food database
- Confirmed DEBInet export samples
- Protocol persistence flow aligned with the current patient protocol implementation
