import pandas as pd

from src.ai_assistant import generate_recommendation_summary

phones = pd.read_csv("data/phones.csv")

weights = {
    "camera": 0.4,
    "performance": 0.3,
    "battery": 0.2,
    "value": 0.1,
}

top_phones = [
    phones.iloc[14],   # S24 Ultra
    phones.iloc[11],   # S24 FE
    phones.iloc[8],    # A55
]

summary = generate_recommendation_summary(
    weights,
    top_phones,
)

print(summary)