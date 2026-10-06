"""Thin wrapper over google-genai (Vertex AI) with Prism's model routing and fallback."""
import base64
import logging
import os
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from typing import Optional, Type

from google import genai
from google.genai import errors, types
from pydantic import BaseModel

log = logging.getLogger("prism.gemini")

PRIMARY_MODEL = os.environ.get("PRISM_MODEL", "gemini-3.8-flash")
# Page plans are a labelling task; 3.7 Flash answered in ~5 s with the best plans in our comparison,
# while 3.8 Flash took 13–25 s (or timed out) on the same structured request.
PLAN_MODEL = os.environ.get("PRISM_PLAN_MODEL", "gemini-3.7-flash")
SECOND_MODEL = os.environ.get("PRISM_SECOND_MODEL", "gemini-3.7-flash")
FALLBACK_MODEL = os.environ.get("PRISM_FALLBACK_MODEL", "gemini-3.5-flash-lite")
# Per attempt. 3.8 Flash intermittently returned 504s after ~17 s during testing (2026-10-03), so each
# model gets a bounded slot and the chain moves on quickly instead of retrying inside the SDK.
TIMEOUT_MS = int(os.environ.get("PRISM_TIMEOUT_MS", "15000"))


class AIUnavailable(Exception):
  """Raised when both the primary and fallback models fail."""


_client: Optional[genai.Client] = None


def client() -> genai.Client:
  global _client
  if _client is None:
    _client = genai.Client(
      vertexai=True,
      project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
      location=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"),
      http_options=types.HttpOptions(timeout=TIMEOUT_MS, retry_options=types.HttpRetryOptions(attempts=1)),
    )
  return _client


def _config(model: str, system: str, schema=None, tools=None) -> types.GenerateContentConfig:
  config = types.GenerateContentConfig(system_instruction=system)
  # 3.8 Flash defaults to MEDIUM thinking (3–40 s); LOW keeps answers around 2 s. Lite has no thinking knob.
  if "lite" not in model:
    config.thinking_config = types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW)
  if schema is not None:
    config.response_mime_type = "application/json"
    config.response_schema = schema
  if tools:
    config.tools = tools
    config.automatic_function_calling = types.AutomaticFunctionCallingConfig(disable=True)
  return config


def image_part(b64: str, mime: str) -> types.Part:
  return types.Part.from_bytes(data=base64.b64decode(b64), mime_type=mime)


def _retryable(err: Exception) -> bool:
  """Try the next model for anything temporary (429, 499 cancelled, 5xx, timeouts). Stop only on
  errors another model can't fix: a malformed request or missing permission."""
  if isinstance(err, errors.APIError):
    return err.code not in (400, 401, 403, 404)
  return True


def generate(contents, system: str, schema: Optional[Type[BaseModel]] = None, tools=None, model: Optional[str] = None):
  """Returns (response, model_used). Tries the chosen model, then the next ones in the chain."""
  last_err: Exception | None = None
  chain = list(dict.fromkeys([model or PRIMARY_MODEL, SECOND_MODEL, FALLBACK_MODEL]))
  for attempt, model in enumerate(chain):
    started = time.monotonic()
    try:
      resp = client().models.generate_content(
        model=model, contents=contents, config=_config(model, system, schema, tools)
      )
      usage = resp.usage_metadata
      log.info("model=%s ok %.1fs in=%s out=%s think=%s", model, time.monotonic() - started,
               getattr(usage, "prompt_token_count", None), getattr(usage, "candidates_token_count", None),
               getattr(usage, "thoughts_token_count", None))
      return resp, model
    except Exception as err:  # noqa: BLE001 — classified below, never swallowed
      last_err = err
      log.warning("model=%s failed after %.1fs: %s", model, time.monotonic() - started, type(err).__name__)
      if not _retryable(err):
        break
      if attempt == 0:
        time.sleep(0.5)
  raise AIUnavailable(str(last_err)) from last_err


def generate_json(contents, system: str, schema: Type[BaseModel], model: Optional[str] = None):
  resp, model = generate(contents, system, schema=schema, model=model)
  parsed = resp.parsed
  if parsed is None:
    # One repair attempt: validate the raw text ourselves (the SDK returns None on schema mismatch).
    parsed = schema.model_validate_json(resp.text or "{}")
  return parsed, model


# Guide me waits on the AI after every click. Answers normally take ~2 s; when one hasn't come after a few
# seconds it is usually a server error on its way (seen taking 12+ s), so the backup model starts too and
# the first good answer wins.
HEDGE_AFTER_S = float(os.environ.get("PRISM_HEDGE_AFTER_S", "4"))
_pool = ThreadPoolExecutor(max_workers=8)


def _call_json(model: str, contents, system: str, schema: Type[BaseModel]):
  started = time.monotonic()
  resp = client().models.generate_content(model=model, contents=contents, config=_config(model, system, schema))
  log.info("model=%s ok %.1fs (raced)", model, time.monotonic() - started)
  return resp.parsed or schema.model_validate_json(resp.text or "{}"), model


def generate_json_fast(contents, system: str, schema: Type[BaseModel]):
  """Like generate_json, but races the backup model against a slow or failing primary."""
  pending = {_pool.submit(_call_json, PRIMARY_MODEL, contents, system, schema)}
  backups = [m for m in dict.fromkeys([SECOND_MODEL, FALLBACK_MODEL]) if m != PRIMARY_MODEL]
  last_err: Exception | None = None
  while pending:
    done, pending = wait(pending, timeout=HEDGE_AFTER_S if backups else None, return_when=FIRST_COMPLETED)
    failed = False
    for future in done:
      try:
        return future.result()
      except Exception as err:  # noqa: BLE001 — logged, and the next model is tried
        last_err = err
        failed = True
        log.warning("raced call failed: %s", type(err).__name__)
    # Too slow, or a call failed: bring in the next model alongside whatever is still running.
    if backups and (failed or not done):
      pending.add(_pool.submit(_call_json, backups.pop(0), contents, system, schema))
  raise AIUnavailable(str(last_err))
