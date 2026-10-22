# Frontend UI Architecture — Examples

Good/bad pairs for each rule. See [rules/layout.md](rules/layout.md) and [rules/conventions.md](rules/conventions.md) for the rules these illustrate, and [README.md](README.md) for sources. These illustrate the *placement* decision, not component-internal correctness (see `react-best-practices/examples.md` for that).

## Folder structure: premature centralization vs. colocation

```
# Bad — a shared "components" dump created before a second consumer exists
src/
  components/
    PrFilterBar.tsx       # only ever used by features/pull-requests
    AgentCard.tsx         # only ever used by features/agents
  hooks/
    usePrFilters.ts
    useAgentForm.ts

# Good — colocated with the one feature that owns each piece
src/app/pull-requests/_components/PrFilterBar/
  PrFilterBar.tsx
  PrFilterBar.test.tsx
  index.ts
src/app/agents/_components/AgentCard/
  AgentCard.tsx
  AgentCard.test.tsx
  index.ts
src/lib/hooks/           # promoted here only once 2+ features need the same data hook
  usePulls.ts
```

## Pages: thin route wiring, page-specific vs. shared components

```tsx
// Bad — real feature logic living directly in the page file
// src/app/pull-requests/page.tsx
export default function PullRequestsPage() {
  const { data: pulls = [] } = usePulls();
  const [filter, setFilter] = useState<'open' | 'closed'>('open');
  const filtered = pulls.filter(p => p.status === filter);
  return (
    <div>
      <select value={filter} onChange={e => setFilter(e.target.value as any)}>
        <option value="open">Open</option>
        <option value="closed">Closed</option>
      </select>
      <ul>{filtered.map(p => <li key={p.id}>{p.title}</li>)}</ul>
    </div>
  );
}

// Good — page stays thin; feature logic lives in a page-specific component
// src/app/pull-requests/page.tsx
export default function PullRequestsPage() {
  return <PrListView />;
}

// src/app/pull-requests/_components/PrListView/PrListView.tsx
// (page-specific: only this route uses it, so it stays colocated here)
export function PrListView() {
  const { data: pulls = [] } = usePulls();
  const [filter, setFilter] = useState<'open' | 'closed'>('open');
  const filtered = pulls.filter(p => p.status === filter);
  return (
    <div>
      <PrFilterSelect value={filter} onChange={setFilter} />
      <ul>{filtered.map(p => <li key={p.id}>{p.title}</li>)}</ul>
    </div>
  );
}

// src/components/app-shell/AppNav.tsx
// (shared: used by every route's layout, so it's promoted out of any one _components/)
export function AppNav() { /* ... */ }
```

## Tests: colocated, not a parallel tree

```
# Bad — tests hoisted into a separate tree, disconnected from the file they cover
src/
  app/pull-requests/_components/PrListView/PrListView.tsx
  __tests__/
    PrListView.test.tsx

# Good — test colocated right next to the component it exercises
src/app/pull-requests/_components/PrListView/
  PrListView.tsx
  PrListView.test.tsx
  index.ts
```

## Component: own file vs. own folder

```tsx
// Bad — promoted to a folder before it needs a second file
// src/app/agents/_components/AgentBadge/AgentBadge.tsx  (nothing else in the folder)
export function AgentBadge({ status }: { status: string }) {
  return <span>{status}</span>;
}

// Good — stays a single file until it genuinely needs one
// src/app/agents/_components/AgentBadge.tsx
export function AgentBadge({ status }: { status: string }) {
  return <span>{status}</span>;
}

// Good — promoted once a test + a local helper show up
// src/app/agents/_components/AgentBadge/
//   AgentBadge.tsx
//   AgentBadge.test.tsx
//   helpers.ts        <- colocated, not hoisted to a shared utils/ yet
//   index.ts
```

## Barrel files: component-level is fine, directory-wide is not

