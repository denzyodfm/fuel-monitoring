"use server";
import {mkdir,unlink,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {requireSession} from "@/lib/auth";
import {db} from "@/lib/db";
import {BRANDING_KEY,getBranding} from "@/lib/branding";
import {allowedLogoTypes,brandingDir,isBrandingKey,maxLogoBytes} from "@/lib/branding-storage";

const fail=(message:string):never=>redirect(`/settings?error=${encodeURIComponent(message)}`);
const discard=async(key:string|null)=>{if(key&&isBrandingKey(key))await unlink(resolve(brandingDir(),key)).catch(()=>{})};

export async function saveBranding(formData:FormData){
  const session=await requireSession(["ADMINISTRATOR"]);
  const current=await getBranding();
  const field=(name:string,max=80)=>String(formData.get(name)??"").trim().slice(0,max);
  const systemName=field("systemName"),systemShortName=field("systemShortName"),tagline=field("tagline");
  const poweredBy=field("poweredBy"),provider=field("provider"),providerMark=field("providerMark",4),team=field("team");
  if(!systemName||!systemShortName||!tagline||!poweredBy||!provider||!providerMark||!team)fail("Every branding label is required and must be 80 characters or less.");

  let providerLogoKey=current.providerLogoKey;
  if(formData.get("removeProviderLogo")==="on"){await discard(providerLogoKey);providerLogoKey=null}
  const upload=formData.get("providerLogo");
  if(upload instanceof File&&upload.size>0){
    const extension=allowedLogoTypes[upload.type];
    if(!extension)fail("The powered-by logo must be a PNG, JPG or WebP image.");
    if(upload.size>maxLogoBytes)fail("The powered-by logo must be 2 MB or smaller.");
    const key=`provider-${Date.now()}.${extension}`;
    await mkdir(brandingDir(),{recursive:true});
    await writeFile(resolve(brandingDir(),key),Buffer.from(await upload.arrayBuffer()));
    await discard(providerLogoKey);
    providerLogoKey=key;
  }

  const value={systemName,systemShortName,tagline,poweredBy,provider,providerMark,providerLogoKey,team};
  await db.$transaction([
    db.appSetting.upsert({where:{key:BRANDING_KEY},update:{value},create:{key:BRANDING_KEY,value}}),
    db.auditLog.create({data:{userId:session.userId,action:"UPDATE_SETTINGS",entityType:"AppSetting",entityId:BRANDING_KEY,beforeValue:{...current},afterValue:value}})
  ]);
  revalidatePath("/","layout");
  redirect("/settings?saved=1");
}
