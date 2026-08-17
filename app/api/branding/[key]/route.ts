import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {brandingDir,contentTypeFor,isBrandingKey} from "@/lib/branding-storage";
export async function GET(_request:Request,{params}:{params:Promise<{key:string}>}){
  const {key}=await params;
  if(!isBrandingKey(key))return new Response("Not found",{status:404});
  try{const file=await readFile(resolve(brandingDir(),key));return new Response(new Uint8Array(file),{headers:{"content-type":contentTypeFor(key),"cache-control":"public, max-age=31536000, immutable"}})}
  catch{return new Response("Not found",{status:404})}
}
