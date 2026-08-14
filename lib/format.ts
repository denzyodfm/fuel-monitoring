export const php = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
export const liters = (value: number | string) => `${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
export const normalize = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
