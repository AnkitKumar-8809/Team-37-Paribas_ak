import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routes.anomaly import router as anomaly_router
from app.routes.prediction import router as prediction_router
from app.routes.suggestions import router as suggestions_router

load_dotenv()

app = FastAPI(
    title="Bank File Processing ML Service",
    version="1.0.0"
)

allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:5000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    anomaly_router,
    prefix="/anomaly",
    tags=["Anomaly Detection"]
)

app.include_router(
    prediction_router,
    prefix="/prediction",
    tags=["Processing Prediction"]
)

app.include_router(
    suggestions_router,
    prefix="/suggestions",
    tags=["AI Suggestions"]
)


@app.get("/health")
def health():
    return {
        "success": True,
        "message": "ML service is running"
    }