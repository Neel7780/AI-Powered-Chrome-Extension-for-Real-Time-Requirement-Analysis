from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
from .enums import NFRCategory, RequirementPriority, RequirementStatus, RequirementSource, QualityTier

# --- Core Meeting & Transcript Payloads ---

class Utterance(BaseModel):
    speaker: str = "Speaker"
    text: str
    timestamp: Optional[str] = None
    detectedFlags: Optional[List[Dict[str, Any]]] = None

class TranscriptPayload(BaseModel):
    transcript: Optional[Union[str, List[Dict[str, Any]]]] = None
    utterances: Optional[Union[str, List[Dict[str, Any]]]] = None
    domain: Optional[str] = "General Software"

class AmbiguityFlag(BaseModel):
    phrase: str
    category: str
    severity: str = "Medium"
    reason: str
    suggestedSLO: Optional[str] = None

class AmbiguityAnalysisResult(BaseModel):
    isAmbiguous: bool
    ambiguityScore: int = Field(ge=0, le=100)
    detectedFlags: List[AmbiguityFlag] = Field(default_factory=list)
    engine: str = "LangChain-Gemini"

# --- Clarification Payloads ---

class ClarificationQuestion(BaseModel):
    id: str = "CQ-01"
    category: str = "Performance"
    question: str
    triggeredBy: Optional[str] = None
    suggestedOptions: List[str] = Field(default_factory=list)
    options: Optional[List[str]] = None
    selectedResponse: Optional[str] = None
    provenance: Optional[str] = None

class ClarificationResponsePayload(BaseModel):
    clarificationId: str
    selectedResponse: str

class ClarifyRequest(BaseModel):
    transcript: Optional[Union[str, List[Dict[str, Any]]]] = None
    utterances: Optional[Union[str, List[Dict[str, Any]]]] = None
    existingClarifications: Optional[List[Dict[str, Any]]] = Field(default_factory=list)

class ClarifyResponse(BaseModel):
    analysis: Optional[str] = None
    ambiguities: List[AmbiguityFlag] = Field(default_factory=list)
    questions: List[ClarificationQuestion] = Field(default_factory=list)

# --- Requirement Payloads ---

class FunctionalRequirement(BaseModel):
    id: str
    title: str
    category: str = "Functional"
    description: str
    priority: str = "Must Have"
    status: RequirementStatus = RequirementStatus.PENDING_CLARIFICATION
    source: RequirementSource = RequirementSource.RAW_DIALOGUE
    sourceClarificationId: Optional[str] = None
    originalText: Optional[str] = None
    refinedText: Optional[str] = None
    stakeholderEvidence: Optional[str] = None
    acceptanceCriteria: List[str] = Field(default_factory=list)
    sourceStatement: Optional[str] = None
    clarificationReference: Optional[str] = None
    verificationMethod: Optional[str] = None
    ambiguityFlags: Optional[List[str]] = None

class NonFunctionalRequirement(BaseModel):
    id: str
    title: str
    category: str = "Performance"
    description: str
    priority: str = "Critical"
    status: RequirementStatus = RequirementStatus.PENDING_CLARIFICATION
    source: RequirementSource = RequirementSource.RAW_DIALOGUE
    sourceClarificationId: Optional[str] = None
    originalText: Optional[str] = None
    refinedText: Optional[str] = None
    stakeholderEvidence: Optional[str] = None
    targetThreshold: Optional[str] = None
    metric: Optional[str] = None
    acceptanceCriteria: List[str] = Field(default_factory=list)
    sourceStatement: Optional[str] = None
    clarificationReference: Optional[str] = None
    verificationMethod: Optional[str] = None
    ambiguityFlags: Optional[List[str]] = None

class RequirementSet(BaseModel):
    frs: List[FunctionalRequirement] = Field(default_factory=list)
    nfrs: List[NonFunctionalRequirement] = Field(default_factory=list)

class RefinementPayload(BaseModel):
    transcript: Optional[Union[str, List[Dict[str, Any]]]] = None
    utterances: Optional[Union[str, List[Dict[str, Any]]]] = None
    questions: Optional[List[Union[str, Dict[str, Any]]]] = Field(default_factory=list)
    responses: Optional[List[Union[str, Dict[str, Any]]]] = Field(default_factory=list)
    clarifications: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    domain: Optional[str] = "General Software"

class RefinementResult(BaseModel):
    baseline: RequirementSet
    refined: RequirementSet
    clarifications: List[ClarificationQuestion] = Field(default_factory=list)
    metrics: Optional[Dict[str, Any]] = None
    evaluation: Optional[Dict[str, Any]] = None

# --- Quality Metrics Payloads ---

class QualityDimension(BaseModel):
    score: int = Field(ge=0, le=100)
    label: str
    description: str

class QualityEvaluation(BaseModel):
    overallQualityIndex: int = Field(ge=0, le=100)
    qualityTier: QualityTier = QualityTier.MODERATE
    standardAlignment: str = "Informed by ISO/IEC/IEEE 29148 Principles"
    disclaimer: str = "Demo Simulation — Stakeholder responses are simulated to demonstrate clarification."
    metrics: Dict[str, QualityDimension]
    rawCounts: Dict[str, Any]

class ComparisonDelta(BaseModel):
    oqiImprovement: int
    percentImprovement: Optional[float]
    ambiguityReduction: int
    testabilityGain: int
    specificityGain: int
    completenessGain: int
    traceabilityGain: int

class ComparisonPayload(BaseModel):
    baseline: Union[str, Dict[str, Any], RequirementSet]
    refined: Union[str, Dict[str, Any], RequirementSet]

class ComparisonResult(BaseModel):
    baseline: Optional[QualityEvaluation] = None
    refined: Optional[QualityEvaluation] = None
    baseline_metrics: Optional[QualityEvaluation] = None
    refined_metrics: Optional[QualityEvaluation] = None
    delta: ComparisonDelta
    qualitativeNotes: Optional[str] = None

# --- Export Payloads ---

class ExportPayload(BaseModel):
    title: Optional[str] = "AI-Powered Requirement Analysis & Quality Report"
    transcript: Optional[Union[str, List[Dict[str, Any]]]] = None
    utterances: Optional[Union[str, List[Dict[str, Any]]]] = None
    clarifications: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    baseline: Optional[Union[Dict[str, Any], RequirementSet, str]] = None
    refined: Optional[Union[Dict[str, Any], RequirementSet, str]] = None
    evaluation: Optional[Dict[str, Any]] = None