```ts
// Good — single-component barrel, one export, near-zero cost
// AgentCard/index.ts
export { AgentCard } from './AgentCard';

// Bad — feature-wide barrel aggregating many unrelated modules
// features/agents/index.ts
export * from './components/AgentCard';
export * from './components/AgentForm';
export * from './components/AgentList';
export * from './hooks/useAgentForm';
export * from './hooks/useAgentList';
export * from './api/agents';
// every consumer that imports ONE of these now pulls the whole graph in dev,
// and risks pulling it in production too if any module in the chain has a
// side effect or isn't tree-shake-safe.

// Good — import directly instead
import { AgentCard } from '@/features/agents/components/AgentCard';
```

## Hook vs. util: the mechanical test

```ts
// Bad — named like a hook, but it's a pure function; forcing the `use`
// prefix means it can no longer be called conditionally or outside a component
function useSortedPulls(pulls: Pull[]) {
  return [...pulls].sort((a, b) => b.updatedAt - a.updatedAt);
}

// Good — it's a plain function because it never calls a hook
// src/lib/utils/sort-pulls.ts
export function getSortedPulls(pulls: Pull[]) {
  return [...pulls].sort((a, b) => b.updatedAt - a.updatedAt);
}

// Good — this one IS a hook, because it calls useQuery internally
// src/lib/hooks/use-pulls.ts
export function usePulls(repoId: string) {
  return useQuery({
    queryKey: ['pulls', repoId],
    queryFn: () => fetchPulls(repoId),
  });
}
```

## Business logic layering: contract → fetcher → hook

```ts
// Bad — business logic and React-fetching concerns tangled in one place,
// and duplicated wherever another component needs the same data
function PrList() {
  const [pulls, setPulls] = useState<Pull[]>([]);
  useEffect(() => {
    fetch('/api/pulls').then(r => r.json()).then(setPulls); // no cache, no error state, not reusable
  }, []);
  return <ul>{pulls.map(p => <li key={p.id}>{p.title}</li>)}</ul>;
}

// Good — three thin, colocated layers
// features/pull-requests/api/types.ts
export type Pull = { id: string; title: string; updatedAt: number };

// features/pull-requests/api/fetch-pulls.ts
export function fetchPulls(repoId: string): Promise<Pull[]> {
  return apiClient.get(`/repos/${repoId}/pulls`);
}

// features/pull-requests/hooks/use-pulls.ts
export function usePulls(repoId: string) {
  return useQuery({ queryKey: ['pulls', repoId], queryFn: () => fetchPulls(repoId) });
}

// PrList.tsx
function PrList({ repoId }: { repoId: string }) {
  const { data: pulls = [] } = usePulls(repoId);
  return <ul>{pulls.map(p => <li key={p.id}>{p.title}</li>)}</ul>;
}
```

## Constants: two-tier, not one global file

```ts
// Bad — one catch-all file mixing env config with feature-specific option lists
// src/constants.ts
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
export const PR_STATUS_LABELS = { open: 'Open', closed: 'Closed', merged: 'Merged' };
export const MAX_FINDINGS_PER_PAGE = 20;

// Good — env-derived, truly app-wide values in a small config module
// src/lib/config.ts
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

// Good — feature-specific constant colocated with the one feature that uses it
// features/pull-requests/constants.ts
export const PR_STATUS_LABELS = { open: 'Open', closed: 'Closed', merged: 'Merged' } as const;

// Good — single-use constant stays inline, not even promoted to a file
function FindingsList() {
  const MAX_PER_PAGE = 20;
  // ...
}
```

## Naming: file vs. export case

```
AgentCard.tsx              <- component file: PascalCase
use-click-outside.ts       <- hook file: kebab-case
  export function useClickOutside() { ... }   <- hook export: camelCase, `use`-prefixed
sort-pulls.ts              <- util file: kebab-case
  export function getSortedPulls() { ... }    <- util export: camelCase
config.ts
  export const API_BASE = ...                 <- exported, env-derived, fixed: SCREAMING_SNAKE_CASE
  const retryCount = 3                         <- file-local, not exported: camelCase
```
