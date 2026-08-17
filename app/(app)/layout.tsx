import Link from "next/link";
import {redirect} from "next/navigation";
import {clearSession,requireSession} from "@/lib/auth";
import {ChangePasswordButton} from "@/components/change-password-button";
import {BrandFooter} from "@/components/brand-footer";
import {getBranding} from "@/lib/branding";
import {BarChart3,Car,ClipboardList,FileSpreadsheet,LayoutDashboard,LogOut,Menu,Receipt,ShieldCheck,Users,WalletCards} from "lucide-react";

const standardLinks=[["/dashboard","Dashboard",LayoutDashboard],["/transactions","Transactions",Receipt],["/companies","Companies",ClipboardList],["/vehicles","Vehicles",Car],["/operators","Operators",Users],["/purposes","Purposes",Menu],["/insurance","Insurance",ShieldCheck],["/reports","Reports",BarChart3]] as const;
const administratorLinks=[["/imports","Excel imports",FileSpreadsheet],["/accounts-payable","Accounts payable",WalletCards],["/data-quality","Data quality",ShieldCheck],["/audit-log","Audit log",ClipboardList],["/users","Users",Users],["/settings","Settings",Menu]] as const;

export default async function AppLayout({children}:{children:React.ReactNode}){
  const [session,branding]=await Promise.all([requireSession(),getBranding()]),links=session.role==="ADMINISTRATOR"?[...standardLinks,...administratorLinks]:standardLinks;
  async function logout(){"use server";await clearSession();redirect("/login")}
  return <div className="min-h-screen flex brand-shell">
    <aside className="sidebar w-64 bg-slate-950 text-slate-300 p-4 fixed inset-y-0 overflow-y-auto">
      <div className="brand-lockup"><img src="/brand/do-mark.png" alt="DO Plaza Holdings"/><div><div className="font-bold text-white">{branding.systemShortName}</div><small>DO Plaza Holdings</small></div></div>
      <nav className="space-y-1">{links.map(([href,label,Icon])=><Link key={href} href={href} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800"><Icon size={17}/>{label}</Link>)}<ChangePasswordButton menu requiresCurrent={session.role!=="ADMINISTRATOR"}/></nav>
    </aside>
    <div className="flex-1 md:ml-64 brand-content">
      <header className="h-16 bg-white border-b flex items-center justify-between px-6 sticky top-0 z-10"><div className="header-brand"><img src="/brand/do-mark.png" alt=""/><div><strong>{branding.systemName}</strong><div className="text-xs text-slate-500">DO Plaza Holdings · Asia/Manila · Philippine Peso</div></div></div><div className="flex items-center gap-3"><span className="text-sm">{session.name} - {session.role.replaceAll("_"," ")}</span><form action={logout}><button title="Log out" className="btn secondary"><LogOut size={16}/></button></form></div></header>
      <main className="p-4 md:p-7 max-w-[1600px] mx-auto">{children}</main>
      <BrandFooter/>
    </div>
  </div>
}
