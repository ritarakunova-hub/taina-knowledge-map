import type {Project, Row} from './model';

const LIST_KEYS = ['sources', 'processes', 'documents', 'gaps', 'owners', 'aiTests', 'tasks'] as const;
// Bound imported collections and field sizes to avoid UI/storage exhaustion.
export const MAX_PROJECT_ROWS = 5000;
export const MAX_FIELD_LENGTH = 100_000;
type ListKey = typeof LIST_KEYS[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Reject pathological or prototype-sensitive object graphs before validation,
// migration, rendering, or persistence. The iterative walk avoids recursion
// on attacker-controlled nested JSON.
const MAX_JSON_DEPTH = 64;
const MAX_JSON_NODES = 100_000;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function hasSafeObjectShape(root: unknown): boolean {
  const stack: Array<{ value: unknown; depth: number }> = [{value: root, depth: 0}];
  let visited = 0;
  while (stack.length) {
    const current = stack.pop()!;
    if (++visited > MAX_JSON_NODES || current.depth > MAX_JSON_DEPTH) return false;
    const value = current.value;
    if (!value || typeof value !== 'object') continue;
    if (Array.isArray(value)) {
      for (const item of value) stack.push({value: item, depth: current.depth + 1});
      continue;
    }
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(key)) return false;
      stack.push({value: item, depth: current.depth + 1});
    }
  }
  return true;
}

/** Validate the import envelope and all IDs/references before it can replace local data. */
export function validProject(value: unknown): value is Project {
  if (!hasSafeObjectShape(value) || !isRecord(value) || ![1, 2].includes(Number(value.schemaVersion))) return false;
  if (typeof value.id !== 'string' || !value.id.trim() || value.id.length > 200 || !isRecord(value.company) || typeof value.company.name !== 'string' || value.company.name.length > MAX_FIELD_LENGTH) return false;
  for (const field of ['industry', 'teamSize', 'departments', 'ownerName']) {
    if (value.company[field] !== undefined && (typeof value.company[field] !== 'string' || value.company[field].length > MAX_FIELD_LENGTH)) return false;
  }
  if (value.scenario !== undefined && !['solo', 'team'].includes(String(value.scenario))) return false;
  if (value.diagnostic !== undefined && (!isRecord(value.diagnostic) ||
    Object.keys(value.diagnostic).length > 100 ||
    !Object.values(value.diagnostic).every(item => typeof item === 'string' && item.length <= MAX_FIELD_LENGTH))) return false;
  if (value.verificationConfirmed !== undefined && typeof value.verificationConfirmed !== 'boolean') return false;
  if (value.updatedAt !== undefined && (typeof value.updatedAt !== 'string' || value.updatedAt.length > 100)) return false;
  if (!LIST_KEYS.every(key => Array.isArray(value[key]) || (Number(value.schemaVersion) === 1 && value[key] === undefined))) return false;
  if (value.changes !== undefined && (!Array.isArray(value.changes) || !value.changes.every(change =>
    isRecord(change) && typeof change.id === 'string' && change.id.length <= 200 && typeof change.at === 'string' && change.at.length <= 100 && typeof change.message === 'string' && change.message.length <= 2000
  ))) return false;

  const totalRows = LIST_KEYS.reduce((sum, key) => sum + (Array.isArray(value[key]) ? (value[key] as unknown[]).length : 0), 0);
  if (totalRows > MAX_PROJECT_ROWS) return false;
  if (Array.isArray(value.changes) && value.changes.length > 1000) return false;
  const ids = new Set<string>();
  for (const key of LIST_KEYS) {
    for (const row of (Array.isArray(value[key]) ? value[key] : []) as unknown[]) {
      if (!isRecord(row) || typeof row.id !== 'string' || !row.id.trim() || typeof row.name !== 'string') return false;
      if (!Object.values(row).every(field =>
        (typeof field === 'string' && field.length <= MAX_FIELD_LENGTH) ||
        typeof field === 'boolean' ||
        (Array.isArray(field) && field.length <= MAX_PROJECT_ROWS && field.every(item => typeof item === 'string' && item.length <= MAX_FIELD_LENGTH))
      )) return false;
      if (ids.has(row.id)) return false;
      ids.add(row.id);
    }
  }

  const has = (key: ListKey, id: unknown) => typeof id === 'string' && !!id && (Array.isArray(value[key]) ? value[key] as Row[] : []).some(row => row.id === id);
  const optionalRef = (row: Record<string, unknown>, field: string, target: ListKey) =>
    row[field] === undefined || row[field] === '' || has(target, row[field]);

  for (const row of (Array.isArray(value.sources) ? value.sources : []) as Row[]) {
    if (!optionalRef(row, 'owner', 'owners') || !optionalRef(row, 'process', 'processes')) return false;
  }
  for (const row of (Array.isArray(value.processes) ? value.processes : []) as Row[]) {
    if (!optionalRef(row, 'owner', 'owners')) return false;
  }
  for (const row of (Array.isArray(value.documents) ? value.documents : []) as Row[]) {
    if (!optionalRef(row, 'owner', 'owners') || !optionalRef(row, 'process', 'processes')) return false;
  }
  for (const row of (Array.isArray(value.gaps) ? value.gaps : []) as Row[]) {
    if (!optionalRef(row, 'owner', 'owners') || !optionalRef(row, 'process', 'processes') || !optionalRef(row, 'document', 'documents')) return false;
  }
  for (const row of (Array.isArray(value.aiTests) ? value.aiTests : []) as Row[]) {
    if (!optionalRef(row, 'source', 'sources')) return false;
    if (Array.isArray(row.sourceIds) && !row.sourceIds.every(id => has('sources', id))) return false;
    if (Array.isArray(row.documentIds) && !row.documentIds.every(id => has('documents', id))) return false;
  }
  for (const row of (Array.isArray(value.tasks) ? value.tasks : []) as Row[]) {
    if (!optionalRef(row, 'owner', 'owners')) return false;
  }
  return true;
}

