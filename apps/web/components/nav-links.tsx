"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./nav-links.module.css";

const ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/keys", label: "API keys" },
] as const;

export function NavLinks() {
  const pathname = usePathname();

  return (
    <ul className={styles.list}>
      {ITEMS.map((item) => {
        const active = pathname === item.href;

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={styles.link}
              data-active={active ? "true" : undefined}
              aria-current={active ? "page" : undefined}
            >
              <span className={styles.tick} aria-hidden="true" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
