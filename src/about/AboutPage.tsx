// About page (R50): how the plan is made — the solver, the model, its constraints and assumptions.
// Condensed from ADRs 0003, 0005, 0007, 0008 and 0009; keep it in step with src/plan/lp.ts.
import type { ReactNode } from 'react';
import { DEFAULT_PRIORITIES } from '../model/seed';
import { MIP_REL_GAP, SEGMENTS, TIME_LIMIT_S } from '../plan/lp';

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
const Code = ({ children }: { children: ReactNode }) => <code className="rounded bg-surface-2 px-1 py-0.5 text-[0.85em]">{children}</code>;

export function AboutPage() {
  const p = DEFAULT_PRIORITIES;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">How the plan is made</h2>
        <p className="mt-1 text-sm text-muted">
          The planner turns a yearly forecast per product into a weekly plan: which product runs on which machine, how much is stored where, and what is
          trucked between the sites. It does this with mathematical optimisation, entirely in your browser.
        </p>
      </header>

      <Section id="solver" title="The solver">
        <ul>
          <li>
            <Term>HiGHS</Term>, an open-source solver for linear and mixed-integer programs, compiled to WebAssembly. It runs in a Web Worker, so the page stays
            responsive. It is loaded only when the Plan page opens, and it needs no server, account or API key.
          </li>
          <li>
            The plan is a <Term>mixed-integer linear program (MILP)</Term>, a variant of the capacitated lot-sizing problem (CLSP), with parallel machines,
            line clear times and storage limits. The planner writes it as LP text and hands it to HiGHS.
          </li>
          <li>
            <Term>How HiGHS solves it:</Term> first the LP relaxation, with every yes/no decision allowed to be a fraction (dual simplex). Then
            branch-and-bound over the yes/no decisions, with cutting planes and primal heuristics. Along the way it bounds how far the best plan found can be
            from the optimum. That bound is the <Term>gap</Term> shown on the Plan page.
          </li>
        </ul>
        <p>
          HiGHS on its own found only poor plans within its time, so the planner <Term>warm-starts</Term> it in three steps (the progress line on the Plan page
          follows them):
        </p>
        <ol>
          <li>
            <Term>Relaxed plan and campaign cycles.</Term> The LP relaxation is solved first. A product that makes only a little each week on a machine may run
            there only every <i>k</i>-th week (at most 8), so it is made in campaigns worth their line clear. If that leaves demand unmet, the campaigns are
            shortened.
          </li>
          <li>
            <Term>Fixing the runs.</Term> The weeks the relaxed plan uses become fixed runs, and the LP is solved again until every run is whole. This is the
            start plan.
          </li>
          <li>
            <Term>Improving the plan.</Term> The full MILP starts from that plan. It stops within {Math.round(MIP_REL_GAP * 100)} % of the optimum, or after{' '}
            {TIME_LIMIT_S} s with the best plan found. If it finds nothing better, the start plan is kept.
          </li>
        </ol>
        <p className="text-muted">The optional extra solves of steps 1 and 2 stop at 40 % and 60 % of the time limit, so the plan comes back in seconds.</p>
      </Section>

      <Section id="model" title="The model">
        <p>
          The period is the <Term>ISO week</Term> (52 or 53 per planning year). For every week the model decides:
        </p>
        <ul>
          <li>
            <Term>machine hours</Term> per product and machine (only where the machine can make the product);
          </li>
          <li>
            <Term>whether a product runs</Term> on a machine that week (yes/no), and whether that run <Term>continues</Term> from the week before, so a
            campaign can span weeks;
          </li>
          <li>
            <Term>stock</Term> per product in each storage pool at the end of the week;
          </li>
          <li>
            <Term>units trucked</Term> per product on each truck lane;
          </li>
          <li>
            <Term>unmet demand</Term> per product, when capacity runs out.
          </li>
        </ul>
      </Section>

      <Section id="constraints" title="Constraints">
        <ul>
          <li>
            <Term>Machine time</Term> per week ≤ the available hours: the shift calendar, less site holidays and machine maintenance days.
          </li>
          <li>
            <Term>Line clears</Term> take machine time. Lots are at most one shift; each lot starts with a small line clear, and a campaign of a new product
            starts with a large one instead.
          </li>
          <li>
            <Term>Campaigns:</Term> only one product per machine can carry over from one week into the next. A product that runs through a whole week has the
            machine to itself that week. A week without machine time (e.g. holidays) ends a campaign.
          </li>
          <li>
            <Term>Max campaign length</Term> (Master data → Settings): a campaign's shifts, counted over the weeks it runs through, may not exceed the
            maximum. Past it, the machine gets a large line clear, and the same product may go on after it.
          </li>
          <li>
            <Term>Stock balance</Term> per product and storage pool: last week's stock + made or trucked in − trucked out − consumed = this week's stock.
            Initial stock is the stock at the start of week 1.
          </li>
          <li>
            <Term>Storage:</Term> each site's local store, and the demand site's inbound store, hold at most their capacity in pallets at the end of each week.
          </li>
          <li>
            <Term>Trucks:</Term> pallets per lane and week ≤ max trucks × pallets per truck. On lanes that don't run on weekends and holidays, the weekly maximum
            shrinks with the open weekdays at both ends.
          </li>
          <li>
            <Term>Demand</Term> at the demand site is met from its in-factory and inbound stores, or counted as unmet.
          </li>
          <li>
            <Term>Pre-SFGs:</Term> an SFG that uses a pre-SFG consumes one unit of it per unit made, in the same week, at the site that makes it.
          </li>
        </ul>
      </Section>

      <Section id="objective" title="What the plan aims for">
        <p>
          <Term>Meeting demand comes first.</Term> Unmet demand costs far more than any goal below. When demand can't all be met, it is shared out fairly:
          every product falls short by about the same share of its yearly demand. The worst share comes first. Then each of {SEGMENTS} slices of a product's
          share costs twice the last.
        </p>
        <p>
          Within that, the plan weighs four goals, each scaled to about 0–1. The weights are set on the Plan page (defaults in brackets):
        </p>
        <ul>
          <li>
            <Term>Balanced load</Term> ({p.balance}): keep the busiest machine's yearly utilisation low.
          </li>
          <li>
            <Term>Line clears</Term> ({p.lineClears}): least time lost to line clears, i.e. longer campaigns.
          </li>
          <li>
            <Term>Transport</Term> ({p.transport}): fewest pallets trucked between the sites.
          </li>
          <li>
            <Term>Spare capacity</Term> ({p.spare}): least machine time overall, so fast machines first.
          </li>
        </ul>
        <p className="text-muted">A small holding cost makes production happen just in time rather than early.</p>
      </Section>

      <Section id="assumptions" title="Assumptions and simplifications">
        <ul>
          <li>
            <Term>Weekly buckets.</Term> The order of products within a week is not planned. A shift-level timeline is a later step.
          </li>
          <li>
            <Term>Lots and pallets are continuous.</Term> Lot counts are machine hours ÷ hours per lot, and pallets may be fractional; only the trucks used are
            rounded up.
          </li>
          <li>
            <Term>No transit time.</Term> Goods trucked in a week arrive in the same week.
          </li>
          <li>
            <Term>Unmet demand is lost</Term>, not delivered late (no backlog).
          </li>
          <li>
            <Term>No target stock at year end</Term>: the plan may run stock down by the last week.
          </li>
          <li>
            <Term>Demand spread:</Term> a yearly total spreads over the weeks by the demand site's open days, except weeks with a value pinned on the Demand page.
          </li>
          <li>
            <Term>Fixed rates:</Term> output per hour × OEE, the same every week.
          </li>
          <li>
            <Term>Storage is pooled</Term> per site and kind. A product's stock may split over the locations in a pool in any way.
          </li>
          <li>
            <Term>Campaign length is counted per week:</Term> all of a product's shifts on a machine in a week count as one block. Forced clean-downs are
            counted continuously, like lots.
          </li>
          <li>
            <Term>Fair share is approximate</Term> outside the worst-hit group: products on other overloaded machines are levelled to within a slice or two.
          </li>
          <li>
            <Term>Best found, not always optimal.</Term> When the gap shows "not proven", a better plan may exist. The time limit keeps the planner interactive.
          </li>
        </ul>
      </Section>

      <Section id="why" title="Why optimisation, not machine learning or an AI agent">
        <ul>
          <li>
            <Term>Not machine learning:</Term> ML learns patterns from historical data, and there is none. Sharing out capacity under hard limits is what
            optimisation solvers are built for. They give a plan that provably respects every constraint, and it can be explained and reproduced. ML could
            later help with the inputs, such as forecasting demand or OEE.
          </li>
          <li>
            <Term>Not an AI agent:</Term> the engine is deterministic and needs no API key, server or running costs. A language model could later be an optional
            extra, e.g. to explain a plan or to try "what if B3 is down?".
          </li>
        </ul>
        <p className="text-muted">
          Design records: <Code>docs/decisions/</Code> ADRs 0003, 0005, 0007, 0008 and 0009.
        </p>
      </Section>
    </div>
  );
}
