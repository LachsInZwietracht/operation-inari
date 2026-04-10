import type { CounselingSession } from "@/lib/types";

const ts = (date: string) => ({ createdAt: `${date}T00:00:00Z`, updatedAt: `${date}T00:00:00Z` });

export const COUNSELING_SESSIONS: CounselingSession[] = [
  {
    id: "counseling_1",
    patientId: "patient_1",
    date: "2026-01-15",
    duration: 60,
    type: "Erstberatung",
    indication: "Adipositas",
    goals: "Gewichtsreduktion um 10 kg innerhalb von 6 Monaten. Umstellung auf ausgewogene Ernährung.",
    content: `Erstberatung Adipositas – Fr. Schneider

Anamnese:
- Gewicht: 92 kg, Größe: 168 cm, BMI: 32,6
- Gewichtszunahme in den letzten 5 Jahren (+15 kg)
- Familienanamnese: Mutter Diabetes Typ 2
- Bewegung: 1x/Woche Spaziergang, 30 Min.
- Keine bekannten Unverträglichkeiten

Ernährungsgewohnheiten:
- Frühstück wird häufig ausgelassen
- Mittagessen: Kantine, häufig Schnitzel/Pommes
- Abendessen: Brot mit Wurst/Käse, oft vor dem Fernseher
- Zwischenmahlzeiten: Schokolade, Kekse am Nachmittag
- Getränke: 1,5 L Wasser, 2 Tassen Kaffee mit Zucker, 1 Glas Saft

Beratungsinhalte:
- Grundlagen der ausgewogenen Ernährung besprochen
- DGE-Ernährungskreis erklärt
- Tellermodell vorgestellt
- Portionsgrößen visualisiert

Vereinbarungen:
1. Regelmäßig frühstücken (Haferbrei/Vollkornbrot)
2. Kantinenangebot bewusster wählen (mehr Gemüse)
3. Nachmittags-Snack durch Obst/Nüsse ersetzen
4. Getränke: Zucker aus Kaffee streichen, Saft durch Wasser ersetzen
5. 3-Tage-Ernährungsprotokoll bis zum nächsten Termin`,
    recommendations: "Ernährungstagebuch führen. Bewegung auf 3x/Woche steigern (Walking). Nächster Termin in 4 Wochen.",
    nextAppointment: "2026-02-12",
    timeline: [
      {
        id: "timeline_c1_intake",
        date: "2026-01-15",
        title: "Anamnese & Zieldefinition",
        description: "BMI, Gewohnheiten und Motivation erhoben.",
        status: "done",
      },
      {
        id: "timeline_c1_plan",
        date: "2026-01-16",
        title: "Individueller Ernährungsplan",
        description: "Tellermodell & Einkaufsliste vorbereitet.",
        status: "active",
      },
      {
        id: "timeline_c1_follow",
        date: "2026-02-12",
        title: "Folgetermin",
        description: "Protokolle prüfen & Fortschritt messen.",
        status: "upcoming",
      },
    ],
    materials: [
      {
        id: "material_c1_log",
        title: "3-Tage-Ernährungsprotokoll.pdf",
        type: "PDF",
        url: "https://files.prodi/mock/protokoll.pdf",
        status: "shared",
        notes: "per E-Mail versendet",
      },
      {
        id: "material_c1_plate",
        title: "Tellermodell Poster",
        type: "Handout",
        status: "viewed",
        notes: "während Sitzung gezeigt",
      },
    ],
    progress: [
      {
        id: "progress_c1_weight",
        label: "Gewichtsreduktion",
        value: 1.5,
        target: 10,
        unit: "kg",
        trend: "up",
      },
      {
        id: "progress_c1_activity",
        label: "Bewegung/Woche",
        value: 2,
        target: 3,
        unit: "Einheiten",
        trend: "steady",
      },
    ],
    ...ts("2026-01-15"),
  },
  {
    id: "counseling_2",
    patientId: "patient_1",
    date: "2026-02-12",
    duration: 45,
    type: "Folgeberatung",
    indication: "Adipositas",
    goals: "Fortschritt evaluieren. Protokollauswertung besprechen.",
    content: `Folgeberatung Adipositas – Fr. Schneider

Gewichtsverlauf: 92 kg → 89,5 kg (-2,5 kg in 4 Wochen)
Bauchumfang: 98 cm → 96 cm

Protokollauswertung:
- Energiezufuhr: Ø 1.850 kcal/Tag (Ziel: 1.700 kcal)
- Eiweißzufuhr: ausreichend (65 g/Tag)
- Fett: leicht erhöht, v.a. gesättigte Fettsäuren
- Ballaststoffe: unter Empfehlung (18 g statt 30 g)
- Vitamin D und Calcium unter Referenzwerten

Positive Entwicklungen:
- Frühstück wird regelmäßig eingenommen
- Kantinenauswahl verbessert
- Zucker aus Kaffee gestrichen

Verbesserungspotenzial:
- Abendessen noch zu kalorienreich
- Ballaststoffzufuhr steigern
- Mehr Gemüse und Hülsenfrüchte

Neue Vereinbarungen:
1. Abendessen: Hälfte des Tellers mit Gemüse/Salat
2. 2x/Woche Hülsenfrüchte einbauen
3. Vollkornprodukte bevorzugen`,
    recommendations: "Weiterhin Protokoll führen. Ballaststoffzufuhr gezielt steigern. Vitamin-D-Supplementierung mit Hausarzt besprechen.",
    nextAppointment: "2026-03-12",
    timeline: [
      {
        id: "timeline_c2_review",
        date: "2026-02-12",
        title: "Protokollanalyse",
        description: "Auswertung des 3-Tage-Protokolls mit Schwerpunkten Energie/Ballaststoffe",
        status: "done",
      },
      {
        id: "timeline_c2_materials",
        date: "2026-02-15",
        title: "Ballaststoff-Rezepte senden",
        status: "active",
      },
      {
        id: "timeline_c2_next",
        date: "2026-03-12",
        title: "Kontrolltermin",
        status: "upcoming",
      },
    ],
    materials: [
      {
        id: "material_c2_fiber",
        title: "Ballaststoff-Booster.docx",
        type: "Dokument",
        status: "pending",
        notes: "muss nachgereicht werden",
      },
      {
        id: "material_c2_recipe",
        title: "Hülsenfrucht-Rezepte.pdf",
        type: "PDF",
        status: "shared",
      },
    ],
    progress: [
      {
        id: "progress_c2_fiber",
        label: "Ballaststoffe",
        value: 22,
        target: 30,
        unit: "g",
        trend: "up",
      },
      {
        id: "progress_c2_weight",
        label: "Gewichtsverlauf",
        value: 2.5,
        target: 10,
        unit: "kg",
        trend: "up",
      },
    ],
    ...ts("2026-02-12"),
  },
  {
    id: "counseling_3",
    patientId: "patient_2",
    date: "2026-01-20",
    duration: 60,
    type: "Erstberatung",
    indication: "Diabetes mellitus Typ 2",
    goals: "Blutzuckeroptimierung durch Ernährungsumstellung. HbA1c-Senkung auf < 7%.",
    content: `Erstberatung Diabetes mellitus Typ 2 – Hr. Weber

Anamnese:
- Gewicht: 98 kg, Größe: 180 cm, BMI: 30,2
- Diabetes Typ 2 seit 2023
- Medikation: Metformin 1000 mg 2x/Tag
- HbA1c aktuell: 7,8 %
- Blutdruck: 145/90 mmHg (medikamentös behandelt)
- Kein Sport, beruflich Bürotätigkeit

Ernährungsgewohnheiten:
- Großes Frühstück: Brötchen, Marmelade, Wurst
- Mittagessen: Mensa, oft Currywurst, Pommes
- Abends: warme Mahlzeit, Portion eher groß
- Getränke: 3-4 Tassen Kaffee, Apfelschorle
- Alkohol: 2-3 Bier am Wochenende

Beratungsinhalte:
- Grundlagen Diabetes und Ernährung
- Kohlenhydratzählung (BE/KE) erklärt
- Glykämischer Index besprochen
- Mahlzeitenrhythmus: 3 Hauptmahlzeiten + max. 1 Snack
- Portionsgrößen: Handmaß erklärt

Vereinbarungen:
1. Weißmehlprodukte durch Vollkorn ersetzen
2. Gemüseanteil bei jeder Mahlzeit erhöhen
3. Apfelschorle durch Wasser/ungesüßten Tee ersetzen
4. Alkohol auf 1-2 Einheiten/Woche reduzieren
5. 24h-Recall beim nächsten Termin`,
    recommendations: "Blutzucker-Selbstmessung nüchtern + 2h nach Mittagessen. Ergebnisse dokumentieren. Nächster HbA1c in 3 Monaten.",
    nextAppointment: "2026-02-17",
    ...ts("2026-01-20"),
  },
  {
    id: "counseling_4",
    patientId: "patient_4",
    date: "2026-01-10",
    duration: 60,
    type: "Erstberatung",
    indication: "Adipositas",
    goals: "Gewichtsreduktion um 15 kg. Verbesserung der Komorbiditäten (Hypertonie, Schlafapnoe).",
    content: `Erstberatung Adipositas (Grad II) – Hr. Fischer

Anamnese:
- Gewicht: 118 kg, Größe: 175 cm, BMI: 38,5
- Komorbiditäten: Hypertonie, obstruktive Schlafapnoe (CPAP)
- Medikation: Ramipril 5 mg, CPAP nachts
- Gewichtszunahme seit Berentung vor 3 Jahren
- Früher sportlich aktiv (Fußball)

Ernährungsgewohnheiten:
- Frühstück: reichhaltig (Brötchen, Aufschnitt, Ei)
- Mittagessen: selbst gekocht, traditionelle Küche
- Abendessen: Brot mit Belag
- Portionen durchgehend zu groß
- Naschen abends: Chips, Nüsse
- Getränke: Kaffee, gelegentlich Bier

Beratungsinhalte:
- Energiebilanz und Grundumsatz erklärt
- Sättigungsprinzip: Volumetrics-Ansatz
- Lebensmittelauswahl: Ampelsystem besprochen
- Bewegungsempfehlungen: Schwimmen, Nordic Walking

Vereinbarungen:
1. Portionsgrößen um ca. 1/3 reduzieren
2. Abendliches Naschen durch rohes Gemüse ersetzen
3. Mindestens 2 L Wasser/Tag trinken
4. 3x/Woche 30 Min. Spaziergang
5. 3-Tage-Ernährungsprotokoll führen`,
    recommendations: "Wöchentliches Wiegen (gleiche Uhrzeit). Protokoll für nächsten Termin mitbringen.",
    nextAppointment: "2026-02-10",
    ...ts("2026-01-10"),
  },
  {
    id: "counseling_5",
    patientId: "patient_3",
    date: "2026-02-01",
    duration: 45,
    type: "Erstberatung",
    indication: "Zöliakie",
    goals: "Sicherstellung einer adäquaten Nährstoffversorgung unter glutenfreier Ernährung.",
    content: `Erstberatung Zöliakie – Fr. Hoffmann

Anamnese:
- Gewicht: 58 kg, Größe: 165 cm, BMI: 21,3
- Zöliakie-Diagnose seit 2020 (Biopsie-bestätigt)
- Strikt glutenfrei seit Diagnose
- Keine weitere Medikation
- Sportlich: Yoga 2x/Woche, Joggen 1x/Woche

Aktuelle Ernährung:
- Glutenfreie Produkte aus dem Fachhandel
- Viel Reis und Kartoffeln als Sättigungsbeilage
- Guter Gemüse- und Obstkonsum
- Milchprodukte: mäßig (anfängliche Laktoseintoleranz)

Laborwerte (zuletzt):
- Eisen: 10 µg/dl (grenzwertig)
- Vitamin D: 18 ng/ml (zu niedrig)
- Calcium: im Normbereich
- Transglutaminase-AK: negativ (gute Compliance)

Beratungsinhalte:
- Glutenfreie Lebensmittel vs. Kontamination
- Kritische Nährstoffe bei Zöliakie: Eisen, Calcium, Vitamin D, B12, Folsäure
- Natürlich glutenfreie Getreide: Hirse, Buchweizen, Quinoa, Amaranth
- Lebensmittelkennzeichnung: verstecktes Gluten erkennen

Vereinbarungen:
1. Eisenreiche Lebensmittel gezielt einbauen (Hülsenfrüchte, Fleisch)
2. Vitamin D supplementieren (Arzt-Absprache)
3. Mehr Pseudogetreide für Abwechslung
4. Calcium: Milchprodukte oder Alternativen (angereichert)`,
    recommendations: "Vitamin D und Eisen beim Arzt kontrollieren lassen. Ernährungsprotokoll zum nächsten Termin. Rezeptideen glutenfrei mitgegeben.",
    nextAppointment: "2026-03-01",
    ...ts("2026-02-01"),
  },
  {
    id: "counseling_6",
    patientId: "patient_5",
    date: "2026-02-05",
    duration: 45,
    type: "Erstberatung",
    indication: "Nahrungsmittelallergie",
    goals: "Sichere Elimination von Allergenen bei ausgewogener Ernährung.",
    content: `Erstberatung Nahrungsmittelallergie – Fr. Müller

Anamnese:
- Gewicht: 62 kg, Größe: 170 cm, BMI: 21,5
- Allergien: Baumnüsse (Anaphylaxie), Soja, Sellerie
- Notfallset (Adrenalin-Autoinjektor) vorhanden
- Letzte Reaktion: vor 8 Monaten (Soja in Fertigprodukt)

Ernährungsgewohnheiten:
- Kocht überwiegend selbst (Sicherheit)
- Meidet Fertigprodukte weitgehend
- Isst selten auswärts (Unsicherheit)
- Ernährung insgesamt gut, aber eingeschränkte Lebensmittelvielfalt

Beratungsinhalte:
- Allergenkennzeichnung (EU-Verordnung) besprochen
- Kreuzreaktionen und Kontamination
- Sichere Alternativen für Nüsse: Kürbiskerne, Sonnenblumenkerne
- Soja-Alternativen: Haferdrink, Kokosmilch
- Sichere Restaurant-Kommunikation

Vereinbarungen:
1. Allergen-Ausweis immer mitführen
2. Neue Alternativen ausprobieren (Kürbiskerne, Leinsamen)
3. Lebensmittellabel-Training (versteckte Allergene)
4. 2 Restaurantbesuche mit Allergen-Kommunikation üben`,
    recommendations: "Allergologische Kontrolle jährlich. Notfallset regelmäßig prüfen. Kochkurs für Allergiker empfohlen.",
    nextAppointment: "2026-03-05",
    ...ts("2026-02-05"),
  },
];
