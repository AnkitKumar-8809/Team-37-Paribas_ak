"""
Starter training script for Processing Time Estimation Model (e.g. Ridge Regression)
"""
import os
import pickle

def train_and_save():
    print("[train_time_model] Training starter regression model for duration estimation...")
    dummy_model = {
        "model_type": "LinearRegression",
        "coefficients": [0.4, 0.002],
        "intercept": 1.5,
        "status": "ready"
    }

    output_dir = os.path.join(os.path.dirname(__file__), "../app/models")
    os.makedirs(output_dir, exist_ok=True)
    target_path = os.path.join(output_dir, "time_model.pkl")

    with open(target_path, "wb") as f:
        pickle.dump(dummy_model, f)

    print(f"[train_time_model] Model saved successfully to: {target_path}")

if __name__ == "__main__":
    train_and_save()
