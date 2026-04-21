import { ID, Timestamped } from "./common";

export type CounselingTimelineStatus = "done" | "active" | "upcoming";

export interface CounselingTimelineEntry {
  id: ID;
  date: string;
  title: string;
  description?: string;
  status: CounselingTimelineStatus;
}

export type CounselingMaterialStatus = "pending" | "shared" | "viewed";

export interface CounselingMaterial {
  id: ID;
  title: string;
  type: string;
  url?: string;
  status: CounselingMaterialStatus;
  notes?: string;
}

export interface CounselingProgressMetric {
  id: ID;
  label: string;
  value: number;
  target: number;
  unit: string;
  trend?: "up" | "down" | "steady";
}

export interface CounselingSession extends Timestamped {
  id: ID;
  legacyId?: ID;
  patientId: ID;
  date: string; // ISO date YYYY-MM-DD
  duration: number; // minutes
  type: string; // e.g. "Erstberatung", "Folgeberatung"
  indication: string;
  goals?: string;
  content: string; // session notes / documentation
  recommendations?: string;
  nextAppointment?: string; // ISO date YYYY-MM-DD
  timeline?: CounselingTimelineEntry[];
  materials?: CounselingMaterial[];
  progress?: CounselingProgressMetric[];
}

export interface CounselingTemplate {
  id: ID;
  legacyId?: ID;
  name: string;
  type: string; // e.g. "Erstberatung", "Folgeberatung"
  indication: string;
  content: string;
}
