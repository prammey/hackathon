"""The fixed action set the chat model may request. Execution and safety checks live in the extension."""
from google.genai import types

_ID = {"type": "string", "description": "Element id from the latest page state, e.g. p12"}


def _fn(name: str, description: str, properties: dict, required: list[str]) -> types.FunctionDeclaration:
  return types.FunctionDeclaration(
    name=name, description=description,
    parameters_json_schema={"type": "object", "properties": properties, "required": required},
  )


DECLARATIONS = [
  _fn("click", "Click a button, link, checkbox or other control.",
      {"id": _ID, "reason": {"type": "string", "description": "Why, in a few plain words"}}, ["id", "reason"]),
  _fn("type_text", "Type text into a text field (replaces its current text).",
      {"id": _ID, "text": {"type": "string"}}, ["id", "text"]),
  _fn("select_option", "Choose one or more options in a dropdown or list, or a radio option by its label.",
      {"id": _ID, "values": {"type": "array", "items": {"type": "string"}}}, ["id", "values"]),
  _fn("set_checkbox", "Tick or untick a checkbox.",
      {"id": _ID, "checked": {"type": "boolean"}}, ["id", "checked"]),
  _fn("scroll", "Scroll the page to an element, or up/down by one screen.",
      {"target": {"type": "string", "description": "An element id, or 'up' or 'down'"}}, ["target"]),
  _fn("navigate", "Open a web address. Prefer clicking links on the page.",
      {"url": {"type": "string"}}, ["url"]),
  _fn("read_page", "Get a fresh view of the page state.", {}, []),
  _fn("ask_user", "Ask the person a question when information or a decision is needed.",
      {"question": {"type": "string"}}, ["question"]),
  _fn("finish", "Stop: the task is done or cannot continue.",
      {"summary": {"type": "string"}}, ["summary"]),
]

TOOL_NAMES = {d.name for d in DECLARATIONS}
CHAT_TOOLS = [types.Tool(function_declarations=DECLARATIONS)]
