from typing import List, Dict, Any
from rapidfuzz import process, fuzz

class SuggestionEngineService:
    def __init__(self):
        # Sample master reference dictionaries for quick fuzzy resolution
        self.known_currencies = ["USD", "EUR", "INR", "GBP", "JPY", "CAD", "AUD", "SGD", "CHF", "AED"]
        self.known_ifsc = ["SBIN0001234", "HDFC0000456", "ICIC0000789", "KKBK0000321", "BARB0MAINXX"]

    def suggest_currency(self, invalid_code: str) -> List[Dict[str, Any]]:
        """
        Fuzzy match invalid currency code against master currencies using RapidFuzz.
        """
        results = process.extract(invalid_code.upper(), self.known_currencies, scorer=fuzz.ratio, limit=3)
        return [{"suggestion": match, "confidence": score / 100.0} for match, score, _ in results]

    def suggest_ifsc(self, invalid_ifsc: str) -> List[Dict[str, Any]]:
        """
        Fuzzy match invalid IFSC code against master IFSC records using RapidFuzz.
        """
        results = process.extract(invalid_ifsc.upper(), self.known_ifsc, scorer=fuzz.ratio, limit=3)
        return [{"suggestion": match, "confidence": score / 100.0} for match, score, _ in results]

suggestion_engine = SuggestionEngineService()
