"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiKey } from "@production/shared";
import { API_KEYS, REFERENCE_DATE } from "@/lib/data";
import { formatDate } from "@/lib/format";
import styles from "./keys.module.css";

function maskSecret(secret: string): string {
  return `${secret.slice(0, 12)}${"•".repeat(20)}`;
}

function randomHex(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length);
}

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>(() => [...API_KEYS]);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyFailedId, setCopyFailedId] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const copyTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  function toggleReveal(id: string) {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function copyKey(key: ApiKey) {
    if (key.status === "revoked") return;

    try {
      await navigator.clipboard.writeText(key.secret);
      setCopiedId(key.id);
      setCopyFailedId(null);

      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => {
        setCopiedId((current) => (current === key.id ? null : current));
        copyTimer.current = null;
      }, 1800);
    } catch {
      setCopiedId(null);
      setCopyFailedId(key.id);
    }
  }

  function revoke(id: string) {
    setKeys((current) =>
      current.map((key) => (key.id === id ? { ...key, status: "revoked" as const } : key)),
    );
    // A revoked secret should not stay on screen.
    setRevealed((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setPendingRevoke(null);
  }

  function createKey() {
    const name = newKeyName.trim();
    if (name === "") return;

    const id = `key_${randomHex(8)}`;
    const created: ApiKey = {
      id,
      name,
      prefix: `mk_live_${randomHex(4)}`,
      secret: `mk_live_${randomHex(32)}`,
      createdAt: REFERENCE_DATE,
      lastUsedAt: null,
      scopes: ["events:write", "usage:read"],
      status: "active",
    };

    setKeys((current) => [created, ...current]);
    setNewKeyName("");
    setCreatedId(id);
    setRevealed((current) => new Set(current).add(id));
  }

  const activeCount = keys.filter((key) => key.status === "active").length;
  const createdKey = createdId ? keys.find((key) => key.id === createdId) : undefined;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>API keys</h1>
          <p className={styles.sub}>
            {activeCount} active of {keys.length}. A new key is shown in full once; existing keys
            can be revealed again.
          </p>
        </div>
      </header>

      <form
        className={styles.create}
        onSubmit={(event) => {
          event.preventDefault();
          createKey();
        }}
      >
        <div className={styles.createField}>
          <label className="visually-hidden" htmlFor="new-key-name">
            New key name
          </label>
          <input
            id="new-key-name"
            className={styles.input}
            value={newKeyName}
            onChange={(event) => setNewKeyName(event.target.value)}
            placeholder="Name, e.g. Billing worker"
            autoComplete="off"
          />
        </div>
        <button type="submit" className={styles.submit} disabled={newKeyName.trim() === ""}>
          Create key
        </button>
      </form>

      <div className={styles.scroller}>
        <table className={styles.table}>
          <caption className="visually-hidden">
            API keys, their scopes, creation date, last use, and status.
          </caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Key</th>
              <th scope="col">Created</th>
              <th scope="col">Last used</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const isRevealed = revealed.has(key.id);
              const isRevoked = key.status === "revoked";

              return (
                <tr key={key.id} data-revoked={isRevoked ? "true" : undefined}>
                  <th scope="row" className={styles.nameCell}>
                    <span className={styles.name}>{key.name}</span>
                    <span className={styles.scopes}>
                      {key.scopes.map((scope) => (
                        <span key={scope} className={styles.scope}>
                          {scope}
                        </span>
                      ))}
                    </span>
                  </th>

                  <td className={styles.keyCell}>
                    <code className={`num ${styles.secret}`}>
                      {isRevealed ? key.secret : maskSecret(key.secret)}
                    </code>
                    <div className={styles.keyActions}>
                      <button
                        type="button"
                        className={styles.ghost}
                        onClick={() => toggleReveal(key.id)}
                        disabled={isRevoked}
                        aria-label={`${isRevealed ? "Hide" : "Reveal"} key for ${key.name}`}
                      >
                        {isRevealed ? "Hide" : "Reveal"}
                      </button>
                      <button
                        type="button"
                        className={styles.ghost}
                        onClick={() => void copyKey(key)}
                        disabled={isRevoked}
                        aria-label={`Copy key for ${key.name}`}
                      >
                        {copiedId === key.id ? "Copied" : "Copy"}
                      </button>
                    </div>
                    {copyFailedId === key.id ? (
                      <p className={styles.copyError} role="status">
                        Clipboard blocked by the browser.
                      </p>
                    ) : null}
                  </td>

                  <td className={`num ${styles.meta}`}>{formatDate(key.createdAt)}</td>
                  <td className={`num ${styles.meta}`}>
                    {key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}
                  </td>

                  <td>
                    <span className={styles.status} data-status={key.status}>
                      {key.status}
                    </span>
                  </td>

                  <td className={styles.actionCell}>
                    {isRevoked ? (
                      <span className={styles.muted}>—</span>
                    ) : pendingRevoke === key.id ? (
                      <span className={styles.confirm}>
                        <button
                          type="button"
                          className={styles.danger}
                          onClick={() => revoke(key.id)}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className={styles.ghost}
                          onClick={() => setPendingRevoke(null)}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={styles.ghost}
                        onClick={() => setPendingRevoke(key.id)}
                        aria-label={`Revoke key for ${key.name}`}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="visually-hidden" aria-live="polite">
        {createdKey ? `Key ${createdKey.name} (${createdKey.prefix}) created and revealed.` : ""}
      </p>

      <section className={styles.note} aria-labelledby="key-note-heading">
        <h2 id="key-note-heading" className="label">
          Handling
        </h2>
        <p>
          A created secret is shown in full once, at creation; an existing one can be revealed again
          here. Keep secrets in the environment of the service that uses them, never in a
          repository. Revoking takes effect on the next request.
        </p>
      </section>
    </div>
  );
}
