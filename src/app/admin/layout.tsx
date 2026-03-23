"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string } | undefined)?.role;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && role !== "admin") {
      router.push("/dashboard");
    }
  }, [status, role, router]);

  if (status === "loading") return null;
  if (!session?.user || role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/30 text-sm">Access denied</p>
      </div>
    );
  }

  return <>{children}</>;
}
