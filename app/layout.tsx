import type { Metadata } from "next";
export const metadata: Metadata = {title: "Fostinis Guitars — Showroom", description: "Explore Sphyx, Oryx and Matadaur. Design your Fostinis guitar and request a personal quote."};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {return <html lang="en"><body style={{margin:0,background:"#111315",color:"#f0ece4"}}>{children}</body></html>;}
