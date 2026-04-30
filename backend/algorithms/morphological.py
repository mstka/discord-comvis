import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Try to load GiNZA / spaCy; fall back gracefully
_nlp = None

try:
    import spacy
    _nlp = spacy.load("ja_ginza")
    logger.info("GiNZA loaded successfully")
except Exception as e:
    logger.warning(f"GiNZA not available: {e}. Using basic fallback.")


def _load_nlp():
    return _nlp


def split_sentences(text: str) -> list[str]:
    nlp = _load_nlp()
    if nlp is None:
        return [s.strip() for s in text.replace("。", "。\n").replace("？", "？\n").split("\n") if s.strip()]
    doc = nlp(text)
    return [sent.text for sent in doc.sents]


def process(text: str):
    nlp = _load_nlp()
    if nlp is None:
        return None
    return nlp(text)


def extract_sentence_end_tokens(doc) -> list[str]:
    if doc is None:
        return []
    ends = []
    for sent in doc.sents:
        tokens = list(sent)
        if tokens:
            ends.append(tokens[-1].text)
    return ends


def extract_sentence_start_tokens(doc) -> list[str]:
    if doc is None:
        return []
    starts = []
    for sent in doc.sents:
        tokens = list(sent)
        if tokens:
            starts.append(tokens[0].text)
    return starts


def extract_named_entities(doc) -> list[tuple[str, str]]:
    if doc is None:
        return []
    return [(ent.text, ent.label_) for ent in doc.ents]


def compute_modality_symmetry(doc_a, doc_b) -> float:
    """Score reflecting question/answer symmetry between two documents."""
    QUESTION_MARKERS = {"か", "？", "?", "ですか", "ますか", "でしょうか"}
    ANSWER_MARKERS = {"です", "ます", "した", "ました", "ます", "だ", "である"}

    def has_question(doc) -> bool:
        if doc is None:
            return False
        text = doc.text
        return any(m in text for m in QUESTION_MARKERS)

    def has_answer(doc) -> bool:
        if doc is None:
            return False
        end_tokens = extract_sentence_end_tokens(doc)
        return any(t in ANSWER_MARKERS for t in end_tokens)

    a_is_q = has_question(doc_a)
    b_is_a = has_answer(doc_b)

    if a_is_q and b_is_a:
        return 1.0
    if a_is_q or b_is_a:
        return 0.5
    return 0.0


def compute_ner_overlap(doc_a, doc_b) -> float:
    """Jaccard similarity of named entity sets."""
    ents_a = set(t for t, _ in extract_named_entities(doc_a))
    ents_b = set(t for t, _ in extract_named_entities(doc_b))
    if not ents_a and not ents_b:
        return 0.0
    intersection = len(ents_a & ents_b)
    union = len(ents_a | ents_b)
    return intersection / union if union > 0 else 0.0


def resolve_coreference(docs: list) -> dict:
    """Simple window-based pronoun->antecedent mapping."""
    PRONOUNS = {"彼", "彼女", "それ", "これ", "あれ", "そこ", "ここ"}
    result: dict[str, str] = {}

    entity_window: list[tuple[str, str]] = []
    for doc in docs:
        if doc is None:
            continue
        for token in doc:
            if token.text in PRONOUNS and entity_window:
                result[token.text] = entity_window[-1][0]
            for ent in doc.ents:
                entity_window.append((ent.text, ent.label_))
                if len(entity_window) > 20:
                    entity_window.pop(0)

    return result


def compute_fast_score(doc_a, doc_b) -> float:
    """Combine all Fast Route signals into a single confidence score."""
    modality = compute_modality_symmetry(doc_a, doc_b)
    ner = compute_ner_overlap(doc_a, doc_b)

    end_a = set(extract_sentence_end_tokens(doc_a))
    start_b = set(extract_sentence_start_tokens(doc_b))
    RESPONSE_STARTERS = {"わかりました", "なるほど", "確かに", "そうですね", "はい", "ありがとう", "了解"}
    end_start_score = 1.0 if (start_b & RESPONSE_STARTERS) else 0.0

    coref_docs = [d for d in [doc_a, doc_b] if d is not None]
    coref_map = resolve_coreference(coref_docs)
    coref_score = min(len(coref_map) / 3.0, 1.0)

    score = 0.30 * end_start_score + 0.30 * ner + 0.25 * modality + 0.15 * coref_score
    return round(score, 4)
