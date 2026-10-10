import re
import pandas as pd
from typing import Dict, Any

def clean_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """
    Standardize text strings and whitespace in row records.
    """
    cleaned = {}
    for k, v in record.items():
        if isinstance(v, str):
            cleaned[k.strip().lower()] = v.strip()
        else:
            cleaned[k.strip().lower()] = v
    return cleaned

def extract_numeric_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Extracts numerical features for model inference.
    """
    numeric_cols = df.select_dtypes(include=['number']).columns
    return df[numeric_cols].fillna(0)
