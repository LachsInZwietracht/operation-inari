import type { ApiEndpointDescription } from "@/lib/types";

export const API_ENDPOINT_PREVIEWS: ApiEndpointDescription[] = [
  {
    id: "foods",
    route: "/api/v1/foods",
    method: "GET",
    description: "Geplanter Listenendpunkt fuer katalogisierte Lebensmittel inklusive Filterparametern.",
    sampleResponse: {
      items: [{ id: "food_karotte", name: "Karotte", source: "bls" }],
      nextCursor: "cursor_2",
    },
  },
  {
    id: "recipes",
    route: "/api/v1/recipes",
    method: "GET",
    description: "Geplanter Endpunkt fuer Rezeptbibliothek und Metadaten.",
    sampleResponse: {
      items: [{ id: "recipe_123", name: "Mediterrane Bowl", servings: 2 }],
      total: 128,
    },
  },
];
