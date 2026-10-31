import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main id="main" className={styles.wrap}>
      <p className="label">404</p>
      <h1 className={styles.title}>There is nothing at this address.</h1>
      <p className={styles.body}>
        The page may have moved, or the link may be wrong. The dashboard is still where it was.
      </p>
      <div className={styles.actions}>
        <Link href="/dashboard" className={styles.primary}>
          Open the dashboard
        </Link>
        <Link href="/" className={styles.secondary}>
          Back to the front page
        </Link>
      </div>
    </main>
  );
}
