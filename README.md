# RSL Studio

**Reactive States Language** — describe RxJS pipelines as Amazon States Language–style JSON, then compile and run them.

RSL maps five RxJS node kinds onto a state machine:

| Kind | RSL `Type` | Role |
| --- | --- | --- |
| 1 | `Source` | Output only (`from`, `of`, `interval`, …) |
| 2 | `Pipe` | Input and output (`map`, `filter`, …) |
| 3 | `Sink` | Input only (`subscribe`) |
| 4 | `Combine` | Many sources → one source (`zip`, `merge`, …) |
| 5 | `FlatMap` | Input → inner pipeline → output (`switchMap`, `mergeMap`, `concatMap`, `exhaustMap`) |

## Example

```js
from([1, 2, 3, 4, 5]).pipe(
  map((n) => n * 2),
  filter((n) => n > 4),
).subscribe((n) => console.log(n));
```

as RSL:

```json
{
  "QueryLanguage": "JSONata",
  "Version": "1.0",
  "StartAt": "xs",
  "States": {
    "xs": {
      "Type": "Source",
      "Operator": "from",
      "Arguments": { "values": [1, 2, 3, 4, 5] },
      "Next": "Double"
    },
    "Double": {
      "Type": "Pipe",
      "Operator": "map",
      "Project": "{% $value * 2 %}",
      "Next": "GreaterThanFour"
    },
    "GreaterThanFour": {
      "Type": "Pipe",
      "Operator": "filter",
      "Project": "{% $value > 4 %}",
      "Next": "Log"
    },
    "Log": {
      "Type": "Sink",
      "Operator": "subscribe",
      "NextHandler": "log"
    }
  }
}
```

Emissions: `6`, `8`, `10`.

## Run

```bash
npm install
npm run dev
```

Then open the URL Vite prints (port `8080` by default).

## Layout

- `src/lib/rsl/` — language types, parse, compile to RxJS, runtime
- `src/components/rsl/` — studio UI and pipeline graph
- Examples live in `src/lib/rsl/examples.ts`
