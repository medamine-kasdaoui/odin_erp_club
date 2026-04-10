from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta

app = FastAPI(title="Finance AI", version="1.0.0")

class LedgerEntry(BaseModel):
    entryDate: datetime
    type: str
    description: str
    amount: float
    status: Optional[str] = None

class PayrollRun(BaseModel):
    periodStart: datetime
    periodEnd: datetime
    totalAmount: float
    status: Optional[str] = None

class TransferTranche(BaseModel):
    dueDate: datetime
    amount: float
    status: Optional[str] = None

class Transfer(BaseModel):
    direction: str
    totalFee: float
    contractYears: int
    tranches: Optional[List[TransferTranche]] = None

class TreasuryAccount(BaseModel):
    name: str
    balance: float
    manual: Optional[bool] = None
    lastReconciledAt: Optional[datetime] = None

class BudgetItem(BaseModel):
    category: str
    threshold: float
    utilized: float

class FinancePayload(BaseModel):
    budgetItems: List[BudgetItem]
    focusCategories: List[str] = []
    ledgerEntries: List[LedgerEntry]
    upcomingTranches: List[TransferTranche] = []
    payrollRuns: List[PayrollRun] = []
    transfers: List[Transfer] = []
    treasuryAccounts: List[TreasuryAccount] = []


def classify_expense(entry: LedgerEntry) -> bool:
    upper = f"{entry.type} {entry.description}".upper()
    expense_keywords = [
        "EXPENSE",
        "DEPENSE",
        "PAYROLL",
        "SALARY",
        "CHARGE",
        "FEE",
        "ACQUISITION",
        "TRANSFER OUT",
    ]
    if entry.amount < 0:
        return True
    return any(k in upper for k in expense_keywords)


def season_key(date: datetime) -> str:
    year = date.year
    month = date.month
    start_year = year if month >= 7 else year - 1
    return f"{start_year}/{start_year + 1}"


def linear_forecast(series: List[float]) -> float:
    n = len(series)
    if n == 0:
        return 0.0
    if n == 1:
        return series[0]
    xs = list(range(n))
    sum_x = sum(xs)
    sum_y = sum(series)
    sum_xy = sum(x * y for x, y in zip(xs, series))
    sum_x2 = sum(x * x for x in xs)
    denom = n * sum_x2 - sum_x * sum_x
    slope = 0.0 if denom == 0 else (n * sum_xy - sum_x * sum_y) / denom
    intercept = sum_y / n - slope * (sum_x / n)
    return intercept + slope * n


def build_forecast(entries: List[LedgerEntry]):
    buckets = {}
    for entry in entries:
        key = season_key(entry.entryDate)
        bucket = buckets.get(key, {"revenue": 0.0, "expense": 0.0, "entryCount": 0})
        amount = abs(entry.amount)
        if classify_expense(entry):
            bucket["expense"] += amount
        else:
            bucket["revenue"] += amount
        bucket["entryCount"] += 1
        buckets[key] = bucket

    seasons = []
    for season, values in buckets.items():
        start_year = int(season.split("/")[0])
        seasons.append(
            {
                "season": season,
                "startYear": start_year,
                "revenue": values["revenue"],
                "expense": values["expense"],
                "net": values["revenue"] - values["expense"],
                "entries": values["entryCount"],
            }
        )
    seasons.sort(key=lambda s: s["startYear"])

    revenue_series = [s["revenue"] for s in seasons]
    expense_series = [s["expense"] for s in seasons]
    forecast_revenue = linear_forecast(revenue_series)
    forecast_expense = linear_forecast(expense_series)

    last_start = seasons[-1]["startYear"] if seasons else datetime.utcnow().year
    next_season = f"{last_start + 1}/{last_start + 2}"
    confidence = min(0.92, 0.4 + len(seasons) * 0.15)

    return {
        "bySeason": [
            {
                "season": s["season"],
                "revenue": round(s["revenue"]),
                "expense": round(s["expense"]),
                "net": round(s["net"]),
                "entries": s["entries"],
            }
            for s in seasons
        ],
        "nextSeason": {
            "season": next_season,
            "revenue": max(0, round(forecast_revenue)),
            "expense": max(0, round(forecast_expense)),
            "net": round(forecast_revenue - forecast_expense),
        },
        "confidence": round(confidence * 100),
    }


