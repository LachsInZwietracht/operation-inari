import type { CounselingTemplate } from "@/lib/types";

export const COUNSELING_TEMPLATES: CounselingTemplate[] = [
  {
    id: "template_1",
    name: "Erstberatung Adipositas",
    type: "Erstberatung",
    indication: "Adipositas",
    content: `Erstberatung Adipositas

Anamnese:
- Gewicht: ___ kg, Größe: ___ cm, BMI: ___
- Gewichtsverlauf der letzten Jahre: ___
- Familienanamnese: ___
- Bewegung: ___
- Komorbiditäten: ___

Ernährungsgewohnheiten:
- Frühstück: ___
- Mittagessen: ___
- Abendessen: ___
- Zwischenmahlzeiten: ___
- Getränke: ___

Beratungsinhalte:
- Grundlagen der ausgewogenen Ernährung
- DGE-Ernährungskreis / Tellermodell
- Portionsgrößen (Handmaß)
- Energiebilanz und Grundumsatz
- Sättigungsprinzipien

Vereinbarungen:
1. ___
2. ___
3. ___

Nächster Termin: ___`,
  },
  {
    id: "template_2",
    name: "Folgeberatung Adipositas",
    type: "Folgeberatung",
    indication: "Adipositas",
    content: `Folgeberatung Adipositas

Gewichtsverlauf: ___ kg → ___ kg (Δ ___ kg)
Bauchumfang: ___ cm (vorher: ___ cm)

Protokollauswertung:
- Energiezufuhr: Ø ___ kcal/Tag (Ziel: ___ kcal)
- Eiweißzufuhr: ___
- Fett: ___
- Ballaststoffe: ___
- Auffällige Mikronährstoffe: ___

Positive Entwicklungen:
- ___

Verbesserungspotenzial:
- ___

Neue Vereinbarungen:
1. ___
2. ___
3. ___

Nächster Termin: ___`,
  },
  {
    id: "template_3",
    name: "Erstberatung Diabetes Typ 2",
    type: "Erstberatung",
    indication: "Diabetes mellitus Typ 2",
    content: `Erstberatung Diabetes mellitus Typ 2

Anamnese:
- Gewicht: ___ kg, Größe: ___ cm, BMI: ___
- Diagnose seit: ___
- Medikation: ___
- HbA1c aktuell: ___ %
- Nüchtern-BZ: ___ mg/dl
- Komorbiditäten: ___

Ernährungsgewohnheiten:
- Mahlzeitenrhythmus: ___
- Kohlenhydratquellen: ___
- Getränke: ___
- Alkohol: ___

Beratungsinhalte:
- Grundlagen Diabetes und Ernährung
- Kohlenhydratzählung (BE/KE)
- Glykämischer Index / Glykämische Last
- Mahlzeitenrhythmus
- Portionsgrößen (Handmaß)

Vereinbarungen:
1. ___
2. ___
3. ___

Blutzucker-Selbstmessung: ___
Nächster HbA1c: ___
Nächster Termin: ___`,
  },
  {
    id: "template_4",
    name: "Folgeberatung Diabetes Typ 2",
    type: "Folgeberatung",
    indication: "Diabetes mellitus Typ 2",
    content: `Folgeberatung Diabetes mellitus Typ 2

Aktuelle Werte:
- Gewicht: ___ kg (vorher: ___ kg)
- HbA1c: ___ % (vorher: ___ %)
- Nüchtern-BZ: ___ mg/dl
- Medikation: ___

BZ-Selbstmessungen:
- Nüchtern: Ø ___ mg/dl
- Postprandial: Ø ___ mg/dl
- Auffälligkeiten: ___

Protokollauswertung:
- Kohlenhydratzufuhr: Ø ___ g/Tag (___ BE/Tag)
- Verteilung über den Tag: ___
- Ballaststoffzufuhr: ___

Fortschritte:
- ___

Verbesserungspotenzial:
- ___

Angepasste Vereinbarungen:
1. ___
2. ___
3. ___

Nächster Termin: ___`,
  },
  {
    id: "template_5",
    name: "Erstberatung Zöliakie",
    type: "Erstberatung",
    indication: "Zöliakie",
    content: `Erstberatung Zöliakie

Anamnese:
- Gewicht: ___ kg, Größe: ___ cm, BMI: ___
- Diagnose seit: ___ (Methode: ___)
- Aktuelle Beschwerden: ___
- Begleiterkrankungen: ___

Laborwerte:
- Transglutaminase-AK: ___
- Eisen/Ferritin: ___
- Vitamin D: ___
- Calcium: ___
- Vitamin B12: ___
- Folsäure: ___

Aktuelle Ernährung:
- Glutenfreie Erfahrung: ___
- Hauptsächliche Sättigungsbeilagen: ___
- Milchprodukte: ___
- Probleme/Unsicherheiten: ___

Beratungsinhalte:
- Glutenfreie Lebensmittel vs. glutenhaltig
- Kontamination vermeiden
- Kennzeichnung und verstecktes Gluten
- Kritische Nährstoffe bei Zöliakie
- Natürlich glutenfreie Getreide/Pseudogetreide

Vereinbarungen:
1. ___
2. ___
3. ___

Nächster Termin: ___`,
  },
  {
    id: "template_6",
    name: "Erstberatung Nahrungsmittelallergie",
    type: "Erstberatung",
    indication: "Nahrungsmittelallergie",
    content: `Erstberatung Nahrungsmittelallergie

Anamnese:
- Gewicht: ___ kg, Größe: ___ cm, BMI: ___
- Allergene: ___
- Diagnose durch: ___ (Prick-Test / RAST / OFC)
- Schweregrad der Reaktionen: ___
- Notfallset vorhanden: ja / nein
- Letzte Reaktion: ___

Aktuelle Ernährung:
- Meidungsverhalten: ___
- Einschränkungen im Alltag: ___
- Außer-Haus-Essen: ___
- Fertigprodukte: ___

Beratungsinhalte:
- Allergenkennzeichnung (EU 1169/2011)
- Kreuzreaktionen und Spuren
- Sichere Alternativen für: ___
- Nährstoffversorgung bei Elimination
- Restaurant-Kommunikation / Allergen-Ausweis

Vereinbarungen:
1. ___
2. ___
3. ___

Nächster Termin: ___`,
  },
];
