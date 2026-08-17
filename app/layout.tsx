import "./globals.css"; import type {Metadata} from "next";
import {getBranding} from "@/lib/branding";
export async function generateMetadata():Promise<Metadata>{const branding=await getBranding();return{title:branding.systemName,description:branding.tagline}}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
