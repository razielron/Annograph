from codeviz import component, entrypoint
from domain.order_service import OrderService


@component(layer="presentation", tags=["http"])
class OrderController:
    def __init__(self, service: OrderService):
        self.service = service

    @entrypoint(kind="http", path="POST /api/orders")
    def post_order(self, req):
        return self.service.create_order(req)
