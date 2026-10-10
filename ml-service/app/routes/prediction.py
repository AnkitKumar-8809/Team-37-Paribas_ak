from fastapi import APIRouter
from pydantic import BaseModel
from app.services.time_predictor import time_predictor

router = APIRouter()

class TimePredictionRequest(BaseModel):
    fileSizeMb: float = 1.0
    rowCount: int = 100

class TimePredictionResponse(BaseModel):
    estimatedSeconds: float
    unit: str = "seconds"

@router.post("/predict-time", response_model=TimePredictionResponse)
def predict_processing_time(req: TimePredictionRequest):
    est_seconds = time_predictor.predict_seconds(req.fileSizeMb, req.rowCount)
    return TimePredictionResponse(estimatedSeconds=est_seconds)
