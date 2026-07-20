export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12 bg-bg">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-display italic text-3xl tracking-tight">Ledger</span>
          <p className="text-text-muted text-sm mt-1">Every day, accounted for.</p>
        </div>
        {children}
      </div>
    </main>
  );
}
