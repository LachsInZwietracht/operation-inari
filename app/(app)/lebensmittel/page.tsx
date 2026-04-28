import { LebensmittelPageClient } from "./lebensmittel-client";
import { fetchFoodsBrowserPage } from "@/lib/data/foods";

export const dynamic = "force-dynamic";

export default async function LebensmittelPage() {
  const initialResult = await fetchFoodsBrowserPage({ mode: "name", page: 1, pageSize: 25 });

  return <LebensmittelPageClient initialResult={initialResult} />;
}
