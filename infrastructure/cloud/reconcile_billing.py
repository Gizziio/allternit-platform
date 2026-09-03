#!/usr/bin/env python3
"""Daily billing reconciliation for Allternit Cloud.

Runs on the control-plane VPS (`mail`) once a day via reconcile-billing.timer.
Checks, prints one line per check, and posts firing alerts to the local
Alertmanager on threshold breaches. Always exits 0: alerting is the output,
not the exit code.

Checks:
1. wholesale inference spend over the last 24h vs DAILY_WHOLESALE_ALERT_USD
   (default 50).
2. metering gap: inference_usage rows in the last 24h belonging to users who
   HAVE a user_credits row but have fewer 'inference' credit_transactions
   ledger rows than usage rows in the window (deductions are keyed
   'inference-<uuid>'; see CostService::deduct_credits_for_usage).
3. hosted runtime billed hours over the last 24h (info only, always logged).

Database access goes through psql: env RECONCILE_DSN (a libpq DSN) when set,
otherwise the local cluster as the postgres superuser (sudo -u postgres psql).
"""

import json
import os
import subprocess
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

ALERTMANAGER_URL = "http://localhost:9093/api/v1/alerts"

QUERIES = {
    "wholesale_spend_24h": """
        SELECT COALESCE(SUM(wholesale_cost_usd), 0)
        FROM inference_usage
        WHERE created_at >= NOW() - INTERVAL '24 hours'
    """,
    # Per-user: more usage rows than inference ledger rows in the window means
    # the settlement deduction was missed (REVENUE-CRITICAL path swallowed it).
    "metering_gap_24h": """
        WITH usage24 AS (
            SELECT iu.user_id, COUNT(*) AS cnt
            FROM inference_usage iu
            JOIN user_credits uc ON uc.user_id = iu.user_id
            WHERE iu.created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY iu.user_id
        ),
        ledger24 AS (
            SELECT user_id, COUNT(*) AS cnt
            FROM credit_transactions
            WHERE source = 'inference' AND created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY user_id
        )
        SELECT COUNT(*), COALESCE(SUM(usage24.cnt - COALESCE(ledger24.cnt, 0)), 0)
        FROM usage24
        LEFT JOIN ledger24 ON ledger24.user_id = usage24.user_id
        WHERE usage24.cnt > COALESCE(ledger24.cnt, 0)
    """,
    "hosted_billed_hours_24h": """
        SELECT COALESCE(SUM(duration_seconds), 0) / 3600.0
        FROM hosted_runtime_usage_sessions
        WHERE started_at >= NOW() - INTERVAL '24 hours'
    """,
}


def psql_scalar(sql):
    """Run a single-value query, returning the first column of the first row."""
    dsn = os.environ.get("RECONCILE_DSN")
    if dsn:
        cmd = ["psql", dsn, "-AtXc", sql]
    else:
        cmd = ["sudo", "-u", "postgres", "psql", "postgresql:///allternit", "-AtXc", sql]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(f"psql failed: {result.stderr.strip()}")
    return result.stdout.strip()


def alert(check, annotations):
    """POST a firing alert to the local Alertmanager."""
    now = datetime.now(timezone.utc)
    payload = [
        {
            "labels": {
                "alertname": "BillingReconciliation",
                "severity": "critical",
                "check": check,
            },
            "annotations": annotations,
            "startsAt": now.isoformat(),
            "endsAt": (now + timedelta(minutes=10)).isoformat(),
        }
    ]
    request = urllib.request.Request(
        ALERTMANAGER_URL,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            response.read()
        print(f"ALERT {check}: posted to Alertmanager", flush=True)
    except Exception as error:  # noqa: BLE001 — alerting must never crash the report
        print(f"ERROR posting alert {check} to Alertmanager: {error}", file=sys.stderr, flush=True)


def main():
    wholesale_alert_usd = float(os.environ.get("DAILY_WHOLESALE_ALERT_USD", "50"))

    # 1. Wholesale inference spend, last 24h.
    try:
        wholesale = float(psql_scalar(QUERIES["wholesale_spend_24h"]) or 0)
        print(f"wholesale_spend_24h=${wholesale:.2f} (alert>${wholesale_alert_usd:.2f})", flush=True)
        if wholesale > wholesale_alert_usd:
            alert(
                "wholesale_spend_24h",
                {
                    "summary": f"Inference wholesale spend ${wholesale:.2f} in the last 24h",
                    "wholesale_usd": f"{wholesale:.2f}",
                    "threshold_usd": f"{wholesale_alert_usd:.2f}",
                },
            )
    except Exception as error:  # noqa: BLE001
        print(f"ERROR wholesale_spend_24h: {error}", file=sys.stderr, flush=True)

    # 2. Metering gap: usage rows without matching ledger deductions.
    try:
        row = psql_scalar(QUERIES["metering_gap_24h"]) or "0|0"
        users_with_gap, missing_rows = (row.split("|") + ["0"])[:2]
        users_with_gap, missing_rows = int(users_with_gap), int(float(missing_rows))
        print(
            f"metering_gap_24h users_with_gap={users_with_gap} missing_deductions={missing_rows}",
            flush=True,
        )
        if users_with_gap > 0:
            alert(
                "metering_gap_24h",
                {
                    "summary": (
                        f"{users_with_gap} user(s) have {missing_rows} inference usage "
                        "row(s) without credit deductions in the last 24h"
                    ),
                    "users_with_gap": str(users_with_gap),
                    "missing_deductions": str(missing_rows),
                },
            )
    except Exception as error:  # noqa: BLE001
        print(f"ERROR metering_gap_24h: {error}", file=sys.stderr, flush=True)

    # 3. Hosted runtime billed hours, last 24h (info only).
    try:
        hours = float(psql_scalar(QUERIES["hosted_billed_hours_24h"]) or 0)
        print(f"hosted_billed_hours_24h={hours:.2f}", flush=True)
    except Exception as error:  # noqa: BLE001
        print(f"ERROR hosted_billed_hours_24h: {error}", file=sys.stderr, flush=True)


if __name__ == "__main__":
    main()
    sys.exit(0)
