from pydantic import BaseModel


class SearchResult(BaseModel):
    type: str  # task, project, document, comment
    id: str
    title: str
    snippet: str | None = None
    project_name: str | None = None
    status: str | None = None
    score: float = 0.0


class SearchResults(BaseModel):
    results: list[SearchResult]
    total: int
    query: str
