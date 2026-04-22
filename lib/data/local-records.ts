const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PersistedRecordIdentity {
  id: string;
  legacyId?: string | null;
}

export function isUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return UUID_REGEX.test(value);
}

export function isRemoteBackedRecord(record: PersistedRecordIdentity): boolean {
  return isUuid(record.id) || isUuid(record.legacyId);
}

export function isLocalMigrationCandidate<T extends PersistedRecordIdentity>(record: T): boolean {
  return !isRemoteBackedRecord(record);
}

export function matchesRecordIdentity(
  left: PersistedRecordIdentity,
  right: PersistedRecordIdentity,
): boolean {
  const leftIds = [left.id, left.legacyId].filter(Boolean);
  const rightIds = [right.id, right.legacyId].filter(Boolean);

  return leftIds.some((leftId) => rightIds.includes(leftId));
}

export function upsertByIdentity<T extends PersistedRecordIdentity>(
  items: T[],
  nextItem: T,
): T[] {
  const index = items.findIndex((item) => matchesRecordIdentity(item, nextItem));
  if (index < 0) return [...items, nextItem];

  const next = [...items];
  next[index] = nextItem;
  return next;
}
