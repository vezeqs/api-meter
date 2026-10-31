import Link from "next/link";
import { APP_NAME, APP_TAGLINE, findPlan, PLANS } from "@production/shared";
import { QuotaMeter } from "@/components/quota-meter";
import { Sparkline } from "@/components/sparkline";
import { getBillingCycle, getUsageSummary } from "@/lib/data";
import { formatCompact, formatDayRange, formatQuotaLabels, formatUsd } from "@/lib/format";
import styles from "./landing.module.css";

const billing = getBillingCycle();
const summary = getUsageSummary("30d");
const plan = findPlan(billing.planId);

const TRACKED = [
  {
    index: "01",
    title: "Request volume",
    body: "Every call, per endpoint, per day. p95 latency and error rate sit beside each row so a spike is never just a bigger number.",
  },
  {
    index: "02",
    title: "Quota",
    body: "How much of the cycle is already spent, before it is spent. The bar turns at ninety percent, not after the invoice.",
  },
  {
    index: "03",
    title: "Spend",
    body: `Metered at ${formatUsd(plan?.overagePerMillionUsd ?? 0, 0)} per million requests beyond the included allowance. No rounding in the provider's favour.`,
  },
] as const;

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Link href="/" className={styles.wordmark}>
          <span className={styles.mark} aria-hidden="true" />
          {APP_NAME}
        </Link>
        <nav aria-label="Primary">
          <Link href="/dashboard" className={styles.navLink}>
            Open dashboard
          </Link>
        </nav>
      </header>

      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={`label ${styles.eyebrow}`}>{APP_TAGLINE}</p>
            <h1 id="hero-title" className={styles.title}>
              Know what your API costs before the invoice does.
            </h1>
            <p className={styles.lede}>
              {APP_NAME} reads your request logs and turns them into quota, error rate, and spend —
              per endpoint, per day, per customer. The numbers are the whole product.
            </p>
            <div className={styles.actions}>
              <Link href="/dashboard" className={styles.primary}>
                Open the dashboard
              </Link>
              <Link href="/dashboard/keys" className={styles.secondary}>
                Manage API keys
              </Link>
            </div>
          </div>

          <div className={styles.specimen} aria-label="Sample of the current billing cycle">
            <div className={styles.specimenHead}>
              <span className="label">Current cycle</span>
              <span className={`num ${styles.specimenMeta}`}>
                {formatDayRange(billing.startDate, billing.endDate)}
              </span>
            </div>

            <div className={styles.meters}>
              {billing.quotas.map((quota) => {
                const labels = formatQuotaLabels(quota);
                return (
                  <QuotaMeter
                    key={quota.id}
                    label={quota.label}
                    used={quota.used}
                    limit={quota.limit}
                    usedLabel={labels.used}
                    limitLabel={labels.limit}
                  />
                );
              })}
            </div>

            <div className={styles.specimenFoot}>
              <div>
                <span className="label">Requests / day</span>
                <p className={`num ${styles.specimenValue}`}>
                  {formatCompact(billing.requests / billing.days)}
                </p>
              </div>
              <div>
                <span className="label">Overage</span>
                <p className={`num ${styles.specimenValue}`}>{formatUsd(billing.overageUsd)}</p>
              </div>
              <Sparkline
                values={summary.daily.map((entry) => entry.requests)}
                width={160}
                height={36}
                className={styles.specimenSpark}
              />
            </div>
          </div>
        </section>

        <section className={styles.tracked} aria-labelledby="tracked-title">
          <h2 id="tracked-title" className={`label ${styles.sectionLabel}`}>
            What it tracks
          </h2>
          <ol className={styles.trackedGrid}>
            {TRACKED.map((item) => (
              <li key={item.index} className={styles.trackedItem}>
                <span className={`num ${styles.trackedIndex}`}>{item.index}</span>
                <h3 className={styles.trackedTitle}>{item.title}</h3>
                <p className={styles.trackedBody}>{item.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.pricing} aria-labelledby="pricing-title">
          <h2 id="pricing-title" className={`label ${styles.sectionLabel}`}>
            Pricing
          </h2>
          <ul className={styles.planGrid}>
            {PLANS.map((plan) => (
              <li key={plan.id} className={styles.plan}>
                <div className={styles.planHead}>
                  <h3 className={styles.planName}>{plan.name}</h3>
                  <p className={`num ${styles.planPrice}`}>
                    {formatUsd(plan.monthlyPriceUsd, 0)}
                    <span className={styles.planPeriod}>/mo</span>
                  </p>
                </div>
                <dl className={styles.planSpecs}>
                  <div>
                    <dt className="label">Included</dt>
                    <dd className="num">{formatCompact(plan.includedRequests)} requests</dd>
                  </div>
                  <div>
                    <dt className="label">Overage</dt>
                    <dd className="num">
                      {plan.overagePerMillionUsd === 0
                        ? "Not billed"
                        : `${formatUsd(plan.overagePerMillionUsd, 0)} / 1M`}
                    </dd>
                  </div>
                  <div>
                    <dt className="label">Seats</dt>
                    <dd className="num">{plan.seats}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>
          {APP_NAME} is a demonstration build. Every figure on this site is generated from a fixed
          seed, not collected from a real service.
        </p>
        <p className={`num ${styles.footerMeta}`}>MIT licensed</p>
      </footer>
    </div>
  );
}
