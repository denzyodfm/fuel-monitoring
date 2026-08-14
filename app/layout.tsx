import "./globals.css"; import type {Metadata} from "next";
export const metadata:Metadata={title:"Fuel Monitoring System",description:"Fuel operations, compliance and reporting"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
