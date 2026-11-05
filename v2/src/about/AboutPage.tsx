// About page (v2, R90): how the rolling simulation and the replanner work.
// Condensed from ADR 0013 and requirements R70–R89; keep it in step with the simulation core.
import type { ReactNode } from 'react';

const CARD = 'rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className={CARD} data-testid={`about-${id}`} aria-labelledby={`about-${id}-title`}>
      <h3 id={`about-${id}-title`} className="mb-3 font-semibold tracking-tight">
        {title}
      </h3>
      <div className="space-y-3 text-sm leading-relaxed [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
    </section>
  );
}

const Term = ({ children }: { children: ReactNode }) => <span className="font-medium">{children}</span>;

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <li className="flex items-center gap-2 !list-none">
      <span aria-hidden className={`inline-block h-4 w-8 rounded ${className}`} />
      {label}
    </li>
  );
}

export function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">How the planner works</h2>
        <p className="mt-1 text-sm text-muted">
          The planner keeps the stock of every product in one factory between a <Term>minimum</Term> and a <Term>maximum</Term>. It simulates time one shift
          at a time. At each step it updates the stock, looks three days ahead and corrects the schedule with as few changes as possible. Everything runs in
          your browser.
        </p>
      </header>

      <Section id="loop" title="One step, in order">
        <ol>
          <li>
            <Term>Update stock:</Term> stock = previous stock + what each machine made in the shift that just ended − what was used.
          </li>
          <li>
            <Term>Roll the window:</Term> the finished shift drops off and an empty shift is added at the end. The window is always the next 9 shifts
            (3 days).
          </li>
          <li>
            <Term>Project:</Term> from the scheduled runs and the expected usage, work out each product's stock in each shift of the window. Then find its first
            shift below min or above max (a <Term>breach</Term>).
          </li>
          <li>
            <Term>Replan:</Term> fix the breaches with as few changes as possible (see below).
          </li>
          <li>
            <Term>Show:</Term> the timeline, the stock, the changes with their reasons, and any breaches that couldn't be fixed.
          </li>
        </ol>
      </Section>

      <Section id="model" title="The model">
        <ul>
          <li>
            <Term>A run</Term> is one machine making one product for one whole shift. A shift holds one run or none, so a run is all-or-nothing. Output =
            rate × OEE × (shift length − line clear). The clear is <Term>large</Term> when the product differs from the machine's previous shift, and{' '}
            <Term>small</Term> when it's the same.
          </li>
          <li>
            In planning terms, this is a <Term>small-bucket lot-sizing and scheduling problem</Term>, closest to the discrete lot-sizing and scheduling
            problem (DLSP) on parallel machines with setup carry-over. Each bucket is one shift with at most one product, and the order of runs matters
            because of the clears.
          </li>
          <li>
            The loop around it is <Term>model predictive control</Term> (rolling-horizon rescheduling): measure the state, predict over a horizon, optimise
            the corrections, carry out the first shift, step forward and repeat. Keeping changes few limits <Term>plan nervousness</Term>.
          </li>
          <li>
            Each product's min/max band works like an <Term>(s, S) stock policy</Term>. The replanner enforces it, not a reorder rule.
          </li>
        </ul>
      </Section>

      <Section id="replanner" title="The replanner">
        <ul>
          <li>
            <Term>Frozen:</Term> the next shift is about to run and is never changed.
          </li>
          <li>
            <Term>Order:</Term> the product that breaches soonest goes first; ties go to the deepest shortfall.
          </li>
          <li>
            <Term>Below min:</Term> add a run in an empty shift, or else move a run, or else swap a run's product. It adds just enough to stay at or above
            min across the window.
          </li>
          <li>
            <Term>Above max:</Term> move the run later (or out of the window), or else swap it to a product that needs it, or else cancel it.
          </li>
          <li>
            A change is kept only if it creates no new or earlier breach for another product. If nothing works, the breach is listed as{' '}
            <Term>unfixable</Term>.
          </li>
          <li>
            It is a <Term>greedy heuristic</Term>: fast, deterministic, and each change comes with a one-line reason. The problem per step is small, so an
            exact solver (a MILP that minimises breaches, then weighted changes, then clears) can be plugged in later to compare.
          </li>
        </ul>
      </Section>

      <Section id="timeline" title="Reading the timeline">
        <ul>
          <Swatch className="bg-green-500/80" label="Planned and unchanged" />
          <Swatch className="bg-yellow-400/90" label="Newly planned this step" />
          <Swatch className="bg-red-500/80" label="Replanned this step (moved or swapped)" />
          <Swatch className="border-2 border-dashed border-red-500" label="Cancelled this step" />
        </ul>
        <p>Colours reset at every step.</p>
      </Section>

      <Section id="assumptions" title="Assumptions">
        <ul>
          <li>One factory: no sites, transport or storage locations. Stock, min, max and usage are in units.</li>
          <li>Shifts of 8 h, 3 per day, 7 days a week. One step is one shift.</li>
          <li>Machines make exactly what was planned: no breakdowns or scrap.</li>
          <li>Usage per shift is a constant per product for now. Seeded random variation (±%) and replaying usage from a file are planned.</li>
        </ul>
      </Section>
    </div>
  );
}
