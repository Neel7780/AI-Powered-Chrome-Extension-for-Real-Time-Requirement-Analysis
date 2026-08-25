import re
from typing import List, Dict, Any, Union, Optional, Tuple
from ..models.schemas import (
    FunctionalRequirement, NonFunctionalRequirement, RequirementSet,
    ClarificationQuestion, RequirementStatus, RequirementSource
)

class RequirementEngine:
    def __init__(self) -> None:
        pass

    def _normalize_clarifications(self, clarifications: List[Union[Dict[str, Any], ClarificationQuestion]]) -> List[Dict[str, Any]]:
        normalized = []
        for c in clarifications:
            if isinstance(c, ClarificationQuestion):
                normalized.append(c.model_dump())
            elif isinstance(c, dict):
                normalized.append(c)
        return normalized

    def _normalize_utterances(self, utterances: Union[str, List[Union[Dict[str, Any], str]]]) -> List[Dict[str, Any]]:
        if isinstance(utterances, str):
            lines = [l.strip() for l in utterances.splitlines() if l.strip()]
            return [{"speaker": "Speaker", "text": line} for line in lines]
        
        normalized = []
        for u in utterances:
            if isinstance(u, str):
                normalized.append({"speaker": "Speaker", "text": u})
            elif isinstance(u, dict):
                normalized.append(u)
        return normalized

    def generate_requirements(
        self,
        utterances_raw: Union[str, List[Any]],
        clarifications_raw: Optional[List[Any]] = None,
        domain: str = "HR Tech"
    ) -> Tuple[RequirementSet, RequirementSet]:
        """
        Generates both Baseline and Response-Driven Refined RequirementSets.
        """
        utterances = self._normalize_utterances(utterances_raw)
        clarifications = self._normalize_clarifications(clarifications_raw or [])
        
        is_hr_domain = bool(
            re.search(r"\b(hr|recruiting|hiring|talent|resume|candidate|human resources)\b", domain, re.I) or
            any(re.search(r"\b(resume|candidate|hr|recruiter|ranking)\b", u.get("text", ""), re.I) for u in utterances)
        )

        if is_hr_domain:
            baseline = self._generate_hr_baseline(utterances)
            refined = self._generate_hr_refined(utterances, clarifications)
        else:
            baseline = self._generate_generic_baseline(utterances, domain)
            refined = self._generate_generic_refined(utterances, clarifications, domain)

        return baseline, refined

    # --- HR Tech Scenario Generators ---

    def _generate_hr_baseline(self, utterances: List[Dict[str, Any]]) -> RequirementSet:
        """
        Baseline Requirements (WITHOUT stakeholder clarification).
        Retains raw vagueness, 0% testability, 100% ambiguity.
        """
        frs = [
            FunctionalRequirement(
                id="FR-01",
                title="Resume Ingestion Pipeline (Unspecified Data Contract)",
                category="Functional",
                description="The system shall ingest past resumes and hiring data (data formats, size limits, and parsing schema unclarified).",
                priority="High",
                status=RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.RAW_DIALOGUE,
                originalText="We have past resumes and hiring decisions, but they're not very structured.",
                refinedText="Resume ingestion data contract pending stakeholder decision.",
                acceptanceCriteria=["System accepts resume files"],
                sourceStatement="We have past resumes and hiring decisions, but they're not very structured.",
                ambiguityFlags=["Data formats (PDF/DOCX/OCR) and JSON parsing schema unresolved"]
            ),
            FunctionalRequirement(
                id="FR-02",
                title="Candidate Scoring & Ranking Engine (Unspecified Weighting)",
                category="Functional",
                description="The system shall rank candidates based on relevance, skills, and overall profile strength (exact scoring weights pending clarification).",
                priority="High",
                status=RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.RAW_DIALOGUE,
                originalText="Mainly skills and experience. And overall profile strength. Things like good companies, solid projects...",
                refinedText="Candidate ranking weighting formula pending stakeholder input.",
                acceptanceCriteria=["Candidates are ranked"],
                sourceStatement="Mainly skills and experience. And overall profile strength.",
                ambiguityFlags=["'Good companies', 'solid projects', and fresher weighting formula unresolved"]
            ),
            FunctionalRequirement(
                id="FR-03",
                title="Explainability & Match Insights (Unspecified Presentation Schema)",
                category="Functional",
                description="The system shall provide useful explainability for hiring decisions (presentation format and schema unclarified).",
                priority="Medium",
                status=RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.RAW_DIALOGUE,
                originalText="Do we need explainability? / Yes, that would be useful.",
                refinedText="Explainability presentation schema pending recruiter preference.",
                acceptanceCriteria=["System provides some explanation"],
                sourceStatement="Do we need explainability? Yes, that would be useful.",
                ambiguityFlags=["'Useful' explainability format unquantified"]
            ),
            FunctionalRequirement(
                id="FR-04",
                title="Role-Based Recruiter Access (Baseline)",
                category="Functional",
                description="The system shall allow authorized hiring managers and HR recruiters to submit job descriptions and review candidate shortlists.",
                priority="High",
                status=RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.RAW_DIALOGUE,
                originalText="We need to build an AI-based resume analyzer... We want it to take resumes and rank them based on relevance to a job description.",
                refinedText="Authorized HR recruiters can create JDs and view ranked candidates.",
                acceptanceCriteria=["Recruiter can log in and submit JD"],
                sourceStatement="We need to build an AI-based resume analyzer.",
                verificationMethod=None
            )
        ]

        nfrs = [
            NonFunctionalRequirement(
                id="NFR-PERF-01",
                title="Processing Latency & Response Time",
                category="Performance",
                description="The system shouldn't be slow and response time per resume should ideally be quick.",
                priority="High",
                status=RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.RAW_DIALOGUE,
                originalText="It shouldn't be slow. / Ideally quick.",
                refinedText="System processing time should be quick (pending latency SLO).",
                targetThreshold="Unspecified - Awaiting Stakeholder Clarification",
                metric="Awaiting measurable latency threshold",
                acceptanceCriteria=["System feels responsive"],
                sourceStatement="It shouldn't be slow. Ideally quick.",
                ambiguityFlags=["'Not slow' and 'quick' are unmeasurable subjective predicates"]
            ),
            NonFunctionalRequirement(
                id="NFR-FAIR-01",
                title="Fairness & Demographic Bias Mitigation",
                category="Fairness",
                description="The system must avoid bias, especially related to gender or college background.",
                priority="Critical",
                status=RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.RAW_DIALOGUE,
                originalText="Yes, we must avoid bias, especially related to gender or college background.",
                refinedText="Avoid demographic bias (pending Disparate Impact threshold).",
                targetThreshold="Unspecified - Awaiting Stakeholder Clarification",
                metric="Awaiting Disparate Impact Ratio / Parity Metric",
                acceptanceCriteria=["System does not show obvious bias"],
                sourceStatement="Yes, we must avoid bias, especially related to gender or college background.",
                ambiguityFlags=["'Avoid bias' lacks concrete mathematical threshold (e.g. 0.80 - 1.25 DIR)"]
            ),
            NonFunctionalRequirement(
                id="NFR-ACC-01",
                title="Candidate Matching Quality & Accuracy",
                category="Accuracy",
                description="The candidate match quality should be good enough so that HR trusts it.",
                priority="High",
                status=RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.RAW_DIALOGUE,
                originalText="It should be good enough so that HR trusts it.",
                refinedText="Matching quality good enough for HR trust (pending Precision/NDCG benchmark).",
                targetThreshold="Unspecified - Awaiting Stakeholder Clarification",
                metric="Awaiting quantitative accuracy benchmark",
                acceptanceCriteria=["HR agrees matches are reasonable"],
                sourceStatement="It should be good enough so that HR trusts it.",
                ambiguityFlags=["'Good enough' and 'HR trust' are subjective without validation dataset"]
            ),
            NonFunctionalRequirement(
                id="NFR-SCOPE-01",
                title="Delivery Timeline & MVP Scope",
                category="Scope",
                description="The project team needs to deliver an MVP soon.",
                priority="Medium",
                status=RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.RAW_DIALOGUE,
                originalText="We need an MVP soon.",
                refinedText="MVP delivery expected soon (pending target date).",
                targetThreshold="Unspecified - Awaiting Stakeholder Clarification",
                metric="Awaiting sprint deadline commitment",
                acceptanceCriteria=["MVP is delivered"],
                sourceStatement="We need an MVP soon.",
                ambiguityFlags=["'Soon' is an undefined timeline"]
            ),
            NonFunctionalRequirement(
                id="NFR-SEC-01",
                title="Candidate PII Protection & Data Privacy",
                category="Security",
                description="Candidate personally identifiable information (PII) must be stored and processed securely.",
                priority="Critical",
                status=RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.RAW_DIALOGUE,
                originalText="Candidate resumes contain personal contact information.",
                refinedText="PII stored securely (pending formal encryption baseline).",
                targetThreshold="Unspecified - Awaiting Security Baseline",
                metric="Awaiting security criteria",
                acceptanceCriteria=["PII handled securely"],
                sourceStatement="Candidate resumes contain personal contact information.",
                verificationMethod=None
            ),
            NonFunctionalRequirement(
                id="NFR-USAB-01",
                title="Recruiter Interface Usability",
                category="Usability",
                description="The recruiter dashboard interface shall be intuitive for HR talent acquisition specialists.",
                priority="Medium",
                status=RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.RAW_DIALOGUE,
                originalText="HR recruiters will use this dashboard daily.",
                refinedText="Interface usability (pending formal usability criteria).",
                targetThreshold="Unspecified - Awaiting Usability Benchmark",
                metric="Awaiting usability criteria",
                acceptanceCriteria=["Recruiters can use dashboard"],
                sourceStatement="HR recruiters will use this dashboard daily.",
                verificationMethod=None
            )
        ]

        return RequirementSet(frs=frs, nfrs=nfrs)

    def _generate_hr_refined(self, utterances: List[Dict[str, Any]], clarifications: List[Dict[str, Any]]) -> RequirementSet:
        """
        Response-Driven Refinement.
        Uses Authoritative Two-Pass Slot Resolver (perf, fair, acc, exp, rel, data, scope).
        """
        matched_slots: Dict[str, Dict[str, Any]] = {}

        def get_response_text(c: Dict[str, Any]) -> str:
            val = c.get("selectedResponse") or c.get("response") or ""
            return val.strip() if isinstance(val, str) else ""

        # Priority slot definitions
        slot_defs = [
            ("perf", r"perf|latency|speed|slow|quick|fast|response"),
            ("fair", r"fair|bias|gender|college|demographic"),
            ("acc",  r"acc|trust|good enough|precision|relevance"),
            ("exp",  r"exp|scorecard|breakdown|justification|why|useful"),
            ("rel",  r"rank|scoring|formula|fresher|weight|solid|projects"),
            ("data", r"data|resume|format|structured|pdf|docx|ingest"),
            ("scope", r"scope|mvp|timeline|soon|deadline|deliver")
        ]

        def resolve_pass(extractor_fn):
            for c in clarifications:
                resp = get_response_text(c)
                if not resp:
                    continue
                key_text = extractor_fn(c)
                for slot_name, pattern in slot_defs:
                    if slot_name in matched_slots:
                        continue
                    if re.search(pattern, key_text, re.I):
                        matched_slots[slot_name] = c
                        break

        # Pass 1: Authoritative question ID / Category matching
        resolve_pass(lambda c: f"{c.get('id', '')} {c.get('category', '')}".lower())
        # Pass 2: Triggered statement matching
        resolve_pass(lambda c: (c.get("triggeredBy") or "").lower())

        def find_slot_answer(slot_key: str) -> Dict[str, Any]:
            c = matched_slots.get(slot_key)
            if not c:
                return {"answered": False, "text": None, "clarificationId": None}
            resp = get_response_text(c)
            return {
                "answered": len(resp) > 0,
                "text": resp if len(resp) > 0 else None,
                "clarificationId": c.get("id") or "CQ-CONFIRMED"
            }

        perf = find_slot_answer("perf")
        fair = find_slot_answer("fair")
        acc = find_slot_answer("acc")
        exp = find_slot_answer("exp")
        rel = find_slot_answer("rel")
        data = find_slot_answer("data")
        scope = find_slot_answer("scope")

        # Synthesize Functional Requirements
        frs = [
            # FR-01: Resume Ingestion Pipeline
            FunctionalRequirement(
                id="FR-01",
                title="Resume Ingestion & Parsing Engine",
                category="Functional",
                description=f"The system shall ingest resumes in PDF and DOCX formats (up to 10MB per file) and parse text into structured JSON schemas as specified by stakeholder: {data['text']}." if data["answered"] else "The system shall ingest past resumes and hiring data (data format and parsing pipeline pending stakeholder clarification).",
                priority="Must Have",
                status=RequirementStatus.RESOLVED if data["answered"] else RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.STAKEHOLDER_CLARIFICATION if data["answered"] else RequirementSource.RAW_DIALOGUE,
                sourceClarificationId=data["clarificationId"],
                originalText="We have past resumes and hiring decisions, but they're not very structured.",
                refinedText=f"The system shall ingest PDF/DOCX (up to 10MB) into validated JSON schemas compliant with: {data['text']}." if data["answered"] else "Resume ingestion data contract pending stakeholder decision.",
                stakeholderEvidence=data["text"],
                acceptanceCriteria=[
                    "Given a valid PDF or DOCX resume under 10MB, When uploaded, Then the system extracts text and generates valid structured JSON.",
                    "Given a corrupted or unsupported file type, When uploaded, Then the system returns an informative HTTP 422 error."
                ] if data["answered"] else ["System accepts resume files"],
                sourceStatement="We have past resumes and hiring decisions, but they're not very structured.",
                clarificationReference=f"Clarification #{data['clarificationId']}: '{data['text']}'" if data["answered"] else None,
                verificationMethod="Automated Integration Test & JSON Schema Validation" if data["answered"] else None,
                ambiguityFlags=None if data["answered"] else ["Data formats (PDF/DOCX/OCR) and JSON parsing schema unresolved"]
            ),

            # FR-02: Candidate Scoring Engine
            FunctionalRequirement(
                id="FR-02",
                title="Deterministic Multi-Factor Candidate Scoring Engine",
                category="Functional",
                description=f"The system shall calculate composite candidate relevance scores using stakeholder-defined weighting: {rel['text']}." if rel["answered"] else "The system shall rank candidates based on relevance, skills, and overall profile strength (exact scoring weights pending clarification).",
                priority="Must Have",
                status=RequirementStatus.RESOLVED if rel["answered"] else RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.STAKEHOLDER_CLARIFICATION if rel["answered"] else RequirementSource.RAW_DIALOGUE,
                sourceClarificationId=rel["clarificationId"],
                originalText="Mainly skills and experience. And overall profile strength. Things like good companies, solid projects...",
                refinedText=f"The system shall execute candidate ranking using multi-factor formula: {rel['text']}." if rel["answered"] else "Candidate ranking weighting formula pending stakeholder input.",
                stakeholderEvidence=rel["text"],
                acceptanceCriteria=[
                    "Given a job description and candidate profile, When scored, Then the final score strictly follows the stakeholder weighting formula.",
                    "Given an exceptional fresher with high project complexity, When ranked against generic experience, Then the fresher outranks when composite score is higher."
                ] if rel["answered"] else ["Candidates are ranked"],
                sourceStatement="It should rank them based on relevance... Sometimes a strong fresher is better than someone with 5 average years.",
                clarificationReference=f"Clarification #{rel['clarificationId']}: '{rel['text']}'" if rel["answered"] else None,
                verificationMethod="Unit Test & Ranking Algorithm Regression Suite" if rel["answered"] else None,
                ambiguityFlags=None if rel["answered"] else ["'Good companies', 'solid projects', and fresher weighting formula unresolved"]
            ),

            # FR-03: Structured Explainability & Match Scorecard
            FunctionalRequirement(
                id="FR-03",
                title="Structured Explainability & Match Scorecard",
                category="Functional",
                description=f"The system shall generate an interactive candidate match scorecard satisfying stakeholder preference: {exp['text']}." if exp["answered"] else "The system shall provide useful explainability for hiring decisions (presentation format and schema unclarified).",
                priority="Must Have",
                status=RequirementStatus.RESOLVED if exp["answered"] else RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.STAKEHOLDER_CLARIFICATION if exp["answered"] else RequirementSource.RAW_DIALOGUE,
                sourceClarificationId=exp["clarificationId"],
                originalText="Do we need explainability? / Yes, that would be useful.",
                refinedText=f"The system shall provide recruiter match scorecards based on: {exp['text']}." if exp["answered"] else "Explainability presentation schema pending recruiter preference.",
                stakeholderEvidence=exp["text"],
                acceptanceCriteria=[
                    "Given a shortlisted candidate, When viewed in the UI, Then the system displays matched skills %, project complexity score, and top 3 justification reasons.",
                    "Given recruiter requests match explanation, When requested, Then the explanation payload renders in < 500ms."
                ] if exp["answered"] else ["System provides some explanation"],
                sourceStatement="Do we need explainability? Yes, that would be useful.",
                clarificationReference=f"Clarification #{exp['clarificationId']}: '{exp['text']}'" if exp["answered"] else None,
                verificationMethod="UI Component Test & API Contract Validation" if exp["answered"] else None,
                ambiguityFlags=None if exp["answered"] else ["'Useful' explainability format unquantified"]
            ),

            # FR-04: Role-Based Recruiter Access
            FunctionalRequirement(
                id="FR-04",
                title="Role-Based Recruiter & Hiring Manager Dashboard",
                category="Functional",
                description="The system shall provide secure role-based portals for HR Recruiters and Hiring Managers to upload job descriptions, trigger bulk resume scoring, and export shortlists.",
                priority="Must Have",
                status=RequirementStatus.RESOLVED,
                source=RequirementSource.RAW_DIALOGUE,
                originalText="We need to build an AI-based resume analyzer.",
                refinedText="The system shall provide role-based access for recruiter workflow execution.",
                stakeholderEvidence="Directly derived from core meeting objective.",
                acceptanceCriteria=[
                    "Given authenticated recruiter, When uploading JD, Then analysis job is dispatched.",
                    "Given unauthorized user, When accessing dashboard, Then HTTP 403 Forbidden is returned."
                ],
                sourceStatement="We need to build an AI-based resume analyzer.",
                verificationMethod="Automated Security & End-to-End Workflow Test"
            )
        ]

        # Synthesize Non-Functional Requirements
        nfrs = [
            # NFR-PERF-01: Processing Latency
            NonFunctionalRequirement(
                id="NFR-PERF-01",
                title="Resume Parsing & Ranking Latency SLO",
                category="Performance",
                description=f"The system shall meet latency SLO: {perf['text']}." if perf["answered"] else "The system shouldn't be slow and response time per resume should ideally be quick.",
                priority="Critical" if perf["answered"] else "High",
                status=RequirementStatus.RESOLVED if perf["answered"] else RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.STAKEHOLDER_CLARIFICATION if perf["answered"] else RequirementSource.RAW_DIALOGUE,
                sourceClarificationId=perf["clarificationId"],
                originalText="It shouldn't be slow. / Ideally quick.",
                refinedText=f"The system shall meet latency SLO: {perf['text']}." if perf["answered"] else "Processing latency pending stakeholder SLO.",
                stakeholderEvidence=perf["text"],
                targetThreshold=perf["text"] if perf["answered"] else "Unspecified - Awaiting Stakeholder Clarification",
                metric=perf["text"] if perf["answered"] else "Awaiting measurable latency threshold",
                acceptanceCriteria=[
                    f"Given a single resume upload, When processed, Then 95% of requests complete within the confirmed threshold ({perf['text']}).",
                    "Given concurrent load of 50 users, When batch ranking 100 resumes, Then system completes within specified SLA without degradation."
                ] if perf["answered"] else ["System feels responsive"],
                sourceStatement="It shouldn't be slow. Ideally quick.",
                clarificationReference=f"Clarification #{perf['clarificationId']}: '{perf['text']}'" if perf["answered"] else None,
                verificationMethod="Automated Load Benchmark (k6/Locust) & Datadog APM Tracing" if perf["answered"] else None,
                ambiguityFlags=None if perf["answered"] else ["'Not slow' and 'quick' are unmeasurable subjective predicates"]
            ),

            # NFR-FAIR-01: Fairness & Bias Mitigation
            NonFunctionalRequirement(
                id="NFR-FAIR-01",
                title="Demographic Fairness & Disparate Impact Compliance",
                category="Fairness",
                description=f"The ranking algorithm shall enforce demographic fairness standard: {fair['text']}." if fair["answered"] else "The system must avoid bias, especially related to gender or college background.",
                priority="Critical",
                status=RequirementStatus.RESOLVED if fair["answered"] else RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.STAKEHOLDER_CLARIFICATION if fair["answered"] else RequirementSource.RAW_DIALOGUE,
                sourceClarificationId=fair["clarificationId"],
                originalText="Yes, we must avoid bias, especially related to gender or college background.",
                refinedText=f"The ranking algorithm shall enforce demographic fairness standard: {fair['text']}." if fair["answered"] else "Fairness criteria pending stakeholder Disparate Impact threshold.",
                stakeholderEvidence=fair["text"],
                targetThreshold=fair["text"] if fair["answered"] else "Unspecified - Awaiting Stakeholder Clarification",
                metric=fair["text"] if fair["answered"] else "Awaiting Disparate Impact Ratio",
                acceptanceCriteria=[
                    f"Given synthetic benchmark dataset across gender and college tiers, When evaluated, Then Disparate Impact Ratio satisfies confirmed threshold ({fair['text']}).",
                    "Given resume text, When ingested, Then candidate name, gender indicators, and college name are masked before model inference."
                ] if fair["answered"] else ["System does not show obvious bias"],
                sourceStatement="Yes, we must avoid bias, especially related to gender or college background.",
                clarificationReference=f"Clarification #{fair['clarificationId']}: '{fair['text']}'" if fair["answered"] else None,
                verificationMethod="Automated Fairness Audit Suite (AIF360/Fairlearn) & PII Redaction Test" if fair["answered"] else None,
                ambiguityFlags=None if fair["answered"] else ["'Avoid bias' lacks concrete mathematical threshold (e.g. 0.80 - 1.25 DIR)"]
            ),

            # NFR-ACC-01: Candidate Matching Accuracy Benchmark
            NonFunctionalRequirement(
                id="NFR-ACC-01",
                title="Candidate Matching Accuracy & HR Trust Benchmark",
                category="Accuracy",
                description=f"The candidate shortlisting model shall achieve accuracy benchmark: {acc['text']}." if acc["answered"] else "The candidate match quality should be good enough so that HR trusts it.",
                priority="Critical" if acc["answered"] else "High",
                status=RequirementStatus.RESOLVED if acc["answered"] else RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.STAKEHOLDER_CLARIFICATION if acc["answered"] else RequirementSource.RAW_DIALOGUE,
                sourceClarificationId=acc["clarificationId"],
                originalText="It should be good enough so that HR trusts it.",
                refinedText=f"The candidate shortlisting model shall achieve accuracy benchmark: {acc['text']}." if acc["answered"] else "Accuracy benchmark pending stakeholder precision metrics.",
                stakeholderEvidence=acc["text"],
                targetThreshold=acc["text"] if acc["answered"] else "Unspecified - Awaiting Stakeholder Clarification",
                metric=acc["text"] if acc["answered"] else "Awaiting quantitative accuracy benchmark",
                acceptanceCriteria=[
                    f"Given a gold standard dataset of 500 validated hiring decisions, When evaluated, Then the model satisfies confirmed benchmark ({acc['text']}).",
                    "Given candidate ranking output, When compared with expert recruiter rankings, Then Spearman rank correlation exceeds 0.80."
                ] if acc["answered"] else ["HR agrees matches are reasonable"],
                sourceStatement="It should be good enough so that HR trusts it.",
                clarificationReference=f"Clarification #{acc['clarificationId']}: '{acc['text']}'" if acc["answered"] else None,
                verificationMethod="Offline Evaluation Benchmark & Human Recruiter Ground-Truth Test Set" if acc["answered"] else None,
                ambiguityFlags=None if acc["answered"] else ["'Good enough' and 'HR trust' are subjective without validation dataset"]
            ),

            # NFR-SCOPE-01: Delivery Milestone
            NonFunctionalRequirement(
                id="NFR-SCOPE-01",
                title="Committed MVP Release Milestone",
                category="Scope",
                description=f"The project engineering team shall deliver the validated MVP deliverable compliant with: {scope['text']}." if scope["answered"] else "The project team needs to deliver an MVP soon.",
                priority="High" if scope["answered"] else "Medium",
                status=RequirementStatus.RESOLVED if scope["answered"] else RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.STAKEHOLDER_CLARIFICATION if scope["answered"] else RequirementSource.RAW_DIALOGUE,
                sourceClarificationId=scope["clarificationId"],
                originalText="We need an MVP soon.",
                refinedText=f"The project team shall deliver the MVP according to confirmed milestone: {scope['text']}." if scope["answered"] else "Delivery milestone pending committed calendar deadline.",
                stakeholderEvidence=scope["text"],
                targetThreshold=scope["text"] if scope["answered"] else "Unspecified - Awaiting Stakeholder Clarification",
                metric=scope["text"] if scope["answered"] else "Awaiting sprint deadline commitment",
                acceptanceCriteria=[
                    f"Given milestone schedule ({scope['text']}), When sprint concludes, Then all Must-Have FRs and Critical NFRs are validated and deployed.",
                    "Given release candidate, When audited, Then all automated test suites pass with 100% coverage."
                ] if scope["answered"] else ["MVP is delivered"],
                sourceStatement="We need an MVP soon.",
                clarificationReference=f"Clarification #{scope['clarificationId']}: '{scope['text']}'" if scope["answered"] else None,
                verificationMethod="Sprint Milestone Verification & Release Checklist Sign-off" if scope["answered"] else None,
                ambiguityFlags=None if scope["answered"] else ["'Soon' is an undefined timeline"]
            ),

            # NFR-SEC-01: PII Protection
            NonFunctionalRequirement(
                id="NFR-SEC-01",
                title="Candidate PII Protection & Data Privacy",
                category="Security",
                description="Candidate personally identifiable information (PII) must be stored with AES-256 encryption at rest and TLS 1.3 in transit.",
                priority="Critical",
                status=RequirementStatus.RESOLVED,
                source=RequirementSource.RAW_DIALOGUE,
                originalText="Candidate resumes contain personal contact information.",
                refinedText="PII stored securely with AES-256 encryption at rest and TLS 1.3 in transit.",
                targetThreshold="AES-256 encryption at rest, TLS 1.3 in transit, GDPR Article 32 compliant",
                metric="100% encrypted candidate datastore",
                acceptanceCriteria=[
                    "Given candidate resume upload, When stored in database, Then PII fields are encrypted with AES-256.",
                    "Given API communication, When data is in transit, Then TLS 1.3 is enforced."
                ],
                sourceStatement="Candidate resumes contain personal contact information.",
                verificationMethod="Automated Security & Encryption Audit"
            ),

            # NFR-USAB-01: Recruiter Usability
            NonFunctionalRequirement(
                id="NFR-USAB-01",
                title="Recruiter Interface Usability Benchmark",
                category="Usability",
                description="The recruiter dashboard interface shall achieve System Usability Scale (SUS) score >= 80.0.",
                priority="Medium",
                status=RequirementStatus.RESOLVED,
                source=RequirementSource.RAW_DIALOGUE,
                originalText="HR recruiters will use this dashboard daily.",
                refinedText="Interface usability compliant with System Usability Scale (SUS) score >= 80.0.",
                targetThreshold="System Usability Scale (SUS) >= 80.0",
                metric="SUS Usability Benchmark",
                acceptanceCriteria=[
                    "Given first-time recruiter user, When evaluating candidate shortlist, Then task completion occurs in < 3 minutes without formal training.",
                    "Given usability evaluation with 10 HR users, When scored, Then average SUS score exceeds 80.0."
                ],
                sourceStatement="HR recruiters will use this dashboard daily.",
                verificationMethod="User Usability Testing"
            )
        ]

        return RequirementSet(frs=frs, nfrs=nfrs)

    # --- Generic Domain Generators ---

    def _generate_generic_baseline(self, utterances: List[Dict[str, Any]], domain: str) -> RequirementSet:
        frs = [
            FunctionalRequirement(
                id="FR-GEN-01",
                title=f"{domain} Workflow Execution (Baseline)",
                category="Functional",
                description=f"The system shall support core {domain} operational workflows as discussed in the meeting.",
                priority="High",
                status=RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.RAW_DIALOGUE,
                originalText=utterances[0].get("text", "") if utterances else "Meeting statement",
                refinedText="Core workflow pending clarification.",
                acceptanceCriteria=["Workflow can be initiated"],
                sourceStatement=utterances[0].get("text", "") if utterances else "Meeting statement",
                ambiguityFlags=["Operational parameters and validation rules unclarified"]
            )
        ]
        nfrs = [
            NonFunctionalRequirement(
                id="NFR-GEN-01",
                title="System Operational Performance (Baseline)",
                category="Performance",
                description="The system should perform reliably without noticeable lag.",
                priority="High",
                status=RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.RAW_DIALOGUE,
                originalText="System should be fast and reliable.",
                refinedText="Performance SLA pending stakeholder clarification.",
                targetThreshold="Unspecified - Awaiting Stakeholder Clarification",
                metric="Awaiting measurable latency threshold",
                acceptanceCriteria=["System responds in timely manner"],
                sourceStatement="System should be fast and reliable.",
                ambiguityFlags=["'Fast' and 'reliable' are unquantified"]
            )
        ]
        return RequirementSet(frs=frs, nfrs=nfrs)

    def _generate_generic_refined(self, utterances: List[Dict[str, Any]], clarifications: List[Dict[str, Any]], domain: str) -> RequirementSet:
        answered = [c for c in clarifications if (c.get("selectedResponse") or c.get("response") or "").strip()]
        first_answered = answered[0] if answered else None
        
        frs = [
            FunctionalRequirement(
                id="FR-GEN-01",
                title=f"{domain} Core Workflow Engine",
                category="Functional",
                description=f"The system shall execute validated {domain} workflow according to established stakeholder requirements: {first_answered['selectedResponse']}." if first_answered else f"The system shall support core {domain} operational workflows.",
                priority="Must Have",
                status=RequirementStatus.RESOLVED if first_answered else RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.STAKEHOLDER_CLARIFICATION if first_answered else RequirementSource.RAW_DIALOGUE,
                sourceClarificationId=first_answered.get("id") if first_answered else None,
                originalText=utterances[0].get("text", "") if utterances else "Meeting statement",
                refinedText=f"Core workflow implementation for {domain}: {first_answered['selectedResponse']}." if first_answered else "Core workflow pending clarification.",
                stakeholderEvidence=first_answered.get("selectedResponse") if first_answered else None,
                acceptanceCriteria=[
                    "Given valid domain input, When processed, Then verified output schema is generated.",
                    "Given invalid input, When received, Then structured HTTP 400 error is returned."
                ] if first_answered else ["Workflow can be initiated"],
                sourceStatement=utterances[0].get("text", "") if utterances else "Meeting statement",
                clarificationReference=f"Clarification #{first_answered.get('id')}: '{first_answered.get('selectedResponse')}'" if first_answered else None,
                verificationMethod="Automated Integration Test Suite" if first_answered else None,
                ambiguityFlags=None if first_answered else ["Operational parameters and validation rules unclarified"]
            )
        ]

        nfrs = [
            NonFunctionalRequirement(
                id="NFR-GEN-01",
                title=f"{domain} Performance SLA",
                category="Performance",
                description=f"The system shall meet latency and reliability target: {first_answered['selectedResponse']}." if first_answered else "The system should perform reliably without noticeable lag.",
                priority="Critical" if first_answered else "High",
                status=RequirementStatus.RESOLVED if first_answered else RequirementStatus.PENDING_CLARIFICATION,
                source=RequirementSource.STAKEHOLDER_CLARIFICATION if first_answered else RequirementSource.RAW_DIALOGUE,
                sourceClarificationId=first_answered.get("id") if first_answered else None,
                originalText="System should be fast and reliable.",
                refinedText=f"The system shall meet performance SLA: {first_answered['selectedResponse']}." if first_answered else "Performance SLA pending stakeholder clarification.",
                stakeholderEvidence=first_answered.get("selectedResponse") if first_answered else None,
                targetThreshold=first_answered.get("selectedResponse") if first_answered else "Unspecified - Awaiting Stakeholder Clarification",
                metric=first_answered.get("selectedResponse") if first_answered else "Awaiting measurable latency threshold",
                acceptanceCriteria=[
                    "Given production traffic, When processed, Then system satisfies confirmed SLA."
                ] if first_answered else ["System responds in timely manner"],
                sourceStatement="System should be fast and reliable.",
                clarificationReference=f"Clarification #{first_answered.get('id')}: '{first_answered.get('selectedResponse')}'" if first_answered else None,
                verificationMethod="Automated Performance Benchmark" if first_answered else None,
                ambiguityFlags=None if first_answered else ["'Fast' and 'reliable' are unquantified"]
            )
        ]

        return RequirementSet(frs=frs, nfrs=nfrs)

requirement_engine = RequirementEngine()
