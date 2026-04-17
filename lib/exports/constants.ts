import type { ExportFormat, ExportScope } from "@/lib/types";

export const SUPPORTED_EXPORTS: Record<ExportFormat, ExportScope[]> = {
  CSV: ["Lebensmittel", "Rezepte", "Patienten", "Ernährungspläne", "Berichte"],
  JSON: ["Lebensmittel", "Rezepte", "Patienten", "Ernährungspläne"],
  PDF: ["Patienten", "Berichte"],
};

export function isSupportedExport(format: ExportFormat, scope: string): scope is ExportScope {
  return SUPPORTED_EXPORTS[format].includes(scope as ExportScope);
}

