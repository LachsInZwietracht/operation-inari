const deDE = "de-DE";

/**
 * Formats a number in German locale (e.g. 1.234,5)
 */
export function formatNumber(value: number, decimals?: number): string {
  return new Intl.NumberFormat(deDE, {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 1,
  }).format(value);
}

/**
 * Formats a nutrient value with its unit (e.g. "123,4 mg")
 */
export function formatNutrient(value: number, unit: string): string {
  const decimals = value < 1 ? 2 : value < 10 ? 1 : 0;
  return `${formatNumber(value, decimals)} ${unit}`;
}

/**
 * Formats a percentage value (e.g. "85,3 %")
 */
export function formatPercent(value: number): string {
  return `${formatNumber(value, 1)} %`;
}

/**
 * Formats a date string or Date object to German format dd.MM.yyyy
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(deDE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}
