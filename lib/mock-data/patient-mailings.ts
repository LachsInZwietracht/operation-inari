import type { MailMergeTemplate } from "@/lib/types";

export const MAIL_MERGE_TEMPLATES: MailMergeTemplate[] = [
  {
    id: "follow_up",
    name: "Termin-Nachverfolgung",
    category: "termin",
    subject: "Ihr nächster Beratungstermin bei Operation Prodi",
    body: `Liebe*r {{patient.firstName}} {{patient.lastName}},\n\nwir freuen uns, Sie am {{appointment.date}} um {{appointment.time}} Uhr in unserer Praxis begrüßen zu dürfen.\nBitte bringen Sie Ihr Ernährungstagebuch und – falls vorhanden – aktuelle Laborwerte mit.\n\nSollte der Termin nicht wahrgenommen werden können, geben Sie uns bitte kurz Rückmeldung.\n\nFreundliche Grüße\n{{practice.name}}`,
  },
  {
    id: "protocol_summary",
    name: "Protokoll-Auswertung",
    category: "zusammenfassung",
    subject: "Ihre persönliche Ernährungsanalyse",
    body: `Hallo {{patient.firstName}},\n\nwir haben Ihr aktuelles Protokoll ausgewertet. Im Fokus stehen folgende Punkte:\n- Energieaufnahme: {{protocol.energy}} kcal / Tag\n- Eiweißzufuhr: {{protocol.protein}} g / Tag\n- Priorität: {{protocol.priority}}\n\nIn der kommenden Sitzung besprechen wir konkrete Maßnahmen.\nBei Fragen können Sie direkt auf diese E-Mail antworten.\n\nViele Grüße\nIhr Team von {{practice.name}}`,
  },
  {
    id: "birthday_greeting",
    name: "Geburtstagsgruß",
    category: "geburtstag",
    subject: "Alles Gute zum Geburtstag, {{patient.firstName}}!",
    body: `Liebe*r {{patient.firstName}},\n\nzu Ihrem heutigen Geburtstag senden wir die herzlichsten Glückwünsche!\nWir wünschen Ihnen ein gesundes neues Lebensjahr voller Genuss, Energie und Wohlbefinden.\n\nAls kleines Geschenk finden Sie im Anhang einen neuen Rezeptplan, den wir individuell vorbereitet haben.\n\nGenießen Sie Ihren Tag!\nIhr Team von {{practice.name}}`,
  },
];

export const MAIL_MERGE_PLACEHOLDERS = [
  { token: "{{patient.firstName}}", description: "Vorname des Patienten" },
  { token: "{{patient.lastName}}", description: "Nachname des Patienten" },
  { token: "{{patient.fullName}}", description: "Vor- und Nachname" },
  { token: "{{patient.dateOfBirth}}", description: "Geburtsdatum (DD.MM.YYYY)" },
  { token: "{{appointment.date}}", description: "Termin-Datum" },
  { token: "{{appointment.time}}", description: "Termin-Uhrzeit" },
  { token: "{{protocol.energy}}", description: "Kcal je Tag" },
  { token: "{{protocol.protein}}", description: "Eiweiß je Tag" },
  { token: "{{protocol.priority}}", description: "Individueller Fokus" },
  { token: "{{practice.name}}", description: "Name der Praxis" },
];
