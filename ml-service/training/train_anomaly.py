"""
Starter training script for Anomaly Detection Model (e.g. Isolation Forest)
"""
import os
import pickle
import numpy as np

def train_and_save():
    print("[train_anomaly] Training starter IsolationForest / Z-score baseline...")
    # Baseline dummy model representation for starter MVP
    dummy_model = {
        "model_type": "IsolationForest",
        "contamination": 0.05,
        "trained_at": "2026-10-10",
        "status": "ready"
    }

    output_dir = os.path.join(os.path.dirname(__file__), "../app/models")
    os.makedirs(output_dir, exist_ok=True)
    target_path = os.path.join(output_dir, "anomaly_model.pkl")

    with open(target_path, "wb") as f:
        pickle.dump(dummy_model, f)

    print(f"[train_anomaly] Model saved successfully to: {target_path}")

if __name__ == "__main__":
    train_and_save()
