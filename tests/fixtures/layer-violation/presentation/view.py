from codeviz import component
from data.repo import Repo


@component(layer="presentation")
class View:
    def __init__(self, repo: Repo):
        self.repo = repo

    def show(self):
        # presentation reaching straight into data, skipping domain -> violation
        return self.repo.fetch()
