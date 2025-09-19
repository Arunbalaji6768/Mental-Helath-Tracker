import os
import logging
from typing import Tuple

from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification

logger = logging.getLogger(__name__)

_nlp_pipeline = None

def _load_pipeline():
    """Lazy-load and cache a Transformers sentiment pipeline.
    Preference order:
    1) Local fine-tuned model in dataset/model_out
    2) Public SST-2 model 'distilbert-base-uncased-finetuned-sst-2-english'
    """
    global _nlp_pipeline
    if _nlp_pipeline is not None:
        return _nlp_pipeline

    # From backend/utils -> ../../dataset/model_out
    model_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'dataset', 'model_out'))
    model_name = None

    try:
        if os.path.isdir(model_dir) and os.path.exists(os.path.join(model_dir, 'config.json')):
            logger.info(f"Loading local fine-tuned model from: {model_dir}")
            tokenizer = AutoTokenizer.from_pretrained(model_dir)
            model = AutoModelForSequenceClassification.from_pretrained(model_dir)
            _nlp_pipeline = pipeline('sentiment-analysis', model=model, tokenizer=tokenizer)
        else:
            model_name = 'distilbert-base-uncased-finetuned-sst-2-english'
            logger.info(f"Loading fallback model: {model_name}")
            _nlp_pipeline = pipeline('sentiment-analysis', model=model_name)
    except Exception as e:
        logger.exception(f"Failed to initialize sentiment pipeline (model={model_name or model_dir}). Falling back to simple rule-based neutral.")
        _nlp_pipeline = None

    return _nlp_pipeline


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
                # Only flip NEUTRAL to POS/NEG if strong cues exist; otherwise keep NEUTRAL
                if any(w in tl for w in pos_words) and not any(w in tl for w in neg_words):
                    label = 'POSITIVE'
                    score = max(score, 0.7)
                elif any(w in tl for w in neg_words) and not any(w in tl for w in pos_words):
                    label = 'NEGATIVE'
                    score = max(score, 0.7)
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


