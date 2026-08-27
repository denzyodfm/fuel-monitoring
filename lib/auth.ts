import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "development-only-secret-change-me-32chars");
// Only mark the session cookie Secure when the app is actually served over HTTPS.
// Tying this to NODE_ENV breaks plain-HTTP LAN deployments: browsers discard a
// Secure cookie from a non-secure origin (localhost excepted), so every navigation
// looks like a logout. Set COOKIE_SECURE=true once HTTPS terminates in front.
const secureCookie = process.env.COOKIE_SECURE === "true";
export type Session = { userId: string; organizationId: string; role: Role; name: string };
export async function createSession(session: Session) { const token = await new SignJWT(session).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("8h").sign(secret()); (await cookies()).set("fuel_session", token, {httpOnly:true,sameSite:"lax",secure:secureCookie,path:"/",maxAge:28800}); }
export async function getSession(): Promise<Session|null> { const token=(await cookies()).get("fuel_session")?.value; if(!token)return null; try{const session=(await jwtVerify(token,secret())).payload as unknown as Session;return (session.role as string)==="ENCODER"?{...session,role:"STAFF"}:session}catch{return null} }
export async function requireSession(roles?: Role[]) { const session=await getSession(); if(!session)redirect("/login"); if(roles&&!roles.includes(session.role))redirect("/dashboard?error=forbidden"); return session; }
export async function clearSession(){(await cookies()).delete("fuel_session")}
