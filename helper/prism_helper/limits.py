"""In-memory rate limits that protect the Google Cloud credits on the public URL.

Per instance (Cloud Run is capped at 2 instances, so effective limits are at most double).
"""
import os
import threading
import time
from collections import defaultdict, deque


class Limiter:
  def __init__(self, hosted: bool):
    scale = 1 if hosted else 10  # local use on your own Mac is relaxed
    self.per_minute = int(os.environ.get("PRISM_LIMIT_PER_MINUTE", 30 * scale))
    self.per_install_day = int(os.environ.get("PRISM_LIMIT_INSTALL_DAY", 400 * scale))
    self.per_ip_day = int(os.environ.get("PRISM_LIMIT_IP_DAY", 800 * scale))
    self.global_day = int(os.environ.get("PRISM_LIMIT_GLOBAL_DAY", 4000 * scale))
    self._minute: dict[str, deque] = defaultdict(deque)
    self._day: dict[str, int] = defaultdict(int)
    self._day_start = time.time()
    self._lock = threading.Lock()

  def check(self, install: str, ip: str) -> str | None:
    """Returns a plain-language reason when the request must be refused, else None."""
    now = time.time()
    with self._lock:
      if now - self._day_start > 86400:
        self._day.clear()
        self._day_start = now
      window = self._minute[install]
      while window and now - window[0] > 60:
        window.popleft()
      if len(window) >= self.per_minute:
        return "Prism is getting a lot of requests from you. Please wait a minute."
      if self._day["*"] >= self.global_day:
        return "Prism has reached today's limit for everyone. Please try again tomorrow."
      if self._day[f"i:{install}"] >= self.per_install_day or self._day[f"a:{ip}"] >= self.per_ip_day:
        return "You've reached today's Prism limit. Please try again tomorrow."
      window.append(now)
      self._day["*"] += 1
      self._day[f"i:{install}"] += 1
      self._day[f"a:{ip}"] += 1
    return None
