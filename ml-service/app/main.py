import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from app.routes.anomaly import router as anomaly_router
from app.routes.prediction import router as prediction_router
from app.routes.suggestions import router as suggestions_router

app = FastAPI(
    title="Concurrent File Monitoring ML Service",
    description="Microservice providing anomaly detection, processing time prediction, and resolution suggestions",
    version="1.0.0"
)

# CORS configuration
origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5000")
allowed_origins = [orig.strip() for orig in origins_env.split(",") if orig.strip()]
if not allowed_origins:
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health endpoint
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "concurrent-file-monitoring-ml-service",
        "cors_origins": allowed_origins
    }

# Include routers
app.include_router(anomaly_router, prefix="/anomaly", tags=["Anomaly"])
app.include_router(prediction_router, prefix="/prediction", tags=["Prediction"])
app.include_router(suggestions_router, prefix="/suggestions", tags=["Suggestions"])

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
