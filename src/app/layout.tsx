import type { Metadata } from "next";
import AuthProvider from "@/components/AuthProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "CreateAnySite - 创建任意网站",
  description: "AI 驱动的建站平台。上传内容，选择模板，一键生成并上线你的网站。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <AuthProvider>
          <LocaleProvider>{children}</LocaleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
