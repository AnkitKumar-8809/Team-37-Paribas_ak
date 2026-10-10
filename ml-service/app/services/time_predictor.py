import os
import pickle
from typing import Dict, Any

class TimePredictorService:
    def __init__(self):
        self.model = None
        self._load_model()

    def _load_model(self):
        model_path = os.path.join(os.path.dirname(__file__), "../models/time_model.pkl")
        if os.path.exists(model_path) and os.path.getsize(model_path) > 0:
            try:
                with open(model_path, "rb") as f:
                    self.model = pickle.load(f)
            except Exception as e:
                print(f"[TimePredictor] Note: Model load warning: {e}")

    def predict_seconds(self, file_size_mb: float, row_count: int) -> float:
        """
        Predicts file processing completion time in seconds.
        """
        # Baseline heuristic: ~500 rows/second + file IO overhead
        base_overhead = 1.5 + (file_size_mb * 0.4)
        processing_time = row_count / 500.0
        return round(base_overhead + processing_time, 2)

time_predictor = TimePredictorService()
