import os
import logging
import threading
import tempfile
from typing import Tuple

import numpy as np
import requests

logger = logging.getLogger(__name__)

# Quantized ONNX export of distilbert-base-uncased-finetuned-sst-2-english.
# Runs on onnxruntime (~150 MB RAM) instead of PyTorch + transformers (~800 MB),
# so it fits on Render's free 512 MB instances.
_HF_BASE = "https://huggingface.co/Xenova/distilbert-base-uncased-finetuned-sst-2-english/resolve/main"
_MODEL_URL = f"{_HF_BASE}/onnx/model_quantized.onnx"
_TOKENIZER_URL = f"{_HF_BASE}/tokenizer.json"
_CACHE_DIR = os.environ.get("SENTIMENT_CACHE_DIR", os.path.join(tempfile.gettempdir(), "mht_sentiment"))
_LABELS = ["NEGATIVE", "POSITIVE"]  # SST-2 output order

_nlp_pipeline = None
_load_failed = False
_load_lock = threading.Lock()


def _download(url: str, dest: str) -> None:
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return
    logger.info(f"Downloading {url}")
    tmp = dest + ".part"
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(1024 * 1024):
                f.write(chunk)
    os.replace(tmp, dest)


class _OnnxSentiment:
    """Callable that mimics a transformers sentiment pipeline: text -> [{'label', 'score'}]."""

    def __init__(self, model_path: str, tokenizer_path: str):
        import onnxruntime as ort
        from tokenizers import Tokenizer

        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 1
        opts.inter_op_num_threads = 1
        self.session = ort.InferenceSession(model_path, sess_options=opts, providers=["CPUExecutionProvider"])
        self.input_names = {i.name for i in self.session.get_inputs()}
        self.tokenizer = Tokenizer.from_file(tokenizer_path)
        self.tokenizer.enable_truncation(max_length=512)

    def __call__(self, text: str):
        enc = self.tokenizer.encode(text)
        feeds = {
            "input_ids": np.array([enc.ids], dtype=np.int64),
            "attention_mask": np.array([enc.attention_mask], dtype=np.int64),
        }
        feeds = {k: v for k, v in feeds.items() if k in self.input_names}
        logits = self.session.run(None, feeds)[0][0]
        logits = logits - np.max(logits)
        probs = np.exp(logits) / np.exp(logits).sum()
        idx = int(np.argmax(probs))
        return [{"label": _LABELS[idx], "score": float(probs[idx])}]


def _load_pipeline():
    """Lazy-load and cache the ONNX sentiment model (downloaded once, cached on disk)."""
    global _nlp_pipeline, _load_failed
    if _nlp_pipeline is not None:
        return _nlp_pipeline
    if _load_failed:
        return None

    with _load_lock:
        if _nlp_pipeline is not None:
            return _nlp_pipeline
        try:
            os.makedirs(_CACHE_DIR, exist_ok=True)
            model_path = os.path.join(_CACHE_DIR, "model_quantized.onnx")
            tok_path = os.path.join(_CACHE_DIR, "tokenizer.json")
            _download(_MODEL_URL, model_path)
            _download(_TOKENIZER_URL, tok_path)
            _nlp_pipeline = _OnnxSentiment(model_path, tok_path)
            logger.info("ONNX DistilBERT sentiment model loaded")
        except Exception:
            logger.exception("Failed to initialize ONNX sentiment model. Falling back to NEUTRAL.")
            _nlp_pipeline = None
            _load_failed = True
    return _nlp_pipeline


def warm_up() -> None:
    """Load the model in a background thread at startup and log a self-test result."""
    def _run():
        nlp = _load_pipeline()
        if nlp is None:
            logger.error("Sentiment warm-up FAILED: model unavailable")
            return
        pos = nlp("I am so happy and grateful today")[0]
        neg = nlp("I feel terrible and hopeless")[0]
        logger.info(f"Sentiment warm-up OK: positive-test={pos['label']}({pos['score']:.2f}) negative-test={neg['label']}({neg['score']:.2f})")
    threading.Thread(target=_run, name="sentiment-warmup", daemon=True).start()


