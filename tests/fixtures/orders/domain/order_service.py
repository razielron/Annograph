from codeviz import component, contract, uses_service, entrypoint
from domain.inventory_service import InventoryService


@component(layer="domain", tags=["orders", "critical"])
class OrderService:
    def __init__(self, inventory: InventoryService):
        self.inventory = inventory

    @contract(input=CreateOrderRequest, output=Order, errors=["OutOfStock", "PaymentFailed"])
    @entrypoint(kind="http", path="POST /orders")
    def create_order(self, req: CreateOrderRequest) -> Order:
        self.inventory.reserve(req.items)
        self._charge(req.payment)

    @uses_service("stripe", op="charge")
    def _charge(self, p):
        ...