def build_cashflow(payload: FinancePayload):
    treasury_balance = sum(a.balance for a in payload.treasuryAccounts)

    now = datetime.utcnow()
    horizon_days = 90
    horizon_limit = now + timedelta(days=horizon_days)

    upcoming = [t for t in payload.upcomingTranches if t.dueDate <= horizon_limit]
    upcoming_outflows = sum(t.amount for t in upcoming if "ACQUISITION" in str(t.status or "") or True)  # direction handled in backend

    # Use transfer direction when provided in transfers
    direction_map = []
    for transfer in payload.transfers:
        if not transfer.tranches:
            continue
        for tranche in transfer.tranches:
            direction_map.append((tranche, transfer.direction))

    upcoming_outflows = 0.0
    upcoming_inflows = 0.0
    for tranche, direction in direction_map:
        if tranche.dueDate > horizon_limit:
            continue
        if direction == "ACQUISITION":
            upcoming_outflows += tranche.amount
        else:
            upcoming_inflows += tranche.amount

    recent_payroll = payload.payrollRuns[:3]
    avg_payroll = (
        sum(r.totalAmount for r in recent_payroll) / len(recent_payroll)
        if recent_payroll
        else 0.0
    )
    payroll_forecast = avg_payroll * 3

    recent_ledger = payload.ledgerEntries[:24]
    if recent_ledger:
        monthly_net = sum(
            (-abs(e.amount) if classify_expense(e) else abs(e.amount))
            for e in recent_ledger
        ) / 6
    else:
        monthly_net = 0.0

    projected_cash = treasury_balance + upcoming_inflows - upcoming_outflows - payroll_forecast + monthly_net * 3
    cash_coverage = projected_cash / upcoming_outflows if upcoming_outflows > 0 else 2

    level = "LOW"
    score = 20
    if projected_cash < 0 or cash_coverage < 0.5:
        level = "HIGH"
        score = 85
    elif cash_coverage < 1.2:
        level = "MEDIUM"
        score = 55

    return {
        "horizonDays": horizon_days,
        "treasuryBalance": round(treasury_balance),
        "projectedCash": round(projected_cash),
        "upcomingOutflows": round(upcoming_outflows + payroll_forecast),
        "upcomingInflows": round(upcoming_inflows),
        "monthlyNet": round(monthly_net),
        "level": level,
        "score": score,
        "notes": [
            f"Couverture cash estimée: {cash_coverage:.2f}x",
            f"Masse salariale projetée (90j): {round(payroll_forecast)}",
            f"Flux net mensuel récent: {round(monthly_net)}",
        ],
    }


def build_sponsor_transfer(payload: FinancePayload):
    sponsor_entries = [
        e for e in payload.ledgerEntries if "SPONSOR" in f"{e.type} {e.description}".upper()
    ]
    sponsor_base = sum(abs(e.amount) for e in sponsor_entries)
    sponsor_plus = sponsor_base * 1.1
    sponsor_minus = sponsor_base * 0.9

    transfer_out = sum(t.totalFee for t in payload.transfers if t.direction == "ACQUISITION")
    transfer_in = sum(t.totalFee for t in payload.transfers if t.direction == "TRANSFER")
    transfer_net = transfer_in - transfer_out

    return {
        "sponsorBase": round(sponsor_base),
        "sponsorPlus10": round(sponsor_plus),
        "sponsorMinus10": round(sponsor_minus),
        "transferNet": round(transfer_net),
        "scenario": {
            "sponsorImpactPlus10": round(sponsor_plus - sponsor_base),
            "sponsorImpactMinus10": round(sponsor_minus - sponsor_base),
            "transferNet": round(transfer_net),
        },
    }


@app.post("/insights")
def insights(payload: FinancePayload):
    start = datetime.utcnow()
    forecast = build_forecast(payload.ledgerEntries)
    cashflow = build_cashflow(payload)
    impact = build_sponsor_transfer(payload)

    generation_ms = int((datetime.utcnow() - start).total_seconds() * 1000)

    return {
        "source": "finance-ml",
        "generatedAt": datetime.utcnow().isoformat(),
        "generationTimeMs": generation_ms,
        "dataPoints": {
            "ledgerEntries": len(payload.ledgerEntries),
            "payrollRuns": len(payload.payrollRuns),
            "transfers": len(payload.transfers),
            "treasuryAccounts": len(payload.treasuryAccounts),
        },
        "forecast": forecast,
        "cashflowRisk": cashflow,
        "sponsorTransferImpact": impact,
    }


@app.get("/health")
def health():
    return {"status": "ok"}
