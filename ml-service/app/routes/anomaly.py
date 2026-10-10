from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any
from app.services.anomaly_detector import anomaly_detector

router = APIRouter()

class AnomalyRequest(BaseModel):
    fileId: str
    features: Dict[str, Any]

class AnomalyResponse(BaseModel):
    fileId: str
    isAnomaly: bool
    score: float
    reason: str

@router.post("/detect", response_model=AnomalyResponse)
def detect_anomaly(req: AnomalyRequest):
    is_anomaly, score, reason = anomaly_detector.detect(req.features)
    return AnomalyResponse(
        fileId=req.fileId,
        isAnomaly=is_anomaly,
        score=score,
        reason=reason
    )
