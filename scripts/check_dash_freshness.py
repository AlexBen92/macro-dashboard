"""Freshness SLA checker for dashboard data fluxes.

Separé du kill-switch trading (hl-agent watchdog): un flux dashboard stale
n'empêche pas l'agent de trader (il a ses propres garde-fous), mais doit être
vu aussi vite. Alerte Telegram UNIQUEMENT sur transition OK→STALE (anti-spam)
+ message de recovery STALE→OK.

Cron: */5 * * * * (voir installation)
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path("/var/www/dash-data")
STATE_FILE = Path("/var/tmp/dash_freshness_state.json")
TG_ENV = Path("/root/hermes-telegram/.env")

# SLA par flux: (fichier, as_of key candidates, max_age_minutes)
FLUXES = [
    ("regime", "regime_status.json", ("as_of",), 26 * 60),
    ("m15", "edge_m15_status.json", ("last_export_success", "as_of"), 20),
    ("decision", "decision_btceth_status.json", ("last_export_success", "as_of"), 20),
    ("orderflow", "orderflow_status.json", ("last_export_success", "as_of"), 20),
    ("regime_matrix", "regime_matrix.json", ("as_of",), 26 * 60),
    # as_of = mardi du rapport CFTC (publication vendredi J+3) — âge pire-cas
    # 11j à cadence hebdo, seuil 12j = semaine manquée
    ("cot", "cot_status.json", ("as_of",), 12 * 24 * 60),
    ("event_impact", "event_impact_status.json", ("last_export_success", "as_of"), 26 * 60),
]


def load_tg_creds() -> tuple[str, str] | None:
    token = chat = None
    try:
        for line in TG_ENV.read_text().splitlines():
            if line.startswith("TELEGRAM_BOT_TOKEN="):
                token = line.split("=", 1)[1].strip()
            elif line.startswith("TELEGRAM_CHAT_ID="):
                chat = line.split("=", 1)[1].strip()
    except OSError:
        return None
    if not token or not chat:
        return None
    return token, chat


def send_tg(token: str, chat: str, text: str) -> None:
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = urllib.parse.urlencode({"chat_id": chat, "text": text}).encode()
    req = urllib.request.Request(url, data=payload)
    try:
        urllib.request.urlopen(req, timeout=10)
    except (urllib.error.URLError, OSError) as exc:
        print(f"[warn] TG send failed: {exc}", file=sys.stderr)


def flux_age_minutes(name: str, filename: str, keys: tuple[str, ...]) -> float | None:
    path = DATA_DIR / filename
    try:
        data = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return None
    raw = next((data[k] for k in keys if isinstance(data.get(k), str)), None)
    if raw is None:
        return None
    try:
        ts = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - ts).total_seconds() / 60


def main() -> int:
    now_stale: dict[str, float | None] = {}
    for name, filename, keys, _max in FLUXES:
        now_stale[name] = flux_age_minutes(name, filename, keys)

    violations: list[str] = []
    stale_by_flux: dict[str, bool] = {}
    for name, _f, _k, max_min in FLUXES:
        age = now_stale[name]
        if age is None:
            violations.append(f"{name}: DONNÉE ABSENTE/ILLISIBLE")
            stale_by_flux[name] = True
        elif age > max_min:
            violations.append(f"{name}: {age:.0f}min (SLA {max_min}min)")
            stale_by_flux[name] = True
        else:
            stale_by_flux[name] = False

    prev: dict[str, bool] = {}
    try:
        prev = json.loads(STATE_FILE.read_text())
    except (OSError, json.JSONDecodeError):
        pass

    creds = load_tg_creds()
    alerts: list[str] = []
    recoveries: list[str] = []
    for name, _f, _k, _max in FLUXES:
        was = bool(prev.get(name, False))
        is_now = stale_by_flux[name]
        if is_now and not was:
            match = next((v for v in violations if v.startswith(f"{name}:")), name)
            alerts.append(match)
        elif not is_now and was:
            recoveries.append(name)
        prev[name] = is_now

    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(prev))

    if creds and (alerts or recoveries):
        token, chat = creds
        lines = ["⚠️ DASHBOARD DATA — SLA fraîcheur (pas trading)"]
        lines += [f"• STALE: {a}" for a in alerts]
        lines += [f"• OK récupéré: {r}" for r in recoveries]
        send_tg(token, chat, "\n".join(lines))

    status = "STALE" if violations else "OK"
    print(f"[{status}] " + ("; ".join(violations) if violations else "all fluxes fresh"))
    for name, _f, _k, _m in FLUXES:
        age = now_stale[name]
        print(f"  {name}: age={round(age, 1) if age is not None else 'ABSENT'}min")
    return 0


if __name__ == "__main__":
    sys.exit(main())
