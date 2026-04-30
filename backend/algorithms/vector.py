import logging
import numpy as np
from typing import Optional

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 768


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def compute_centroid(vectors: list[np.ndarray]) -> np.ndarray:
    if not vectors:
        return np.zeros(EMBEDDING_DIM, dtype=np.float32)
    return np.mean(vectors, axis=0).astype(np.float32)


def compute_centroid_drift(context_vectors: list[np.ndarray], new_vector: np.ndarray) -> float:
    if not context_vectors:
        return 0.0
    centroid = compute_centroid(context_vectors)
    sim = cosine_similarity(centroid, new_vector)
    return 1.0 - sim  # drift = dissimilarity


def compute_covariance_ellipsoid(vectors: list[np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    mat = np.stack(vectors).astype(np.float64)
    mean = mat.mean(axis=0)
    cov = np.cov(mat, rowvar=False)
    return mean.astype(np.float32), cov.astype(np.float32)


def compute_mahalanobis(vector: np.ndarray, mean: np.ndarray, cov: np.ndarray) -> float:
    from scipy.spatial.distance import mahalanobis
    try:
        inv_cov = np.linalg.pinv(cov)
        dist = mahalanobis(vector, mean, inv_cov)
        return float(dist)
    except Exception as e:
        logger.warning(f"Mahalanobis failed: {e}")
        return 0.0


def compute_cca_score(vectors_a: list[np.ndarray], vectors_b: list[np.ndarray]) -> float:
    if len(vectors_a) < 3 or len(vectors_b) < 3:
        return 0.5
    try:
        from sklearn.cross_decomposition import CCA
        min_samples = min(len(vectors_a), len(vectors_b))
        A = np.stack(vectors_a[:min_samples]).astype(np.float64)
        B = np.stack(vectors_b[:min_samples]).astype(np.float64)
        n_comp = min(1, min_samples - 1)
        if n_comp < 1:
            return 0.5
        cca = CCA(n_components=n_comp)
        cca.fit(A, B)
        A_c, B_c = cca.transform(A, B)
        score = cosine_similarity(A_c.flatten(), B_c.flatten())
        return max(0.0, min(1.0, (score + 1) / 2))
    except Exception as e:
        logger.warning(f"CCA failed: {e}")
        return 0.5


_expected_qa_direction: Optional[np.ndarray] = None


def update_expected_qa_direction(q_vectors: list[np.ndarray], a_vectors: list[np.ndarray]):
    global _expected_qa_direction
    if len(q_vectors) < 2 or len(a_vectors) < 2:
        return
    diffs = [a - q for q, a in zip(q_vectors, a_vectors)]
    _expected_qa_direction = compute_centroid(diffs)


def compute_difference_vector_score(vec_question: np.ndarray, vec_answer: np.ndarray) -> float:
    diff = vec_answer - vec_question
    if _expected_qa_direction is None or np.linalg.norm(_expected_qa_direction) == 0:
        return 0.5
    return max(0.0, min(1.0, cosine_similarity(diff, _expected_qa_direction)))


_W: Optional[np.ndarray] = None


def _get_W() -> np.ndarray:
    global _W
    if _W is None:
        _W = np.eye(EMBEDDING_DIM, dtype=np.float32) * 0.01
    return _W


def compute_bilinear_score(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    W = _get_W()
    try:
        raw = float(vec_a @ W @ vec_b)
        return 1.0 / (1.0 + np.exp(-raw))  # sigmoid
    except Exception:
        return 0.5


def update_bilinear_W(vec_a: np.ndarray, vec_b: np.ndarray, label: float, lr: float = 0.001):
    global _W
    W = _get_W()
    pred = compute_bilinear_score(vec_a, vec_b)
    error = label - pred
    grad = np.outer(vec_a, vec_b) * error
    _W = W + lr * grad.astype(np.float32)
