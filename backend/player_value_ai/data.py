import numpy as np
import pandas as pd


def generate_players(n_players: int = 1000, seasons: int = 2, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    player_ids = np.arange(1, n_players + 1)

    rows = []
    for pid in player_ids:
        age = int(rng.integers(17, 35))
        base_minutes = int(rng.integers(500, 3200))
        base_goals = int(rng.integers(0, 20))
        base_assists = int(rng.integers(0, 15))
        base_injuries = int(rng.integers(0, 5))
        base_value = int(
            50000
            + base_minutes * 80
            + base_goals * 12000
            + base_assists * 8000
            - base_injuries * 9000
            + (25 - abs(25 - age)) * 2000
            + rng.normal(0, 20000)
        )
        base_value = max(base_value, 20000)

        for season in range(seasons):
            season_age = age + season
            noise = rng.normal(0, 0.08)
            minutes_played = int(base_minutes * (1 + noise))
            goals = int(max(0, base_goals * (1 + noise)))
            assists = int(max(0, base_assists * (1 + noise)))
            injuries_last_season = int(max(0, base_injuries + rng.integers(-1, 2)))

            value = int(
                base_value
                * (1 + (0.06 if season_age <= 24 else -0.03))
                * (1 + 0.03 * season)
                + rng.normal(0, 15000)
            )
            value = max(value, 15000)

            rows.append(
                {
                    "player_id": pid,
                    "season_index": season,
                    "age": season_age,
                    "minutes_played": minutes_played,
                    "goals": goals,
                    "assists": assists,
                    "injuries_last_season": injuries_last_season,
                    "current_market_value": value,
                }
            )

    return pd.DataFrame(rows)


def simulate_next_season(df: pd.DataFrame, seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    out = df.copy()

    def adj(age, val, scale_up=0.05, scale_down=-0.04):
        change = scale_up if age <= 24 else scale_down
        return val * (1 + change + rng.normal(0, 0.03))

    out["age"] = out["age"] + 1
    out["minutes_played"] = out.apply(lambda r: max(0, int(adj(r["age"], r["minutes_played"], 0.04, -0.05))), axis=1)
    out["goals"] = out.apply(lambda r: max(0, int(adj(r["age"], r["goals"], 0.06, -0.04))), axis=1)
    out["assists"] = out.apply(lambda r: max(0, int(adj(r["age"], r["assists"], 0.05, -0.03))), axis=1)
    out["injuries_last_season"] = out.apply(lambda r: max(0, int(r["injuries_last_season"] + rng.integers(-1, 2))), axis=1)
    return out
