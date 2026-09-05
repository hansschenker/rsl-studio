import { layoutGraph, type GraphModel } from "@/lib/rsl/graph";
import type { NodeType, RslMachine } from "@/lib/rsl/types";

const SHAPE: Record<NodeType, string> = {
  Source: "M 10 8 L 118 8 L 132 28 L 118 48 L 10 48 Z",
  Pipe: "M 10 8 H 132 V 48 H 10 Z",
  Sink: "M 24 8 L 132 8 L 132 48 L 24 48 L 10 28 Z",
  Combine: "M 24 8 L 118 8 L 132 28 L 118 48 L 24 48 L 10 28 Z",
  FlatMap: "M 10 8 H 132 V 48 H 10 Z",
};

export function PipelineGraph({ machine }: { machine: RslMachine }) {
  const g = layoutGraph(machine);
  return (
    <div className="h-full min-h-48 overflow-auto">
      <svg
        role="img"
        aria-label="Pipeline graph"
        viewBox={`0 0 ${Math.max(g.width, 320)} ${Math.max(g.height, 140)}`}
        className="h-auto w-full min-h-40"
      >
        <title>RSL pipeline</title>
        <GraphSvg g={g} />
      </svg>
    </div>
  );
}

function GraphSvg({ g }: { g: GraphModel }) {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  return (
    <g>
      {g.edges.map((e) => {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) return null;
        const x1 = a.x + 132;
        const y1 = a.y + 28;
        const x2 = b.x + 10;
        const y2 = b.y + 28;
        const mid = (x1 + x2) / 2;
        return (
          <path
            key={`${e.from}-${e.to}-${e.kind}`}
            d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
            fill="none"
            className={e.kind === "source" ? "stroke-muted-foreground/50" : "stroke-foreground/55"}
            strokeWidth={e.kind === "source" ? 1 : 1.4}
          />
        );
      })}
      {g.nodes.map((n) => (
        <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
          <path
            d={SHAPE[n.type]}
            className="fill-card stroke-border"
            strokeWidth={n.type === "FlatMap" ? 1.6 : 1}
          />
          {n.type === "FlatMap" ? (
            <rect x={18} y={16} width={96} height={24} className="fill-transparent stroke-muted-foreground/50" rx={2} />
          ) : null}
          <text x={71} y={24} textAnchor="middle" className="fill-muted-foreground" fontSize={9} fontFamily="IBM Plex Sans, sans-serif">
            {n.type}
            {n.detail ? ` · ${n.detail}` : ""}
          </text>
          <text x={71} y={40} textAnchor="middle" className="fill-foreground" fontSize={12} fontFamily="IBM Plex Sans, sans-serif">
            {n.label}
          </text>
        </g>
      ))}
    </g>
  );
}
