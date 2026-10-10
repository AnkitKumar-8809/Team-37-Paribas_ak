from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any
from app.services.suggestion_engine import suggestion_engine

router = APIRouter()

class SuggestionRequest(BaseModel):
    field: str
    invalidValue: str

class SuggestionResponse(BaseModel):
    field: str
    originalValue: str
    suggestions: List[Dict[str, Any]]

@router.post("/suggest-fix", response_model=SuggestionResponse)
def suggest_fix(req: SuggestionRequest):
    if req.field.lower() == "currency":
        results = suggestion_engine.suggest_currency(req.invalidValue)
    elif req.field.lower() == "ifsc":
        results = suggestion_engine.suggest_ifsc(req.invalidValue)
    else:
        results = []

    return SuggestionResponse(
        field=req.field,
        originalValue=req.invalidValue,
        suggestions=results
    )
