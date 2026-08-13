import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import UpgradeButton from "@/components/UpgradeButton";
import { getViewer } from "@/lib/auth";
import { getAllowance } from "@/lib/db/billing";
import { isDatabaseConfigured } from "@/lib/db";
import { LIMITS, PREMIUM_PRICE_CENTS } from "@/lib/billing/plans";
import { getLocale, formatMoney } from "@/lib/i18n";

export const metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");

  const locale = await getLocale();
  const allowance = isDatabaseConfigured()
    ? await getAllowance(viewer.userId)
    : { plan: "free" as const, used: 0, limit: LIMITS.free.tripsPerMonth, maxDays: LIMITS.free.maxDays, canCreate: true };

  const price = formatMoney(PREMIUM_PRICE_CENTS / 100, "USD", locale);

  const tiers = [
    {
      id: "free" as const,
      name: "Free",
      price: formatMoney(0, "USD", locale),
      features: [
        `${LIMITS.free.tripsPerMonth} trips a month`,
        `Up to ${LIMITS.free.maxDays} days per trip`,
        "Photo uploads",
      ],
    },
    {
      id: "premium" as const,
      name: "Premium",
      price: `${price}/month`,
      features: [
        "Unlimited trips",
        `Up to ${LIMITS.premium.maxDays} days per trip`,
        "AI captions on your photos",
      ],
    },
  ];

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 sm:py-14 lg:max-w-5xl">
      <AppHeader />

      <h2 className="text-xl font-semibold">Plans</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        You have used {allowance.used} of{" "}
        {allowance.limit === Infinity ? "unlimited" : allowance.limit} trips this month.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {tiers.map((tier) => {
          const isCurrent = allowance.plan === tier.id;
          return (
            <section
              key={tier.id}
              className={`rounded-2xl border p-5 sm:p-6 ${
                isCurrent
                  ? "border-indigo-400 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-950/20"
                  : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold">{tier.name}</h3>
                {isCurrent && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                    Current plan
                  </span>
                )}
              </div>
              <p className="mt-1 text-2xl font-bold tracking-tight">{tier.price}</p>

              <ul className="mt-4 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                {tier.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              {tier.id === "premium" && !isCurrent && <UpgradeButton />}
            </section>
          );
        })}
      </div>

      <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        This runs on Stripe in test mode, so no real money moves. Pay with card
        number 4242 4242 4242 4242, any future expiry, any CVC.
      </p>
    </main>
  );
}
