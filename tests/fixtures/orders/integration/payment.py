from codeviz import component, pattern


@component(layer="integration")
@pattern("strategy", role="concrete")
class StripeMethod:
    def pay(self, amount):
        ...
