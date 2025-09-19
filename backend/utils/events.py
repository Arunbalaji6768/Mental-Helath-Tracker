import json
import logging
from queue import Queue
from threading import Lock
from typing import Dict, List

logger = logging.getLogger(__name__)

_subscribers: List[Queue] = []
_lock = Lock()

def subscribe() -> Queue:
    q = Queue(maxsize=100)
    with _lock:
        _subscribers.append(q)
        logger.info("SSE subscriber added. total=%d", len(_subscribers))
    return q

def unsubscribe(q: Queue):
    with _lock:
        try:
            _subscribers.remove(q)
            logger.info("SSE subscriber removed. total=%d", len(_subscribers))
        except ValueError:
            pass

def publish(event: str, data: Dict):
    payload = json.dumps({"event": event, "data": data})
    dead = []
    with _lock:
        for q in _subscribers:
            try:
                q.put_nowait(payload)
            except Exception:
                dead.append(q)
        for q in dead:
            try:
                _subscribers.remove(q)
            except ValueError:
                pass
    logger.info("SSE published event=%s to %d subscribers", event, len(_subscribers))
