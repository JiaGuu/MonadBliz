import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "证链 3D | Evidence Relay",
  description: "实体记录、三维浏览与档案交接核验",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
