import logging
import numpy as np

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 768


class TopicTracker:
    """Diagonal-covariance Kalman filter tracking a topic embedding trajectory."""

    def __init__(self, dim: int = EMBEDDING_DIM, q_noise: float = 0.01, r_noise: float = 0.1):
        self.dim = dim
        self.x = np.zeros(dim, dtype=np.float64)
        # Diagonal covariances stored as 1-D arrays
        self.P_diag = np.ones(dim, dtype=np.float64)
        self.Q_diag = np.full(dim, q_noise, dtype=np.float64)  # process noise
        self.R_diag = np.full(dim, r_noise, dtype=np.float64)  # measurement noise
        self._initialized = False

    def update(self, vector: np.ndarray):
        z = vector.astype(np.float64)
        if not self._initialized:
            self.x = z.copy()
            self._initialized = True
            return

        # Predict
        x_pred = self.x.copy()
        P_pred = self.P_diag + self.Q_diag

        # Update (diagonal Kalman gain)
        S = P_pred + self.R_diag
        K = P_pred / S
        self.x = x_pred + K * (z - x_pred)
        self.P_diag = (1 - K) * P_pred

    def predict_next(self) -> np.ndarray:
        return self.x.astype(np.float32)

    def get_state(self) -> np.ndarray:
        return self.x.astype(np.float32)

    def mahalanobis_to(self, vector: np.ndarray) -> float:
        if not self._initialized:
            return 0.0
        diff = vector.astype(np.float64) - self.x
        # Diagonal Mahalanobis: sqrt(sum((diff^2) / P_diag))
        safe_P = np.where(self.P_diag > 1e-12, self.P_diag, 1e-12)
        dist = float(np.sqrt(np.sum(diff ** 2 / safe_P)))
        return dist


# Per-channel trackers
_channel_trackers: dict[str, TopicTracker] = {}


def get_tracker(channel_id: str) -> TopicTracker:
    if channel_id not in _channel_trackers:
        _channel_trackers[channel_id] = TopicTracker()
    return _channel_trackers[channel_id]


def reset_tracker(channel_id: str):
    if channel_id in _channel_trackers:
        del _channel_trackers[channel_id]
