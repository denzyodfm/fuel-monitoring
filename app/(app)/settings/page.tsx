import {requireSession} from "@/lib/auth";
import {brandingLogoUrl,getBranding} from "@/lib/branding";
import {PageHeading} from "@/components/page-heading";
import {saveBranding} from "./actions";
export default async function Page({searchParams}:{searchParams:Promise<{saved?:string;error?:string}>}){
  await requireSession(["ADMINISTRATOR"]);
  const [branding,query]=await Promise.all([getBranding(),searchParams]);
  return <><PageHeading title="Settings" description="Organization-wide application behavior and branding."/>
    {query.saved&&<p className="form-success mb-4">Branding saved successfully.</p>}
    {query.error&&<p className="form-error mb-4">{query.error}</p>}
    <form action={saveBranding} className="grid xl:grid-cols-2 gap-6 items-start">
      <div className="card grid gap-4">
        <div><h2 className="mb-1">System identity</h2><p className="text-sm text-slate-500 m-0">The application name shown on the login page, browser tab, sidebar and header.</p></div>
        <label>System name<input className="field" name="systemName" defaultValue={branding.systemName} maxLength={80} required placeholder="Fuel Monitoring System"/></label>
        <label>Short name (sidebar)<input className="field" name="systemShortName" defaultValue={branding.systemShortName} maxLength={80} required placeholder="Fuel Monitoring"/></label>
        <label>Tagline<input className="field" name="tagline" defaultValue={branding.tagline} maxLength={80} required placeholder="Fuel operations management"/></label>
      </div>
      <div className="card grid gap-4">
        <div><h2 className="mb-1">Footer branding</h2><p className="text-sm text-slate-500 m-0">The provider row shown under the copyright line on the login page and in the application footer.</p></div>
        <label>Powered by label<input className="field" name="poweredBy" defaultValue={branding.poweredBy} maxLength={80} required/></label>
        <label>Provider / company<input className="field" name="provider" defaultValue={branding.provider} maxLength={80} required/></label>
        <div className="logo-setting">
          <div className="logo-preview">{branding.providerLogoKey?<img src={brandingLogoUrl(branding.providerLogoKey)} alt="Current provider logo"/>:<span className="valdemar-mark">{branding.providerMark}</span>}</div>
          <div className="grid gap-3 grow">
            <label>Provider logo<input className="field" name="providerLogo" type="file" accept="image/png,image/jpeg,image/webp"/><small className="text-slate-500">PNG, JPG or WebP up to 2 MB. Leave empty to keep the current logo.</small></label>
            <label>Letter mark (used when no logo is uploaded)<input className="field" name="providerMark" defaultValue={branding.providerMark} maxLength={4} required/></label>
            {branding.providerLogoKey&&<label className="check-field"><input type="checkbox" name="removeProviderLogo"/> Remove the uploaded logo and use the letter mark</label>}
          </div>
        </div>
        <label>Team label<input className="field" name="team" defaultValue={branding.team} maxLength={80} required/></label>
      </div>
      <div className="card grid gap-4">
        <h2>Application defaults</h2>
        <label>Application timezone<input className="field" value="Asia/Manila" readOnly/></label>
        <label>Currency<input className="field" value="PHP - Philippine Peso" readOnly/></label>
        <label>Upload storage<input className="field" value="Local filesystem abstraction (UPLOAD_DIR)" readOnly/></label>
      </div>
      <div className="xl:col-span-2"><button className="btn">Save branding</button></div>
    </form>
  </>;
}
