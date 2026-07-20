import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import ThemeToggle from "@/components/ThemeToggle";
import SyncIndicator from "@/components/SyncIndicator";
import SignOutButton from "@/components/SignOutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex flex-1 min-h-screen">
      <Nav />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="text-sm text-text-muted">Welcome back,</p>
            <p className="font-medium">{session.user.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <SyncIndicator />
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 px-5 py-6 pb-24 md:pb-6 max-w-4xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
