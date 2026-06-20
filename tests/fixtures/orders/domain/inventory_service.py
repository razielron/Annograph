from codeviz import component


@component(layer="domain", tags=["inventory"])
class InventoryService:
    def reserve(self, items) -> bool:
        return True
