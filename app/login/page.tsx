import bcrypt from "bcryptjs";
import {redirect} from "next/navigation";
import {createSession,getSession} from "@/lib/auth";
import {BrandFooter} from "@/components/brand-footer";
import {getBranding} from "@/lib/branding";

async function login(formData:FormData){"use server";const email=String(formData.get("email")||"").toLowerCase(),password=String(formData.get("password")||"");if(process.env.LOCAL_PREVIEW_MODE==="true"&&email==="admin@fuel.local"&&password==="FuelAdmin2026!")redirect("/preview");const {db}=await import("@/lib/db");const user=await db.user.findUnique({where:{email}});if(!user||!user.active||!(await bcrypt.compare(password,user.passwordHash)))redirect("/login?error=Invalid+credentials");await db.auditLog.create({data:{userId:user.id,action:"LOGIN",entityType:"User",entityId:user.id}});await db.user.update({where:{id:user.id},data:{lastLoginAt:new Date()}});await createSession({userId:user.id,organizationId:user.organizationId,role:user.role,name:user.name});redirect("/dashboard")}

export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}){
  if(await getSession())redirect("/dashboard");
  const [branding,query]=await Promise.all([getBranding(),searchParams]);
  return <main className="login-shell">
    <section className="login-stage">
      <form action={login} className="login-card">
        <div className="login-brand"><img src="/brand/do-mark.png" alt="DO Plaza Holdings"/><div><span>DO PLAZA HOLDINGS</span><small>{branding.tagline}</small></div></div>
        <div className="login-title"><h1>{branding.systemName}</h1><p>Sign in to manage your operations securely.</p></div>
        {query.error&&<p className="login-error">{query.error}</p>}
        <label>Email<input className="field" name="email" type="email" required autoComplete="username"/></label>
        <label>Password<input className="field" name="password" type="password" required autoComplete="current-password"/></label>
        <button className="btn login-submit">Sign in</button>
      </form>
    </section>
    <BrandFooter className="login-footer"/>
  </main>
}
