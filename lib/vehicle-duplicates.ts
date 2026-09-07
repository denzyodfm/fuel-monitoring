// The fleet register was built up from spreadsheets, so the same physical vehicle can appear
// several times under different spellings ("HILUX ZAF 7862" and "TOYOTA HILUX J - ZAF - 7862
// (PADD)"). Pulling the plate token out of the free text finds most of those pairs.
//
// This only ever *suggests*. Some duplicates share no plate at all -- a vehicle that was
// re-plated appears as "TAMARAW EB-262B" and "ZAF-7437" -- so the final say is always a
// person's, through the manual picker.
export function plateKeys(text:string):string[]{
  const cleaned=text.toUpperCase().replace(/[^A-Z0-9]+/g," ");
  const keys=new Set<string>();
  for(const match of cleaned.matchAll(/\b([A-Z]{2,3})\s?(\d{3,4})\b/g))keys.add(`${match[1]}${match[2]}`);
  for(const match of cleaned.matchAll(/\b(\d{3,4})\s?([A-Z]{2,3})\b/g))keys.add(`${match[2]}${match[1]}`);
  return [...keys];
}

export type Suggestion={key:string;vehicleIds:string[]};

export function suggestDuplicates(vehicles:{id:string;plateNumber:string;assetName:string|null}[]):Suggestion[]{
  const byKey=new Map<string,string[]>();
  for(const vehicle of vehicles)
    for(const key of plateKeys(`${vehicle.plateNumber} ${vehicle.assetName??""}`))
      byKey.set(key,[...(byKey.get(key)??[]),vehicle.id]);
  return [...byKey.entries()]
    .filter(([,ids])=>ids.length>1)
    .map(([key,vehicleIds])=>({key,vehicleIds}))
    .sort((a,b)=>a.key.localeCompare(b.key));
}
