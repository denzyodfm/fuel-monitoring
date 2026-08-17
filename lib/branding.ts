import {cache} from "react";
import {db} from "@/lib/db";
export type Branding={systemName:string;systemShortName:string;tagline:string;poweredBy:string;provider:string;providerMark:string;providerLogoKey:string|null;team:string};
export const BRANDING_KEY="app.branding";
export const defaultBranding:Branding={systemName:"Fuel Monitoring System",systemShortName:"Fuel Monitoring",tagline:"Fuel operations management",poweredBy:"Powered by",provider:"VALDEMAR RESOURCES, INC",providerMark:"V",providerLogoKey:null,team:"IT TEAM - KAMARU"};
const text=(value:unknown,fallback:string,max=80)=>typeof value==="string"&&value.trim()?value.trim().slice(0,max):fallback;
export const getBranding=cache(async():Promise<Branding>=>{
  const rows=await db.appSetting.findMany({where:{key:{in:["footer.branding",BRANDING_KEY]}}});
  const stored=Object.assign({},...["footer.branding",BRANDING_KEY].map(key=>{const row=rows.find(item=>item.key===key);return row&&typeof row.value==="object"&&row.value!==null&&!Array.isArray(row.value)?row.value:{}})) as Record<string,unknown>;
  return {systemName:text(stored.systemName,defaultBranding.systemName),systemShortName:text(stored.systemShortName,defaultBranding.systemShortName),tagline:text(stored.tagline,defaultBranding.tagline),poweredBy:text(stored.poweredBy,defaultBranding.poweredBy),provider:text(stored.provider,defaultBranding.provider),providerMark:text(stored.providerMark,defaultBranding.providerMark,4),providerLogoKey:typeof stored.providerLogoKey==="string"&&stored.providerLogoKey?stored.providerLogoKey:null,team:text(stored.team,defaultBranding.team)};
});
export const brandingLogoUrl=(key:string)=>`/api/branding/${key}`;
