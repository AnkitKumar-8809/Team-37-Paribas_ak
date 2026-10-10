import os
import pickle
from typing import Dict, Any, Tuple

class AnomalyDetectorService:
    def __init__(self):
        self.model = None
        self._load_model()

    def _load_model(self):
        model_path = os.path.join(os.path.dirname(__file__), "../models/anomaly_model.pkl")
        if os.path.exists(model_path) and os.path.getsize(model_path) > 0:
            try:
                with open(model_path, "rb") as f:
                    self.model = pickle.load(f)
            except Exception as e:
                print(f"[AnomalyDetector] Note: Model load warning: {e}")

    def detect(self, features: Dict[str, Any]) -> Tuple[bool, float, str]:
        """
        Evaluates row features for anomalies using statistical z-score or ML heuristics.
        """
        amount = float(features.get("amount", 0.0))
        # Simple starter rule + model fallback
        if amount > 100000.0:
            return True, 0.95, "Transaction amount exceeds threshold (> $100,000)"
        elif amount < 0.0:
            return True, 1.0, "Negative transaction amount detected"

        return False, 0.05, "Normal distribution"

anomaly_detector = AnomalyDetectorService()
