export default function Home() {
  return (
    <main className="space-y-4">
      <div className="p-4 rounded-xl border bg-white">
        <span className="inline-block bg-brand-danger text-white px-3 py-1 rounded-pill">NEAKTIVNÍ</span>
        <p className="mt-2 text-sm">Platnost do: —</p>
      </div>
    </main>
  );
}