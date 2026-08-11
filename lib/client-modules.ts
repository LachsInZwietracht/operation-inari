import { CalendarCheck, ChartColumn, Dumbbell, NotebookPen, UserRoundCheck } from "lucide-react";

/**
 * Registry of the client surface.
 *
 * Every module owns exactly five things and shares none of them:
 *
 *   app/(client)/klient/<id>/            route
 *   components/client/<id>/              UI
 *   lib/data/client-<id>-client.ts       data access
 *   supabase/migrations/..._client_<id>  schema
 *   tests/client-<id>*.spec.ts           test
 *
 * Modules never import from each other; anything shared lives in a module of
 * its own (`lib/client-food-log.ts`). That is what makes removal a mechanical
 * operation: flip `enabled` to hide a module, or delete those five paths plus
 * the entry below to drop it for good. `rg <id>` then finds nothing.
 */
export type ClientModuleId = "tagebuch" | "plan" | "training" | "statistik" | "betreuung";

export interface ClientModule {
  id: ClientModuleId;
  label: string;
  route: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  enabled: boolean;
  /** Contributes a section to the counselor's "Klienten-App" patient tab. */
  counselorSection: boolean;
}

export const CLIENT_MODULES: ClientModule[] = [
  {
    // One-way, guarded exception to "modules never import each other": the
    // diary draws the day's planned meals in and counts the ones ticked off,
    // because plan and diary describe the same day and splitting them made a
    // perfectly adherent client look like they had eaten nothing. Every read
    // sits behind `isClientModuleEnabled("plan")`, so switching the plan off
    // removes the planned rows instead of breaking the diary. Nothing flows
    // back the other way.
    id: "tagebuch",
    label: "Tagebuch",
    route: "/klient",
    icon: NotebookPen,
    enabled: true,
    counselorSection: true,
  },
  {
    id: "plan",
    label: "Plan",
    route: "/klient/plan",
    icon: CalendarCheck,
    enabled: true,
    counselorSection: true,
  },
  {
    // One caveat for the delete-the-five-paths rule: the energy estimate reads
    // `lib/energy-expenditure.ts`, which the counselor's activity form uses too.
    // Removing this module leaves that file in place.
    id: "training",
    label: "Training",
    route: "/klient/training",
    icon: Dumbbell,
    enabled: true,
    counselorSection: true,
  },
  {
    // The one module that reads the others instead of owning data. It has no
    // migration because it stores nothing, and each of its sections is guarded
    // by `isClientModuleEnabled`, so the dependency runs one way only:
    // switching a module off removes a section here rather than breaking it.
    id: "statistik",
    label: "Verlauf",
    route: "/klient/statistik",
    icon: ChartColumn,
    enabled: true,
    counselorSection: false,
  },
  {
    // Not a feature module: this is where the link to a counselor is made and
    // revoked. Disabling it would strand clients with no way to connect.
    id: "betreuung",
    label: "Betreuung",
    route: "/klient/betreuung",
    icon: UserRoundCheck,
    enabled: true,
    counselorSection: false,
  },
];

export const ENABLED_CLIENT_MODULES = CLIENT_MODULES.filter((module) => module.enabled);

export function isClientModuleEnabled(id: ClientModuleId): boolean {
  return CLIENT_MODULES.some((module) => module.id === id && module.enabled);
}

/**
 * Capabilities extend a module instead of being one.
 *
 * Barcode scanning is a way to fill the diary, not a place to navigate to —
 * giving it a registry entry would mean inventing a route and a nav item that
 * do not exist. It gets its own switch anyway, because it is the one part of
 * the diary that depends on an external service and a camera permission, and
 * that is exactly the kind of thing you want to be able to turn off on its own.
 *
 * Owned paths, same discipline as a module:
 *
 *   lib/barcode.ts                        GTIN rules and the lookup contract
 *   lib/off-product.ts                    OFF parsing (shared with the ETL)
 *   lib/data/barcode-client.ts            data access
 *   app/api/foods/barcode/[code]/         lookup endpoint
 *   components/client/client-barcode-*    UI
 *   tests/client-barcode*.spec.ts         tests
 */
export type ClientCapabilityId = "barcode";

const CLIENT_CAPABILITIES: Record<ClientCapabilityId, boolean> = {
  barcode: true,
};

export function isClientCapabilityEnabled(id: ClientCapabilityId): boolean {
  return CLIENT_CAPABILITIES[id];
}
