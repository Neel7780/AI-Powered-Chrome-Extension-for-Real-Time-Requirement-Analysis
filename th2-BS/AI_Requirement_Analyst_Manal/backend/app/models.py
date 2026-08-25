from typing import List
from pydantic import BaseModel, Field

class TranscriptPayload(BaseModel):
    transcript: str = Field(min_length=1)

class RefinementPayload(BaseModel):
    transcript: str = Field(min_length=1)
    questions: List[str] = Field(default_factory=list)
    responses: List[str] = Field(default_factory=list)

class ComparisonPayload(BaseModel):
    baseline: str = Field(min_length=1)
    refined: str = Field(min_length=1)

class ExportPayload(BaseModel):
    baseline: str = ""
    questions: List[str] = Field(default_factory=list)
    responses: List[str] = Field(default_factory=list)
    refined: str = ""
    evaluation: str = ""
