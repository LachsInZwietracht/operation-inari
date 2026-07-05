// Excel evaluates cells starting with = + - @ (and tab/CR variants) as
// formulas — user-controlled content could exfiltrate data when the export is
// opened ("CSV injection"). Plain numbers (incl. German decimals like -5,2)
// cannot be formulas and must stay numeric, so they are exempt.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(?:[.,]\d+)?$/;

function neutralizeCell(value: string) {
  return FORMULA_TRIGGER.test(value) && !PLAIN_NUMBER.test(value) ? `'${value}` : value;
}

export function toCsv(rows: string[][]) {
  return rows
    .map((row) =>
      row.map((cell) => `"${neutralizeCell(String(cell ?? "")).replace(/"/g, '""')}"`).join(";"),
    )
    .join("\n");
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
  }
  return `${bytes} B`;
}

