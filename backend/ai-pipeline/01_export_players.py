import pandas as pd
from pymongo import MongoClient

# Connect to Mongo
client = MongoClient("mongodb://localhost:27017/")
db = client["club-erp-odin"]

# Fetch only club-odin players
players = list(db.players.find(
    {"providerName": "club-odin"},
    {
        "_id": 0,
        "providerPlayerId": 1,
        "age": 1,
        "position": 1,
        "baseFitness": 1,
        "injuryHistory": 1
    }
))

# Convert to DataFrame
df = pd.DataFrame(players)

# Save CSV
df.to_csv("players.csv", index=False)

print("✅ Exported players:", len(df))
print(df.head())