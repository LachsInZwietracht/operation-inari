# Backend-Aufgaben — Supabase-Migration

Dieses Dokument listet alle Bereiche auf, die derzeit Mock-Daten oder localStorage verwenden und auf Supabase migriert werden müssen.

## Authentifizierung
- [ ] Benutzer-Registrierung und Login (Supabase Auth)
- [ ] Rollenbasierte Zugriffskontrolle (Ernährungsberater, Patient, Admin)
- [ ] Passwort-Reset und E-Mail-Verifizierung

## Lebensmitteldatenbank
- [ ] Supabase-Tabellen für Lebensmittel, Kategorien, Nährstoffe
- [ ] BLS-Datenimport (Bundeslebensmittelschlüssel)
- [ ] Volltextsuche über Supabase (pg_trgm / Full-Text Search)
- [ ] Eigene Lebensmittel pro Benutzer (RLS-Policies)
- **Aktuell:** ~48 Mock-Lebensmittel in `lib/mock-data/foods.ts`

## Rezeptverwaltung
- [ ] Supabase-Tabellen für Rezepte, Zutaten, Anleitungen
- [ ] RLS-Policies (eigene vs. öffentliche Rezepte)
- [ ] Rezeptbilder via Supabase Storage
- **Aktuell:** 8 Mock-Rezepte + localStorage (`prodi_custom_recipes`)

## Ernährungsplanung
- [ ] Supabase-Tabellen für Tagespläne, Mahlzeit-Slots, Einträge
- [ ] Pro-Benutzer-Speicherung mit RLS
- [ ] Historische Pläne und Auswertungen
- **Aktuell:** 2 Mock-Pläne + localStorage (`prodi_meal_plans`)

## Referenzwerte
- [ ] Supabase-Tabelle mit DGE/ÖGE/SGE-Referenzwerten
- [ ] Alters- und geschlechtsspezifische Werte
- [ ] Admin-Oberfläche zur Pflege
- **Aktuell:** Statische DGE-Werte in `lib/mock-data/reference-values.ts`

## Patientenverwaltung (Phase 2)
- [ ] Patienten-Tabelle mit Profildaten
- [ ] Zuordnung Ernährungsberater → Patient
- [ ] Individuelle Referenzwerte pro Patient
- [ ] Gemeinsame Pläne und Berichte

## Echtzeit-Funktionen
- [ ] Supabase Realtime für kollaborative Planbearbeitung
- [ ] Benachrichtigungen bei Planänderungen

## Dateispeicherung
- [ ] Supabase Storage für Rezeptbilder
- [ ] Profilbilder für Benutzer
- [ ] Export-Dateien (PDF-Berichte)

## API & Integrationen
- [ ] Server Actions für alle CRUD-Operationen
- [ ] React Query Integration für Caching und Optimistic Updates
- [ ] PDF-Export für Ernährungspläne und Berichte
