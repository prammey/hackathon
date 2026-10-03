"""Prism helper: a small HTTP service between the extension and Vertex AI.

Run locally:  helper/.venv/bin/uvicorn prism_helper.app:app --app-dir helper --port 8787
Credentials come from Application Default Credentials (local `gcloud auth application-default login`,
or the Cloud Run service account). Payloads are never logged.
"""
import logging
import os
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from google.genai import types

from . import prompts
from .gemini import FALLBACK_MODEL, PRIMARY_MODEL, AIUnavailable, generate, generate_json, image_part
from .limits import Limiter
from .schemas import (
  AssistRequest, ChatReply, ChatRequest, DefineAnswer, ExtractRequest, FillAnswer, PlanRequest,
  ProfileCandidates, TidyPlan, TranslateAnswer,
)
from .tools import CHAT_TOOLS, TOOL_NAMES

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("prism.app")

EXTENSION_ID = os.environ.get("PRISM_EXTENSION_ID", "odhanhcbejiongenfdafobkcofoadhgg")
ALLOWED_ORIGINS = [f"chrome-extension://{EXTENSION_ID}"] + [
  o for o in os.environ.get("PRISM_EXTRA_ORIGINS", "").split(",") if o
]
HOSTED = os.environ.get("PRISM_MODE", "local") == "hosted"
VERSION = "0.1.0"

app = FastAPI(title="Prism helper", version=VERSION, docs_url=None, redoc_url=None)
app.add_middleware(
  CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["GET", "POST"],
  allow_headers=["Content-Type", "X-Prism-Install"], max_age=3600,
)
limiter = Limiter(hosted=HOSTED)
stats = {"requests": 0, "started": time.time()}


@app.middleware("http")
async def guard(request: Request, call_next):
  if request.url.path.startswith("/v1/"):
    origin = request.headers.get("origin")
    # Browsers can't forge Origin; on the public URL we also require it and rate-limit per install + IP.
    if origin and origin not in ALLOWED_ORIGINS:
      return JSONResponse({"error": "forbidden_origin"}, status_code=403)
    if HOSTED and not origin:
      return JSONResponse({"error": "forbidden_origin"}, status_code=403)
    install = request.headers.get("x-prism-install", "")[:64] or "anonymous"
    client_ip = (request.headers.get("x-forwarded-for", "").split(",")[0].strip()
                 or (request.client.host if request.client else "unknown"))
    verdict = limiter.check(install, client_ip)
    if verdict:
      return JSONResponse({"error": "rate_limited", "message": verdict}, status_code=429)
    length = int(request.headers.get("content-length") or 0)
    if length > 8_000_000:
      return JSONResponse({"error": "too_large"}, status_code=413)
    stats["requests"] += 1
  started = time.monotonic()
  response = await call_next(request)
  log.info("%s %s -> %s %.1fs", request.method, request.url.path, response.status_code,
           time.monotonic() - started)
  return response


@app.exception_handler(AIUnavailable)
async def ai_unavailable(_request: Request, err: AIUnavailable):
  log.warning("AI unavailable: %s", str(err)[:200])
  return JSONResponse({"error": "ai_unavailable", "message": "The AI service did not answer in time."},
                      status_code=503)


DEMO_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "demo")
if os.path.isdir(DEMO_DIR):
  # Fictional practice pages so people can try Prism safely (copied from fixtures/ at deploy time).
  app.mount("/demo", StaticFiles(directory=DEMO_DIR, html=True), name="demo")


@app.post("/submit", response_class=HTMLResponse)
def demo_submit():
  return ("<!doctype html><html lang=en><head><title>Received (practice)</title></head><body><main>"
          "<h1>Application received</h1><p>This is a practice page: nothing was stored or sent anywhere.</p>"
          "</main></body></html>")


@app.get("/health")
def health():
  return {"ok": True, "version": VERSION, "mode": "hosted" if HOSTED else "local",
          "model": PRIMARY_MODEL, "fallback": FALLBACK_MODEL, "requests": stats["requests"]}


# ---------- Tidy plan ----------

def bounded_plan(plan: TidyPlan, valid_ids: set[str]) -> TidyPlan:
  """Drop anything that references unknown ids and enforce size bounds. Extension re-validates."""
  seen = set()
  roles = []
  for r in plan.roles:
    if r.id in valid_ids and r.id not in seen:
      seen.add(r.id)
      roles.append(r)
  plan.roles = roles[:400]
  plan.emphasis = [e for e in plan.emphasis if e.id in valid_ids][:40]
  protect = [i for i in plan.protect if i in valid_ids][:200]
  plan.protect = protect
  groups = []
  for g in plan.collapse[:12]:
    ids = [i for i in g.ids if i in valid_ids and i not in protect][:60]
    if ids:
      g.ids = ids
      g.label = g.label[:40] or "More"
      groups.append(g)
  plan.collapse = groups
  plan.steps = [s for s in plan.steps if s.id in valid_ids][:12]
  for s in plan.steps:
    s.label = s.label[:60]
  plan.pagePurpose = plan.pagePurpose[:160]
  plan.primaryTask = plan.primaryTask[:160]
  return plan


