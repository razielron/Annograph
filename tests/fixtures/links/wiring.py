from codeviz import component, link


@component(layer="domain")
class Handler:
    # DI-wired dependency that static analysis cannot see; bridged via @link.
    # The first link resolves; the second is intentionally dangling.
    @link("wiring.Worker.process", kind="calls")
    @link("wiring.DoesNotExist.method", kind="calls")
    def handle(self):
        ...


@component(layer="domain")
class Worker:
    def process(self):
        ...
