import { CalendarCheck, NotebookPen, UserRoundCheck } from "lucide-react";

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
export type ClientModuleId = "tagebuch" | "plan" | "betreuung";

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
