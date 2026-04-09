import { ID, Timestamped } from "./common";

export interface CounselingSession extends Timestamped {
  id: ID;
  patientId: ID;
  date: string; // ISO date YYYY-MM-DD
  duration: number; // minutes
  type: string; // e.g. "Erstberatung", "Folgeberatung"
  indication: string;
  goals?: string;
  content: string; // session notes / documentation
  recommendations?: string;
  nextAppointment?: string; // ISO date YYYY-MM-DD
}

export interface CounselingTemplate {
  id: ID;
  name: string;
  type: string; // e.g. "Erstberatung", "Folgeberatung"
  indication: string;
  content: string;
}
