import { APP_NAME, PLANS } from "@production/shared";

export default function Home() {
  return (
    <main>
      <h1>{APP_NAME}</h1>
      <p>The scaffold builds. Replace this page when the product takes shape.</p>
      <ul>
        {PLANS.map((plan) => (
          <li key={plan.id}>
            {plan.name} — ${plan.monthlyPriceUsd}/mo, {plan.seats} seat
            {plan.seats === 1 ? "" : "s"}
          </li>
        ))}
      </ul>
    </main>
  );
}
