import { LebensmittelVergleichPageClient } from "./lebensmittel-vergleichen-client";
import { fetchBrandedFoods } from "@/lib/data/foods";

export default async function LebensmittelVergleichPage() {
  const brandedFoods = await fetchBrandedFoods();

  return (
    <LebensmittelVergleichPageClient brandedFoods={brandedFoods} />
  );
}
