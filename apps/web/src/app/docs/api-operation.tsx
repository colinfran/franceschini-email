"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDocOperation } from "~/lib/docs-api";

type Operation = ReturnType<typeof getDocOperation>;

export function ApiOperation({ operation }: { operation: string }) {
  const [result, setResult] = useState<
    { data: Operation; error?: never } | { error: string; data?: never } | null
  >(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    async function load() {
      try {
        const response = await fetch("/api/v1/doc", {
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(`API documentation returned HTTP ${response.status}`);
        const document: unknown = await response.json();
        const data = getDocOperation(document, operation);
        setResult({ data });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to load API documentation", error);
        setResult({
          error:
            error instanceof Error
              ? error.message
              : "Unable to load API documentation",
        });
      }
    }
    void load();
    return () => controller.abort();
  }, [operation, attempt]);

  if (!result) return <p role="status">Loading API reference...</p>;
  if (result.error !== undefined)
    return (
      <div
        role="alert"
        className="my-6 rounded-lg border border-destructive p-4"
      >
        <p>{result.error}</p>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="underline"
        >
          Retry
        </button>
      </div>
    );
  const { data } = result;
  return (
    <section aria-label="API reference">
      <pre>
        <code>
          {data.method} /api{data.path}
        </code>
      </pre>
      {data.summary ? <h2>{data.summary}</h2> : null}
      {data.description ? <p>{data.description}</p> : null}
      <h2>Authentication</h2>
      <p>
        Create an API key in{" "}
        <a href="/dev-settings/api-keys">Developer settings</a> and send it in
        the <code>Authorization: Bearer YOUR_API_KEY</code> header. Use{" "}
        <code>https://franceschini.email/api</code> as the API base URL.
      </p>
      {data.parameters?.length ? (
        <>
          <h2>Parameters</h2>
          <pre>
            <code>{JSON.stringify(data.parameters, null, 2)}</code>
          </pre>
        </>
      ) : null}
      {data.requestBody ? (
        <>
          <h2>Request body</h2>
          <pre>
            <code>{JSON.stringify(data.requestBody, null, 2)}</code>
          </pre>
        </>
      ) : null}
      <h2>Responses</h2>
      {Object.entries(data.responses).map(([status, response]) => (
        <section key={status}>
          <h3>HTTP {status}</h3>
          <pre>
            <code>{JSON.stringify(response, null, 2)}</code>
          </pre>
        </section>
      ))}
      {data.schemas && Object.keys(data.schemas).length ? (
        <details>
          <summary>Schema definitions</summary>
          <pre>
            <code>{JSON.stringify(data.schemas, null, 2)}</code>
          </pre>
        </details>
      ) : null}
      <p>
        <Link href="/api/v1/ui" prefetch={false}>
          Open the interactive API explorer
        </Link>{" "}
        to try requests against this installation.
      </p>
    </section>
  );
}
