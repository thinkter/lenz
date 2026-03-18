const DEFAULT_CACHE_CAPACITY = 1024;

type KatexRenderEngine = {
  renderToString(input: string, options?: unknown): string;
};

function normalizeCapacity(capacity: number): number {
  if (!Number.isFinite(capacity)) {
    return DEFAULT_CACHE_CAPACITY;
  }

  return Math.max(1, Math.floor(capacity));
}

function serializeUnknown(value: unknown, seen: WeakSet<object>): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return '"[nan]"';
    }
    if (!Number.isFinite(value)) {
      return value > 0 ? '"[infinity]"' : '"[-infinity]"';
    }
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "undefined") {
    return '"[undefined]"';
  }
  if (typeof value === "bigint") {
    return `"${value.toString()}n"`;
  }
  if (typeof value === "symbol") {
    return JSON.stringify(String(value));
  }
  if (typeof value === "function") {
    return '"[function]"';
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '"[circular]"';
    }

    seen.add(value);
    const serializedValues = value.map((entry) => serializeUnknown(entry, seen)).join(",");
    seen.delete(value);
    return `[${serializedValues}]`;
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (value instanceof RegExp) {
    return JSON.stringify(value.toString());
  }

  if (value instanceof Set) {
    if (seen.has(value)) {
      return '"[circular]"';
    }

    seen.add(value);
    const serializedValues = Array.from(value.values())
      .map((entry) => serializeUnknown(entry, seen))
      .join(",");
    seen.delete(value);
    return `{"[set]":[${serializedValues}]}`;
  }

  if (value instanceof Map) {
    if (seen.has(value)) {
      return '"[circular]"';
    }

    seen.add(value);
    const serializedEntries = Array.from(value.entries())
      .map(([mapKey, mapValue]) => [
        serializeUnknown(mapKey, seen),
        serializeUnknown(mapValue, seen),
      ] as const)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([leftKey, rightValue]) => `[${leftKey},${rightValue}]`)
      .join(",");
    seen.delete(value);
    return `{"[map]":[${serializedEntries}]}`;
  }

  const objectValue = value as Record<string, unknown>;
  if (seen.has(objectValue)) {
    return '"[circular]"';
  }

  seen.add(objectValue);
  const serializedEntries = Object.keys(objectValue)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => `${JSON.stringify(key)}:${serializeUnknown(objectValue[key], seen)}`)
    .join(",");
  seen.delete(objectValue);
  return `{${serializedEntries}}`;
}

function buildCacheKey(input: string, options: unknown): string {
  const serializedOptions = serializeUnknown(options, new WeakSet<object>());
  return `${JSON.stringify(input)}:${serializedOptions}`;
}

export function createBoundedKatexEngine(
  engine: KatexRenderEngine,
  capacity = DEFAULT_CACHE_CAPACITY,
): KatexRenderEngine {
  const maxEntries = normalizeCapacity(capacity);
  const cache = new Map<string, string>();

  return {
    renderToString(input: string, options?: unknown): string {
      const cacheKey = buildCacheKey(input, options);
      const existing = cache.get(cacheKey);
      if (existing !== undefined) {
        cache.delete(cacheKey);
        cache.set(cacheKey, existing);
        return existing;
      }

      const rendered = engine.renderToString(input, options);
      cache.set(cacheKey, rendered);

      if (cache.size > maxEntries) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined) {
          cache.delete(oldestKey);
        }
      }

      return rendered;
    },
  };
}
