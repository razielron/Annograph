import { describe, it, expect } from "vitest";
import {
  IdAllocator,
  classId,
  displayNameFor,
  isServiceId,
  isUnresolvedId,
  methodId,
  serviceId,
  serviceName,
  unresolvedId,
} from "../../src/ir/ids.js";

describe("id derivation", () => {
  it("derives dotted ids from path + class + method", () => {
    expect(classId("domain.order_service", "OrderService")).toBe(
      "domain.order_service.OrderService",
    );
    expect(methodId("domain.order_service", "OrderService", "create_order")).toBe(
      "domain.order_service.OrderService.create_order",
    );
  });

  it("namespaces services and unresolved nodes", () => {
    expect(serviceId("stripe")).toBe("service:stripe");
    expect(isServiceId("service:stripe")).toBe(true);
    expect(serviceName("service:stripe")).toBe("stripe");
    expect(unresolvedId("reserve")).toBe("unresolved:reserve");
    expect(isUnresolvedId("unresolved:reserve")).toBe(true);
  });

  it("prettifies display names to the last two segments", () => {
    expect(displayNameFor("domain.order_service.OrderService.create_order", "function")).toBe(
      "OrderService.create_order",
    );
    expect(displayNameFor("domain.order_service", "module")).toBe("order_service");
    expect(displayNameFor("service:stripe", "service")).toBe("stripe");
  });
});

describe("collision handling", () => {
  it("returns the id first, then suffixes duplicates with #n", () => {
    const alloc = new IdAllocator();
    expect(alloc.allocate("a.b")).toBe("a.b");
    expect(alloc.allocate("a.b")).toBe("a.b#2");
    expect(alloc.allocate("a.b")).toBe("a.b#3");
    expect(alloc.allocate("a.c")).toBe("a.c");
    expect(alloc.collisions).toBe(2);
  });
});
