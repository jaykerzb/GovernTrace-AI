import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { Sidebar } from "./Sidebar";

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (!user) return <>{children}</>;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 print:h-auto print:overflow-visible print:block">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-y-auto print:overflow-visible">
        <div className="mx-auto max-w-6xl px-6 py-8 print:max-w-none print:p-0">{children}</div>
      </main>
    </div>
  );
}
