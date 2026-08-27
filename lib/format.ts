export const php = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
export const liters = (value: number | string) => `${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
export const normalize = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();

// Plate number and asset name are free-text fields that frequently hold the same
// value, so a naive join renders "GPOWER — GPOWER". Drop the asset name when it
// is missing or merely repeats the plate, and keep one separator across the app.
export const vehicleLabel = (plateNumber?: string | null, assetName?: string | null) => {
  const plate = (plateNumber ?? "").trim(), asset = (assetName ?? "").trim();
  if (!plate) return asset;
  if (!asset || normalize(asset) === normalize(plate)) return plate;
  return `${plate} — ${asset}`;
};
