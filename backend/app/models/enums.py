from enum import Enum

class NFRCategory(str, Enum):
    PERFORMANCE = "Performance"
    SECURITY = "Security"
    RELIABILITY = "Reliability"
    FAIRNESS = "Fairness"
    USABILITY = "Usability"
    SCOPE = "Scope"
    SCALABILITY = "Scalability"
    COMPLIANCE = "Compliance"
    OTHER = "Other"

class RequirementPriority(str, Enum):
    MUST_HAVE = "Must Have"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"

class RequirementStatus(str, Enum):
    PENDING_CLARIFICATION = "PENDING_CLARIFICATION"
    RESOLVED = "RESOLVED"

class RequirementSource(str, Enum):
    RAW_DIALOGUE = "RAW_DIALOGUE"
    STAKEHOLDER_CLARIFICATION = "STAKEHOLDER_CLARIFICATION"
    AI_SUGGESTION = "AI_SUGGESTION"

class QualityTier(str, Enum):
    EXCELLENT = "Excellent"
    GOOD = "Good"
    MODERATE = "Moderate"
    POOR = "Poor"
    CRITICAL = "Critical"
