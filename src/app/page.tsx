import Calculator from "@/components/Calculator";

export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-[#070b14] px-4 py-16 text-zinc-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.18),transparent_55%)]"
      />
      <div className="relative flex w-full max-w-sm flex-col gap-6">
        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Calculadora</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Básica y funcional, con atajos de teclado
          </p>
        </header>
        <Calculator />
      </div>
    </main>
  );
}
