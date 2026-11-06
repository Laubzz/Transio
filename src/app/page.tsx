import { HomeCta } from "@/components/HomeCta";

const FEATURES = [
  {
    title: "Un plan qui part de ton ancien sport",
    text: "Ton passé sportif, ton volume et tes blessures donnent un point de départ différent.",
  },
  {
    title: "Des garde-fous pour la transition",
    text: "Hausse de course plafonnée, semaines allégées, course-marche au début : les tendons suivent.",
  },
  {
    title: "Ajusté chaque semaine",
    text: "Tu notes tes séances en quelques secondes, le bilan adapte la suite du plan.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      <p className="mb-4 font-mono text-xs tracking-[0.3em] text-target">VERSION BÊTA</p>
      <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">
        Trans
        <span className="bg-gradient-to-r from-origin to-target bg-clip-text text-transparent">
          io
        </span>
      </h1>
      <p className="mt-5 max-w-xl text-xl text-muted">
        Change de sport, garde tes acquis. Le coach de transition pour passer du vélo à la course à
        pied sans brûler les étapes.
      </p>
      <div className="mt-8">
        <HomeCta />
      </div>

      <ul className="mt-16 grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <li key={f.title} className="rounded-2xl border border-white/10 bg-card p-5">
            <h2 className="font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm text-muted">{f.text}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