/** Upgrade older backups while preserving every field not explicitly migrated. */
export function migrateProject(input: Project): Project {
  const value = structuredClone(input) as Project;
  const base = {
    schemaVersion: 2,
    id: typeof value.id === 'string' && value.id ? value.id : crypto.randomUUID(),
    company: {name: '', industry: '', teamSize: '', departments: '', ownerName: ''},
    scenario: 'solo',
    diagnostic: {},
    sources: [], processes: [], documents: [], gaps: [], owners: [], aiTests: [], tasks: [], changes: [],
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString()
  };
  const migrated = {
    ...base,
    ...value,
    schemaVersion: 2,
    company: {...base.company, ...(isRecord(value.company) ? value.company : {})},
    diagnostic: isRecord(value.diagnostic) ? value.diagnostic : {},
    ...Object.fromEntries(LIST_KEYS.map(key => [key, Array.isArray((value as any)[key]) ? (value as any)[key] : []])),
    changes: Array.isArray(value.changes) ? value.changes : [],
    verificationConfirmed: value.verificationConfirmed === true
  } as Project;
  return migrated;
}



/** A verification sign-off is valid only for the exact evidence scope reviewed. */
export function invalidateVerificationOnScopeChange(previous: Project, next: Project): Project {
  const scope: (keyof Project)[] = ['sources', 'processes', 'documents', 'gaps', 'owners'];
  const changed = scope.some(key => JSON.stringify(previous[key]) !== JSON.stringify(next[key]));
  if (changed) next.verificationConfirmed = false;
  return next;
}

/** Remove a record and clear references to it without deleting dependent records. */
export function deleteRecord(project: Project, key: ListKey, id: string): Project {
  const next = structuredClone(project);
  (next[key] as Row[]) = next[key].filter(row => row.id !== id);
  const clearOwner = (rows: Row[]) => rows.forEach(row => { if (row.owner === id) row.owner = ''; });
  if (key === 'owners') {
    clearOwner(next.sources); clearOwner(next.processes); clearOwner(next.documents); clearOwner(next.gaps); clearOwner(next.tasks);
  }
  if (key === 'processes') {
    [next.sources, next.documents, next.gaps].forEach(rows => rows.forEach(row => { if (row.process === id) row.process = ''; }));
  }
  if (key === 'sources') {
    next.aiTests.forEach(row => { if (row.source === id) row.source = ''; if (Array.isArray(row.sourceIds)) row.sourceIds = row.sourceIds.filter(ref => ref !== id); });
  }
  if (key === 'documents') {
    next.gaps.forEach(row => { if (row.document === id) row.document = ''; });
    next.aiTests.forEach(row => { if (Array.isArray(row.documentIds)) row.documentIds = row.documentIds.filter(ref => ref !== id); });
  }
  invalidateVerificationOnScopeChange(project, next);
  next.changes = [...(next.changes || []), {id: crypto.randomUUID(), at: new Date().toISOString(), message: `Удалена запись (${key}); зависимые связи очищены`}].slice(-100);
  return next;
}

/** Merge imported records without overwriting the current company card. All references
 * to an incoming ID are redirected if that ID collides with a current record. */
export function mergeProjects(current: Project, incoming: Project): {project: Project; conflicts: number} {
  if (!validProject(current) || !validProject(incoming)) throw new Error('Нельзя объединить проект с некорректной структурой или связями.');

  const merged = structuredClone(current);
  const copy = structuredClone(incoming);
  const currentIds = new Set(LIST_KEYS.flatMap(key => merged[key].map(row => row.id)));
  const remap = new Map<string, string>();
  let conflicts = 0;

  for (const key of LIST_KEYS) {
    for (const row of copy[key]) {
      if (currentIds.has(row.id)) {
        remap.set(row.id, crypto.randomUUID());
        conflicts++;
      }
    }
  }

  const scalarReferences = ['owner', 'ownerId', 'process', 'processId', 'source', 'sourceId', 'document', 'documentId'];
  const arrayReferences = ['sourceIds', 'documentIds'];
  for (const key of LIST_KEYS) {
    for (const row of copy[key]) {
      row.id = remap.get(row.id) || row.id;
      for (const field of scalarReferences) {
        if (typeof row[field] === 'string') row[field] = remap.get(row[field] as string) || row[field];
      }
      for (const field of arrayReferences) {
        if (Array.isArray(row[field])) row[field] = (row[field] as string[]).map(id => remap.get(id) || id);
      }
    }
  }

  for (const key of LIST_KEYS) merged[key].push(...copy[key]);
  // Imported evidence changes the reviewed scope; never carry over the current project's sign-off.
  if (['sources', 'processes', 'documents', 'gaps', 'owners'].some(key => (copy as any)[key].length > 0)) {
    merged.verificationConfirmed = false;
  }
  merged.changes = [
    ...(merged.changes || []),
    {id: crypto.randomUUID(), at: new Date().toISOString(), message: `Проект объединён; конфликтующие ID переназначены: ${conflicts}`}
  ].slice(-100);

  if (!validProject(merged)) throw new Error('После объединения обнаружены некорректные связи. Исходный проект не изменён.');
  return {project: merged, conflicts};
}
