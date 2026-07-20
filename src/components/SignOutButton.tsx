"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      aria-label="Sign out"
      className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:bg-surface-alt transition"
    >
      <LogOut size={15} />
    </button>
  );
}
