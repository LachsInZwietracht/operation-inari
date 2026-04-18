import type { PracticeAppointment, InvoiceEntry } from "@/lib/types";

export const PRACTICE_APPOINTMENTS: PracticeAppointment[] = [
  {
    id: "appt_1",
    title: "Erstberatung Maria Schneider",
    date: "2026-03-14",
    startTime: "09:00",
    endTime: "10:00",
    patientId: "patient_1",
    type: "beratung",
    location: "Raum 2",
    reminder: "24h",
  },
  {
    id: "appt_2",
    title: "Team Jour Fixe",
    date: "2026-03-14",
    startTime: "12:00",
    endTime: "13:00",
    type: "team",
    location: "Hybrid",
    recurring: "wöchentlich",
  },
  {
    id: "appt_3",
    title: "Follow-up Thomas Weber",
    date: "2026-03-15",
    startTime: "15:00",
    endTime: "15:45",
    patientId: "patient_2",
    type: "kontrolle",
    location: "Video",
  },
];

export const PRACTICE_INVOICES: InvoiceEntry[] = [
  {
    id: "inv_1001",
    patientId: "patient_1",
    service: "Ernährungscoaching Paket",
    amount: 360,
    status: "offen",
    dueDate: "2026-03-31",
    insurance: "AOK Bayern",
  },
  {
    id: "inv_1002",
    patientId: "patient_2",
    service: "Diabetes-Schulung",
    amount: 180,
    status: "bezahlt",
    dueDate: "2026-02-15",
    insurance: "TK",
  },
  {
    id: "inv_1003",
    patientId: "patient_3",
    service: "Allergieberatung",
    amount: 210,
    status: "mahnung",
    dueDate: "2026-02-05",
    insurance: "Barmer",
  },
];