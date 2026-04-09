import { ID, Timestamped } from "./common";

export interface LabParameter {
  id: ID;
  name: string;
  shortName: string;
  unit: string;
  referenceMin: number;
  referenceMax: number;
  description?: string;
}

export interface LabValueEntry extends Timestamped {
  id: ID;
  patientId: ID;
  parameterId: ID;
  date: string; // ISO date YYYY-MM-DD
  value: number;
  notes?: string;
}
