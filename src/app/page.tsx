import { GOAL_LABEL, ORIGIN_LABEL, generatePlan } from "@/engine";
import { VELO_TO_10K } from "@/engine/fixtures";
import { WeekCard } from "@/components/WeekCard";

const plan = generatePlan(VELO_TO_10K);

export default function Home() {
  const p = plan.profile;
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <section className="mb-12">
        <p className="mb-4 font-mono text-xs tracking-[0.3em] text-target">BIENTÔT DISPONIBLE</p>
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
          Trans
          <span className="bg-gradient-to-r from-origin to-target bg-clip-text text-transparent">
            io
          </span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          Change de sport, garde tes acquis. Le plan d&apos;entraînement qui part de ton ancien
          sport, avance progressivement et s&apos;ajuste chaque semaine.
        </p>
      </section>

      <section>
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-bold">Plan d&apos;exemple</h2>
          <p className="text-sm text-muted">
            {ORIGIN_LABEL[p.originSport]} → course · {GOAL_LABEL[p.goal]} · {p.weeks} semaines
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plan.weeks.map((w) => (
            <WeekCard key={w.index} week={w} originLabel={ORIGIN_LABEL[p.originSport]} />
          ))}
        </div>
      </section>
    </main>
  );
}
