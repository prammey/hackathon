"""Request and response shapes for the Prism helper.

Response models double as Gemini `response_schema`s, so they stay simple: no dict fields, no unions.
Size limits are enforced after parsing in `bounded_*` helpers because Gemini's schema subset ignores them.
"""
from typing import Literal, Optional

from pydantic import BaseModel, Field

PrismRole = Literal[
  "primary-action", "secondary-action", "nav", "main", "aside", "header", "footer", "notice",
  "required-notice", "form", "field", "error", "step", "clutter", "media", "table", "heading", "text",
]


# ---------- Tidy plan ----------

class OutlineElement(BaseModel):
  id: str = Field(max_length=24)
  tag: str = Field(max_length=24)
  role: str = Field(default="", max_length=40)
  name: str = Field(default="", max_length=160)
  text: str = Field(default="", max_length=400)
  box: list[int] = Field(default_factory=list, max_length=4)
  interactive: bool = False
  hint: str = Field(default="", max_length=60)
  field: Optional[dict] = None


class Outline(BaseModel):
  title: str = Field(default="", max_length=300)
  url: str = Field(default="", max_length=600)
  lang: str = Field(default="", max_length=20)
  viewport: list[int] = Field(default_factory=list, max_length=2)
  elements: list[OutlineElement] = Field(default_factory=list, max_length=600)


class PlanRequest(BaseModel):
  outline: Outline
  style: str = Field(default="clear", max_length=20)
  clutterLevel: Literal["gentle", "standard", "strong"] = "standard"
  language: str = Field(default="en", max_length=20)


class RoleAssignment(BaseModel):
  id: str
  role: PrismRole


class Emphasis(BaseModel):
  id: str
  level: Literal["primary", "secondary", "quiet"]


class CollapseGroup(BaseModel):
  ids: list[str]
  label: str
  reason: Literal["ads", "related-links", "promo", "social", "repeated-nav", "other"]


class Step(BaseModel):
  id: str
  label: str


class TidyPlan(BaseModel):
  pagePurpose: str
  primaryTask: str
  isOfficialSite: bool
  roles: list[RoleAssignment]
  emphasis: list[Emphasis]
  collapse: list[CollapseGroup]
  protect: list[str]
  steps: list[Step]


# ---------- Region assistance ----------

class RegionControl(BaseModel):
  id: str = Field(max_length=24)
  type: str = Field(max_length=30)
  label: str = Field(default="", max_length=200)
  required: bool = False
  options: list[str] = Field(default_factory=list, max_length=80)
  value: str = Field(default="", max_length=300)
  checked: Optional[bool] = None
  constraints: str = Field(default="", max_length=200)
  error: str = Field(default="", max_length=300)


class RegionContext(BaseModel):
  text: str = Field(default="", max_length=8000)  # exactly the words the person selected
  surrounding: str = Field(default="", max_length=2000)  # the rest of the line(s), context only
  controls: list[RegionControl] = Field(default_factory=list, max_length=60)
  imageCount: int = 0
  pageTitle: str = Field(default="", max_length=300)
  pageUrl: str = Field(default="", max_length=600)
  pagePurpose: str = Field(default="", max_length=300)


class AssistRequest(BaseModel):
  action: Literal["define", "translate", "fill"]
  region: RegionContext
  image: Optional[str] = Field(default=None, max_length=6_000_000)  # base64 JPEG/PNG
  imageMime: Literal["image/jpeg", "image/png"] = "image/jpeg"
  profile: str = Field(default="", max_length=6000)  # plain-text facts the person chose to share
  targetLanguage: str = Field(default="English", max_length=40)
  explainLevel: Literal["simple", "normal", "detailed"] = "simple"
  question: str = Field(default="", max_length=600)


class Term(BaseModel):
  term: str
  meaning: str


class DefineAnswer(BaseModel):
  summary: str
  explanation: str
  terms: list[Term]
  whatToDoHere: str
  uncertain: list[str]


class TranslatedLine(BaseModel):
  source: str
  translation: str
  unclear: bool
  note: str


class TranslateAnswer(BaseModel):
  sourceLanguage: str
  targetLanguage: str
  lines: list[TranslatedLine]


class FieldSuggestion(BaseModel):
  id: str
  explanation: str
  hasSuggestion: bool
  value: str
  optionValues: list[str]
  checked: bool
  source: Literal["profile", "session", "page", "inference", "none"]
  evidence: str
  confidence: Literal["high", "medium", "low"]


class FieldQuestion(BaseModel):
  fieldId: str
  question: str


class FillAnswer(BaseModel):
  overview: str
  fields: list[FieldSuggestion]
  questions: list[FieldQuestion]


# ---------- Chat ----------

class ChatTurn(BaseModel):
  role: Literal["user", "model", "tool"]
  text: str = Field(default="", max_length=8000)
  image: Optional[str] = Field(default=None, max_length=6_000_000)
  raw: Optional[dict] = None  # model turn exactly as Gemini returned it (keeps thought signatures)
  results: list[dict] = Field(default_factory=list, max_length=10)  # [{id, name, response}]


class ChatRequest(BaseModel):
  turns: list[ChatTurn] = Field(max_length=80)
  pageState: str = Field(default="", max_length=20000)
  profile: str = Field(default="", max_length=6000)
  sessionContext: str = Field(default="", max_length=3000)
  language: str = Field(default="English", max_length=40)
  allowActions: bool = True


class ChatAction(BaseModel):
  id: str
  name: str
  args: dict


class ChatReply(BaseModel):
  text: str
  actions: list[ChatAction]
  raw: dict
  model: str


# ---------- Imports ----------

class ExtractRequest(BaseModel):
  text: str = Field(max_length=40000)
  source: Literal["chatgpt", "claude", "other"] = "other"


class ProfileCandidate(BaseModel):
  field: Literal[
    "name", "formOfAddress", "ageRange", "location", "language", "accessibility", "background", "goals",
    "preference", "other",
  ]
  value: str
  evidence: str


class ProfileCandidates(BaseModel):
  facts: list[ProfileCandidate]
