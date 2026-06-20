/**
 * Path-derived canonical node ids + collision handling.
 *
 * Ids are derived from file path + class + function — NOT from layer (layer is
 * optional and config-mutable, so a layer-derived id would be unstable). Each
 * node also carries a prettified `displayName` for presentation.
 */

const SERVICE_PREFIX = "service:";
const UNRESOLVED_PREFIX = "unresolved:";

export function moduleId(moduleDotted: string): string {
  return moduleDotted;
}

export function classId(moduleDotted: string, className: string): string {
  return `${moduleDotted}.${className}`;
}

export function methodId(moduleDotted: string, className: string, methodName: string): string {
  return `${moduleDotted}.${className}.${methodName}`;
}

export function functionId(moduleDotted: string, funcName: string): string {
  return `${moduleDotted}.${funcName}`;
}

export function serviceId(name: string): string {
  return `${SERVICE_PREFIX}${name}`;
}

export function isServiceId(id: string): boolean {
  return id.startsWith(SERVICE_PREFIX);
}

export function serviceName(id: string): string {
  return id.startsWith(SERVICE_PREFIX) ? id.slice(SERVICE_PREFIX.length) : id;
}

export function unresolvedId(name: string): string {
  return `${UNRESOLVED_PREFIX}${name}`;
}

export function isUnresolvedId(id: string): boolean {
  return id.startsWith(UNRESOLVED_PREFIX);
}

/**
 * Prettified display name: the trailing 1-2 dotted segments, so
 * "domain.order_service.OrderService.create_order" -> "OrderService.create_order".
 */
export function displayNameFor(id: string, kind: string): string {
  if (isServiceId(id)) return serviceName(id);
  if (isUnresolvedId(id)) return id.slice(UNRESOLVED_PREFIX.length);
  const parts = id.split(".");
  if (kind === "module") return parts[parts.length - 1] ?? id;
  if (parts.length >= 2) return parts.slice(-2).join(".");
  return id;
}

/** Tracks assigned ids and suffixes collisions deterministically (first-wins). */
export class IdAllocator {
  private readonly seen = new Map<string, number>();
  private collisionCount = 0;

  /** Return `id` the first time it is requested; suffix later duplicates with #n. */
  allocate(id: string): string {
    const count = this.seen.get(id);
    if (count === undefined) {
      this.seen.set(id, 1);
      return id;
    }
    this.collisionCount += 1;
    const next = count + 1;
    this.seen.set(id, next);
    return `${id}#${next}`;
  }

  get collisions(): number {
    return this.collisionCount;
  }
}
