import type { NodeType, RslMachine, RslState } from "./types";

export type GraphNode = {
  id: string;
  type: NodeType;
  label: string;
  detail: string;
  x: number;
  y: number;
  inner?: GraphModel;
};

export type GraphEdge = {
  from: string;
  to: string;
  kind: "next" | "source" | "inner";
};

export type GraphModel = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
};

const COL_W = 168;
const ROW_H = 92;
const PAD = 28;

export function layoutGraph(machine: RslMachine): GraphModel {
  const col = new Map<string, number>();
  const row = new Map<string, number>();
  const placed = new Set<string>();
  const consumed = new Set<string>();

  for (const state of Object.values(machine.States)) {
    if (state.Type === "Combine") {
      for (const src of state.Sources) consumed.add(src);
    }
  }

  function place(name: string, c: number, r: number) {
    if (placed.has(name) || !machine.States[name]) return;
    placed.add(name);
    col.set(name, c);
    row.set(name, r);
    const s = machine.States[name];
    if (s.Type === "Combine") {
      s.Sources.forEach((src, i) => place(src, Math.max(0, c - 1), r + i));
    }
    if (s.Next && !s.End && s.Type !== "Sink") {
      place(s.Next, c + 1, r);
    }
  }

  place(machine.StartAt, consumed.size ? 1 : 0, 0);

  let i = 0;
  for (const name of Object.keys(machine.States)) {
    if (!placed.has(name)) place(name, 0, ++i + 2);
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  let maxC = 0;
  let maxR = 0;

  for (const [name, s] of Object.entries(machine.States)) {
    const c = col.get(name) ?? 0;
    const r = row.get(name) ?? 0;
    maxC = Math.max(maxC, c);
    maxR = Math.max(maxR, r);
    nodes.push({
      id: name,
      type: s.Type,
      label: name,
      detail: detailOf(s),
      x: PAD + c * COL_W,
      y: PAD + r * ROW_H,
      inner: s.Type === "FlatMap" && typeof s.Project === "object" ? layoutGraph(s.Project) : undefined,
    });
    if (s.Next && !s.End && s.Type !== "Sink") {
      edges.push({ from: name, to: s.Next, kind: "next" });
    }
    if (s.Type === "Combine") {
      for (const src of s.Sources) {
        edges.push({ from: src, to: name, kind: "source" });
      }
    }
  }

  return {
    nodes,
    edges,
    width: PAD * 2 + (maxC + 1) * COL_W,
    height: PAD * 2 + (maxR + 1) * ROW_H,
  };
}

function detailOf(s: RslState): string {
  switch (s.Type) {
    case "Source":
      return s.Operator;
    case "Pipe":
      return s.Operator;
    case "Combine":
      return s.Strategy;
    case "FlatMap":
      return s.Flatten;
    case "Sink":
      return s.Operator ?? "subscribe";
    default:
      return "";
  }
}
