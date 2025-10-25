// src/app/layout.js
import { Inter } from "next/font/google";
import Head from "next/head";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";  
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Fleetกกก Management",
  description: "ระบบจัดการรถในองค์กร",
  viewport: "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
