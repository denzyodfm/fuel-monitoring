import Link from "next/link";
import {db} from "@/lib/db";
import {requireSession} from "@/lib/auth";
import {brandingLogoUrl,getBranding} from "@/lib/branding";
import {PageHeading} from "@/components/page-heading";
import {ChangePasswordButton} from "@/components/change-password-button";
import {UserManagement} from "@/components/user-management";
import {saveBranding} from "./actions";

// Settings hosts four sections. "account" is available to every role because it carries
// Change password; the other three are administrator-only and are simply not offered.
type Tab="account"|"branding"|"users"|"audit";
const adminTabs:Tab[]=["branding","users","audit"];
const labels:Record<Tab,string>={account:"Account",branding:"Branding",users:"Users",audit:"Audit log"};

export default async function Page({searchParams}:{searchParams:Promise<{tab?:string;saved?:string;error?:string}>}){
  const [session,query]=await Promise.all([requireSession(),searchParams]);
  const isAdministrator=session.role==="ADMINISTRATOR";
  const available:Tab[]=isAdministrator?["account",...adminTabs]:["account"];
  const requested=(query.tab??"") as Tab;
  const tab:Tab=available.includes(requested)?requested:(isAdministrator?"branding":"account");
  const branding=tab==="branding"?await getBranding():null;
  const users=tab==="users"?await db.user.findMany({where:{organizationId:session.organizationId},orderBy:{name:"asc"}}):[];
  const events=tab==="audit"?await db.auditLog.findMany({include:{user:true},orderBy:{createdAt:"desc"},take:100}):[];

  return <>
    <PageHeading title="Settings" description={isAdministrator?"Your account, organization branding, users and the record of changes.":"Your account."}/>
    <nav className="settings-tabs no-print">
      {available.map(item=><Link key={item} href={`/settings?tab=${item}`} className={`settings-tab${item===tab?" is-active":""}`}>{labels[item]}</Link>)}
    </nav>

    {tab==="account"&&<div className="card grid gap-4 max-w-2xl">
      <div><h2 className="mb-1">Your account</h2><p className="text-sm text-slate-500 m-0">Signed in as {session.name} - {session.role.replaceAll("_"," ")}.</p></div>
      <div><ChangePasswordButton requiresCurrent={!isAdministrator}/></div>
      <p className="text-sm text-slate-500 m-0">Passwords must contain at least eight characters.{isAdministrator?"":" You will be asked for your existing password first."}</p>
    </div>}

    {tab==="branding"&&branding&&<>
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
    </>}

    {tab==="users"&&<UserManagement users={users.map(user=>({id:user.id,name:user.name,email:user.email,role:user.role,active:user.active,lastLogin:user.lastLoginAt?.toLocaleString("en-PH")??"Never",current:user.id===session.userId}))}/>}

    {tab==="audit"&&<>
      <div className="mb-4"><h2 className="text-xl font-bold m-0">Immutable audit log</h2><p className="text-slate-500 m-0">Authentication and material data changes. The 100 most recent events.</p></div>
      <div className="card desktop-table"><table className="table"><thead><tr>{["Timestamp","User","Action","Entity","ID","Origin"].map(header=><th key={header}>{header}</th>)}</tr></thead><tbody>{events.map(event=><tr key={event.id}><td>{event.createdAt.toLocaleString("en-PH")}</td><td>{event.user?.name??"System"}</td><td>{event.action}</td><td>{event.entityType}</td><td>{event.entityId??"—"}</td><td>{event.ipAddress??"—"}</td></tr>)}</tbody></table>{!events.length&&<p className="p-8 text-center text-slate-500">No recorded events yet.</p>}</div>
    </>}
  </>;
}
