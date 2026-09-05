import { Check, Copy, Play, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PipelineGraph } from "@/components/rsl/pipeline-graph";
import { CATALOG, FLATTEN_NOTES, type CatalogEntry } from "@/lib/rsl/catalog";
import { compileToRxjs } from "@/lib/rsl/compile";
import { EXAMPLES, pretty } from "@/lib/rsl/examples";
import { parseRsl } from "@/lib/rsl/parse";
import { runMachine, type StreamEvent } from "@/lib/rsl/run";
import type { NodeType } from "@/lib/rsl/types";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "rsl-studio-doc-v1";

function formatValue(v: unknown): string {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function Studio() {
  const [exampleId, setExampleId] = useState(EXAMPLES[0].id);
  const [text, setText] = useState(() => pretty(EXAMPLES[0].machine));
  const [kind, setKind] = useState<NodeType>("Source");
  const [copied, setCopied] = useState<"json" | "rxjs" | null>(null);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<"write" | "graph" | "rxjs" | "run">("write");
  const stopRef = useRef<(() => void) | null>(null);

  const parsed = useMemo(() => parseRsl(text), [text]);
  const rxjs = useMemo(() => (parsed.machine ? compileToRxjs(parsed.machine) : ""), [parsed.machine]);
  const entry = CATALOG.find((c) => c.id === kind) as CatalogEntry;
  const example = EXAMPLES.find((e) => e.id === exampleId) ?? EXAMPLES[0];

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setText(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, text);
  }, [text]);

  useEffect(() => {
    return () => stopRef.current?.();
  }, []);

  function loadExample(id: string) {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setExampleId(id);
    setText(pretty(ex.machine));
    stop();
    setEvents([]);
  }

  function copy(which: "json" | "rxjs") {
    const value = which === "json" ? text : rxjs;
    void navigator.clipboard.writeText(value);
    setCopied(which);
    window.setTimeout(() => setCopied(null), 1200);
  }

  function stop() {
    stopRef.current?.();
    stopRef.current = null;
    setRunning(false);
  }

  function run() {
    if (!parsed.ok || !parsed.machine) return;
    stop();
    setEvents([]);
    setRunning(true);
    setTab("run");
    stopRef.current = runMachine(parsed.machine, (e) => {
      setEvents((prev) => [...prev, e].slice(-80));
      if (e.kind === "complete" || e.kind === "error") {
        setRunning(false);
        stopRef.current = null;
      }
    });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              RSL 1.0 · after Amazon States Language
            </p>
            <h1 className="mt-1 font-sans text-3xl font-medium tracking-tight text-balance sm:text-4xl">
              Reactive States Language
            </h1>
            <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
              Five RxJS node kinds, written as a state machine. Sources emit, pipes transform, sinks
              subscribe, combines fan in, and four flattening maps nest an inner pipeline per value.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="example">
              Example
            </label>
            <select
              id="example"
              value={exampleId}
              onChange={(e) => loadExample(e.target.value)}
              className="h-11 min-w-40 rounded-md border border-border bg-card px-3 text-sm"
            >
              {EXAMPLES.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} · {ex.kinds}
                </option>
              ))}
            </select>
            <Button type="button" onClick={run} disabled={!parsed.ok || running}>
              <Play />
              Run stream
            </Button>
            <Button type="button" variant="outline" onClick={stop} disabled={!running}>
              <Square />
              Stop
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-0 lg:grid lg:grid-cols-[minmax(16rem,20rem)_1fr] lg:gap-0">
        <aside className="border-b border-border lg:border-r lg:border-b-0">
          <div className="flex flex-nowrap gap-2 overflow-x-auto p-3 lg:flex-col lg:overflow-visible lg:p-4">
            {CATALOG.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setKind(c.id)}
                className={cn(
                  "min-w-40 shrink-0 rounded-lg border px-3 py-3 text-left transition-colors duration-150 lg:min-w-0",
                  kind === c.id
                    ? "border-foreground/30 bg-card"
                    : "border-transparent bg-transparent hover:bg-card/60",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{c.n}</span>
                  <span className="text-[11px] text-muted-foreground">{c.ports}</span>
                </div>
                <div className="mt-1 text-sm font-medium">{c.title}</div>
              </button>
            ))}
          </div>
          <div className="hidden border-t border-border p-4 lg:block">
            <KindDetail entry={entry} />
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-border px-4 py-3 lg:hidden">
            <KindDetail entry={entry} compact />
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-border px-2 pt-2 lg:hidden">
            {(
              [
                ["write", "Write"],
                ["graph", "Graph"],
                ["rxjs", "RxJS"],
                ["run", "Run"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "h-10 rounded-t-md px-3 text-sm",
                  tab === id ? "bg-card text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid min-h-0 flex-1 lg:grid-cols-2">
            <section className={cn("flex min-h-72 flex-col border-border lg:border-r", tab !== "write" && "hidden lg:flex")}>
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <div>
                  <h2 className="text-sm font-medium">RSL document</h2>
                  <p className="text-[12px] text-muted-foreground">{example.blurb}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => copy("json")}>
                  {copied === "json" ? <Check /> : <Copy />}
                  Copy
                </Button>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                aria-label="RSL JSON"
                className="min-h-64 flex-1 resize-none bg-transparent p-4 font-mono text-[12px] leading-relaxed text-foreground outline-none"
              />
              <div className="border-t border-border px-4 py-2 text-[12px]">
                {parsed.ok && parsed.machine ? (
                  <span className="text-muted-foreground">
                    Valid · {Object.keys(parsed.machine.States).length} states
                  </span>
                ) : (
                  <span className="text-foreground">{parsed.issues[0]?.message ?? "Invalid"}</span>
                )}
              </div>
            </section>

            <section className="grid min-h-0 lg:grid-rows-[minmax(180px,1fr)_minmax(160px,1fr)]">
              <div className={cn("flex min-h-48 flex-col border-b border-border", tab !== "graph" && "hidden lg:flex")}>
                <div className="border-b border-border px-4 py-2">
                  <h2 className="text-sm font-medium">Graph</h2>
                </div>
                <div className="flex-1 p-3">
                  {parsed.machine ? (
                    <PipelineGraph machine={parsed.machine} />
                  ) : (
                    <p className="p-4 text-sm text-muted-foreground">Fix JSON to draw the graph.</p>
                  )}
                </div>
              </div>
              <div className="grid min-h-0 sm:grid-cols-2">
                <div className={cn("flex min-h-40 flex-col border-border sm:border-r", tab !== "rxjs" && "hidden lg:flex")}>
                  <div className="flex items-center justify-between border-b border-border px-4 py-2">
                    <h2 className="text-sm font-medium">Compiled RxJS</h2>
                    <Button type="button" variant="ghost" size="sm" onClick={() => copy("rxjs")} disabled={!rxjs}>
                      {copied === "rxjs" ? <Check /> : <Copy />}
                      Copy
                    </Button>
                  </div>
                  <pre className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
                    {rxjs || "// waiting for a valid document"}
                  </pre>
                </div>
                <div className={cn("flex min-h-40 flex-col", tab !== "run" && "hidden lg:flex")}>
                  <div className="border-b border-border px-4 py-2">
                    <h2 className="text-sm font-medium">Emissions</h2>
                  </div>
                  <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2">
                    {events.filter((e) => e.kind === "next").length === 0 ? (
                      <span className="text-[12px] text-muted-foreground">Run a document to see values.</span>
                    ) : (
                      events
                        .filter((e) => e.kind === "next")
                        .map((e, i) => (
                          <span
                            key={`${e.t}-${i}`}
                            className="inline-flex size-9 items-center justify-center rounded-full border border-border font-mono text-[10px] tabular-nums"
                            title={`${e.t}ms`}
                          >
                            {String(formatValue(e.value)).slice(0, 4)}
                          </span>
                        ))
                    )}
                  </div>
                  <ol className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-6">
                    {events.map((e, i) => (
                      <li key={`${e.kind}-${e.t}-${i}`} className="flex gap-3">
                        <span className="w-10 shrink-0 tabular-nums text-muted-foreground">{e.t}ms</span>
                        <span className="w-16 shrink-0 text-muted-foreground">{e.kind}</span>
                        <span className="min-w-0 break-all">{e.kind === "complete" ? "—" : formatValue(e.value)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function KindDetail({ entry, compact = false }: { entry: CatalogEntry; compact?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <h2 className="text-base font-medium">{entry.title}</h2>
        <Badge>{entry.ports}</Badge>
      </div>
      <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">{entry.body}</p>
      {compact ? null : (
        <>
          <dl className="mt-3 space-y-1 text-[12px]">
            <div className="flex gap-2">
              <dt className="w-10 shrink-0 text-muted-foreground">RxJS</dt>
              <dd className="font-mono text-foreground/90">{entry.rx}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-10 shrink-0 text-muted-foreground">ASL</dt>
              <dd className="text-foreground/90">{entry.asl}</dd>
            </div>
          </dl>
          {entry.id === "FlatMap" ? (
            <ul className="mt-3 space-y-1.5 text-[12px]">
              {FLATTEN_NOTES.map((f) => (
                <li key={f.id} className="flex gap-2">
                  <span className="w-16 shrink-0 font-mono text-muted-foreground">{f.id}</span>
                  <span className="text-pretty text-muted-foreground">
                    <span className="text-foreground">{f.rx}</span> · {f.line}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <pre className="mt-3 overflow-auto rounded-md bg-card p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {entry.sample}
          </pre>
        </>
      )}
    </div>
  );
}
