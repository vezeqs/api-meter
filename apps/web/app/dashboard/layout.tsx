import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME } from "@production/shared";
import { NavLinks } from "@/components/nav-links";
import styles from "./dashboard.module.css";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Request volume, quota, error rate, and spend for the current billing cycle.",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.rail}>
        <Link href="/" className={styles.brand}>
          <span className={styles.mark} aria-hidden="true" />
          {APP_NAME}
        </Link>

        <nav aria-label="Dashboard" className={styles.nav}>
          <NavLinks />
        </nav>

        <div className={styles.railFoot}>
          <p className="label">Plan</p>
          <p className={`num ${styles.plan}`}>Pro · 2M req</p>
          <Link href="/" className={styles.back}>
            Back to site
          </Link>
        </div>
      </aside>

      <main id="main" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
