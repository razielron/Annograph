import requests
from codeviz import component


@component(layer="integration")
class WeatherClient:
    def fetch(self):
        # outbound HTTP with no @uses_service -> suspected undocumented integration
        return requests.get("https://example.com")