@app.post("/v1/plan")
def plan(req: PlanRequest):
  outline = req.outline.model_dump(exclude_defaults=True)
  result, model = generate_json(
    prompts.plan_prompt(outline, req.style, req.clutterLevel, req.language), prompts.PLAN_SYSTEM, TidyPlan
  )
  valid = {e.id for e in req.outline.elements}
  return {"plan": bounded_plan(result, valid).model_dump(), "model": model}


# ---------- Region assistance ----------

def region_text(req: AssistRequest) -> str:
  region = req.region.model_dump(exclude_defaults=True)
  parts = [f"Selected region: {prompts.untrusted(region)}"]
  if req.image:
    parts.append("A picture of the selected region is attached.")
  if req.profile:
    parts.append(f"Facts the person chose to share (trusted, from Prism settings):\n{req.profile}")
  if req.question:
    parts.append(f"The person's question: {req.question}")
  return "\n\n".join(parts)


@app.post("/v1/assist")
def assist(req: AssistRequest):
  if not req.region.text and not req.region.controls and not req.image:
    raise HTTPException(422, "Nothing to work with: no text, controls or picture in the region.")
  contents = []
  if req.image:
    contents.append(image_part(req.image, req.imageMime))
  if req.action == "define":
    system = prompts.DEFINE_SYSTEM + "\n" + prompts.LEVELS[req.explainLevel]
    contents.append(region_text(req) + f"\nAnswer in {req.targetLanguage}.")
    answer, model = generate_json(contents, system, DefineAnswer)
  elif req.action == "translate":
    contents.append(region_text(req) + f"\nTarget language: {req.targetLanguage}.")
    answer, model = generate_json(contents, prompts.TRANSLATE_SYSTEM, TranslateAnswer)
  else:
    if not req.region.controls:
      raise HTTPException(422, "No form fields were found in the selected area.")
    contents.append(region_text(req) + f"\nWrite explanations in {req.targetLanguage}.")
    answer, model = generate_json(contents, prompts.FILL_SYSTEM, FillAnswer)
    valid = {c.id: c for c in req.region.controls}
    answer.fields = [f for f in answer.fields if f.id in valid]
    for field in answer.fields:
      options = valid[field.id].options
      if options:
        field.optionValues = [v for v in field.optionValues if v in options]
  return {"answer": answer.model_dump(), "model": model}


# ---------- Chat / action loop ----------

def chat_contents(req: ChatRequest) -> list:
  contents: list = []
  for i, turn in enumerate(req.turns):
    is_last = i == len(req.turns) - 1
    if turn.role == "model" and turn.raw:
      contents.append(types.Content.model_validate(turn.raw))
      continue
    parts = []
    if turn.role == "tool":
      # Gemini rejects a turn that mixes function responses with text parts, so the fresh page state
      # rides inside the last function response instead.
      for j, r in enumerate(turn.results):
        response = dict(r.get("response") or {})
        if is_last and req.pageState and j == len(turn.results) - 1:
          response["page_state"] = prompts.untrusted(req.pageState)
        parts.append(types.Part(function_response=types.FunctionResponse(
          id=r.get("id"), name=r.get("name"), response=response)))
      if parts:
        contents.append(types.Content(role="user", parts=parts))
      continue
    if turn.image:
      parts.append(image_part(turn.image, "image/jpeg"))
    if turn.text:
      parts.append(types.Part(text=turn.text if turn.role == "user" else prompts.untrusted(turn.text)))
    if is_last and req.pageState:
      parts.append(types.Part(text="Current page state:\n" + prompts.untrusted(req.pageState)))
    if parts:
      contents.append(types.Content(role="user", parts=parts))
  return contents


@app.post("/v1/chat")
def chat(req: ChatRequest):
  if not req.turns or req.turns[-1].role == "model":
    raise HTTPException(422, "The conversation must end with a user or tool turn.")
  system = prompts.CHAT_SYSTEM + f"\nReply in {req.language}."
  if req.profile:
    system += f"\nFacts the person chose to share (from Prism settings):\n{req.profile}"
  if req.sessionContext:
    system += ("\nJust for this conversation, use these details instead of the saved profile where they "
               f"differ (the person may be helping someone else):\n{req.sessionContext}")
  tools = CHAT_TOOLS if req.allowActions else None
  resp, model = generate(chat_contents(req), system, tools=tools)
  candidate = resp.candidates[0] if resp.candidates else None
  if candidate is None or candidate.content is None:
    return ChatReply(text="I couldn't think of an answer to that. Could you say it another way?",
                     actions=[], raw={"role": "model", "parts": [{"text": ""}]}, model=model)
  actions, texts = [], []
  for part in candidate.content.parts or []:
    if part.function_call and part.function_call.name in TOOL_NAMES:
      actions.append({"id": part.function_call.id or f"call_{len(actions)}",
                      "name": part.function_call.name, "args": dict(part.function_call.args or {})})
    elif part.text and not part.thought:
      texts.append(part.text)
  raw = candidate.content.model_dump(mode="json", exclude_none=True)
  return ChatReply(text="\n".join(texts).strip(), actions=actions, raw=raw, model=model)


# ---------- Imports ----------

@app.post("/v1/import/extract")
def extract(req: ExtractRequest):
  system = prompts.EXTRACT_SYSTEM.replace("{source}", req.source)
  result, model = generate_json(prompts.untrusted(req.text), system, ProfileCandidates)
  result.facts = result.facts[:25]
  return {"facts": [f.model_dump() for f in result.facts], "model": model}
