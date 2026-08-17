import {resolve} from "node:path";
export const brandingDir=()=>resolve(process.cwd(),process.env.UPLOAD_DIR??"./uploads","branding");
export const allowedLogoTypes:Record<string,string>={"image/png":"png","image/jpeg":"jpg","image/webp":"webp"};
export const maxLogoBytes=2*1024*1024;
export const isBrandingKey=(key:string)=>/^[a-z0-9][a-z0-9-]{0,63}\.(png|jpg|webp)$/.test(key);
export const contentTypeFor=(key:string)=>key.endsWith(".png")?"image/png":key.endsWith(".webp")?"image/webp":"image/jpeg";
