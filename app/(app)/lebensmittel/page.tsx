import { LebensmittelPageClient } from "./lebensmittel-client";
import { fetchFoodsBrowserPage } from "@/lib/data/foods";

export default async function LebensmittelPage() {
  const [initialResult, initialBrandedResult] = await Promise.all([
    fetchFoodsBrowserPage({ mode: "name", page: 1, pageSize: 50 }),
    fetchFoodsBrowserPage({ mode: "browse", dataSourceId: "off", page: 1, pageSize: 12 }),
  ]);

  return (
    <LebensmittelPageClient
      initialResult={initialResult}
      initialBrandedResult={initialBrandedResult}
    />
  );
}