def analyze_text(text: str) -> Tuple[str, float]:
    """Analyze sentiment using a BERT-like model via Hugging Face Transformers.

    Returns a tuple: (sentiment_label, confidence)
    sentiment_label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
    confidence: 0..1
    """
    if not text or not text.strip():
        return "NEUTRAL", 0.5

    nlp = _load_pipeline()
    if nlp is None:
        # Extremely defensive fallback if model failed to load
        logger.warning("Sentiment pipeline unavailable; returning NEUTRAL fallback")
        return "NEUTRAL", 0.5

    try:
        result = nlp(text[:4096])  # avoid excessively long inputs
        # result is typically a list like: [{'label': 'POSITIVE', 'score': 0.997}]
        if isinstance(result, list) and len(result) > 0:
            label = result[0].get('label', 'NEUTRAL').upper()
            score = float(result[0].get('score', 0.5))
            # Normalize labels to POSITIVE/NEGATIVE/NEUTRAL
            if 'NEUTRAL' in label:
                label = 'NEUTRAL'
            elif 'POS' in label:
                label = 'POSITIVE'
            elif 'NEG' in label:
                label = 'NEGATIVE'
            else:
                # Unknown label from a custom head - map by threshold
                label = 'POSITIVE' if score >= 0.6 else 'NEGATIVE' if score <= 0.4 else 'NEUTRAL'

            # If the model is binary (POSITIVE/NEGATIVE only), treat near-mid outputs as NEUTRAL
            # Wider neutral band around 0.5 to respect neutral statements.
            if label in ('POSITIVE', 'NEGATIVE') and 0.45 <= score <= 0.55:
                label = 'NEUTRAL'

            # Light lexical heuristic to correct obvious misclassifications at low confidence
            tl = (text or '').lower()
            pos_words = ('happy', 'happiness', 'great', 'good', 'grateful', 'excited', 'joy', 'joyful', 'wonderful', 'celebrat')
            neg_words = ('sad', 'angry', 'upset', 'anxious', 'anxiety', 'stress', 'stressed', 'worried', 'fear', 'panic', 'depress')
            neu_words = (
                'routine','average','ordinary','okay','ok','fine','neutral','typical','usual','standard',
                'balanced','normal','uneventful','nothing special','as usual','regular','usual schedule','got through'
            )
            if label == 'NEGATIVE' and score < 0.7 and any(w in tl for w in pos_words):
                label = 'POSITIVE'
                score = max(score, 0.65)
            elif label == 'POSITIVE' and score < 0.7 and any(w in tl for w in neg_words):
                label = 'NEGATIVE'
                score = max(score, 0.65)
            elif label == 'NEUTRAL':
                # Flip NEUTRAL to POSITIVE if any positive word is present, unless strong negative words are also present
                if any(w in tl for w in pos_words) and not any(w in tl for w in neg_words):
                    label = 'POSITIVE'
                    score = max(score, 0.8)  # More confident
                elif any(w in tl for w in neg_words) and not any(w in tl for w in pos_words):
                    label = 'NEGATIVE'
                    score = max(score, 0.8)
                elif any(w in tl for w in neu_words):
                    label = 'NEUTRAL'
                    score = 0.5

            # If text explicitly contains neutral cues and model confidence is not strong, force NEUTRAL
            if any(w in tl for w in neu_words) and score < 0.7 and label in ('POSITIVE','NEGATIVE'):
                label = 'NEUTRAL'
                score = 0.5

            logger.info(f"BERT sentiment: label={label}, score={score:.4f}")
            return label, max(0.0, min(1.0, score))
    except Exception as e:
        logger.exception(f"Sentiment inference failed: {e}")

    return "NEUTRAL", 0.5


