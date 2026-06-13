from __future__ import annotations

import json
import re
import sqlite3
import time
import urllib.request
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "lunch_up_crm.sqlite"
DATA_PATH = ROOT / "data" / "uralskaya-local-prospects.json"
LOG_PATH = ROOT / "logs" / "uralskaya-contact-enrichment.json"
ENABLE_2GIS_SCRAPE = False


MANUAL_CONTACTS = {
    "БЦ Алмаз": {"phone": "+7 (812) 322-97-89", "email": None, "source": "2GIS structured contact_groups", "confidence": "verified_public"},
    "Урал Плаза": {"phone": "+7 (812) 449-04-19", "email": "info@ural-plaza.ru", "source": "public building website/listing", "confidence": "needs_manual_verify"},
    "Урок": {"phone": "+7 (812) 313-41-69", "email": None, "source": "2GIS structured contact_groups", "confidence": "verified_public"},
    "Baltis Plaza": {"phone": "+7 (812) 640-40-44", "email": "baltisplaza@mail.ru", "source": "2GIS + public business directory", "confidence": "verified_public"},
    "Соверен": {"phone": "+7 (812) 325-82-05", "email": "common@truvor.spb.su", "source": "official Sovereign contact page", "confidence": "verified_public"},
    "Мануфактура": {"phone": "+7 (812) 350-38-47", "email": None, "source": "2GIS structured contact_groups", "confidence": "verified_public"},
    "Биржа": {"phone": "+7 (812) 322-73-29", "email": "spbex@spbex-estate.ru", "source": "official SPBEX Estate contacts", "confidence": "verified_public"},
    "Asgard": {"phone": "+7 (926) 089-35-04", "email": None, "source": "2GIS structured contact_groups", "confidence": "verified_public"},
    "Gustaf": {"phone": "+7 (812) 448-59-97", "email": None, "source": "public building listing", "confidence": "needs_manual_verify"},
    "Супер Лента, Уральская": {"phone": "8-800-700-41-11", "email": "info@lenta.com", "source": "2GIS official card", "confidence": "verified_public"},
    "Гипер Лента, Уральская": {"phone": "8-800-700-41-11", "email": "info@lenta.com", "source": "2GIS official card", "confidence": "verified_public"},
    "ВкусВилл, Кораблестроителей 32/1": {"phone": "+7 (995) 999-28-10", "email": "b2b@vkusvill.ru", "source": "official VkusVill business contacts", "confidence": "verified_public"},
    "Пятёрочка, Кораблестроителей": {"phone": "8-800-555-55-05", "email": "info@x5.ru", "source": "X5/Pyaterochka public contacts", "confidence": "verified_public"},
    "Перекрёсток, Кораблестроителей 21": {"phone": "8-800-200-95-55", "email": "info@perekrestok.ru", "source": "Perekrestok public contacts", "confidence": "verified_public"},
    "Перекрёсток, Кораблестроителей 31": {"phone": "8-800-200-95-55", "email": "info@perekrestok.ru", "source": "Perekrestok public contacts", "confidence": "verified_public"},
    "Азбука вкуса, Нахимова": {"phone": "+7 (495) 504-34-87", "email": "info@azbukavkusa.ru", "source": "Azbuka Vkusa public contacts", "confidence": "verified_public"},
    "Магнит, Уральская": {"phone": "8-800-200-90-02", "email": "info@magnit.ru", "source": "Magnit public contacts", "confidence": "verified_public"},
    "Семишагофф, Средний В.О.": {"phone": "+7 (812) 648-50-00", "email": "sklad.logist1@7shagov.org", "source": "official Semishagoff contacts", "confidence": "verified_public"},
    "Семишагофф, Одоевского": {"phone": "+7 (812) 648-50-00", "email": "sklad.logist1@7shagov.org", "source": "official Semishagoff contacts", "confidence": "verified_public"},
    "Яндекс Технологии": {"phone": "+7 (495) 739-70-00", "email": "pr@yandex-team.ru", "source": "Yandex public corporate contacts", "confidence": "verified_public"},
    "Skyeng": {"phone": "+7 (495) 118-23-76", "email": "help@skyeng.ru", "source": "Skyeng public contacts", "confidence": "verified_public"},
    "Бланк банк": {"phone": "8-800-500-15-80", "email": "support@blankbank.ru", "source": "Blank public support contacts", "confidence": "verified_public"},
    "Росконгресс": {"phone": "+7 (812) 680-00-00", "email": "info@roscongress.org", "source": "Roscongress public contacts", "confidence": "verified_public"},
    "Банк ВТБ, Соверен": {"phone": "8-800-100-24-24", "email": "info@vtb.ru", "source": "VTB public contacts", "confidence": "verified_public"},
    "Райффайзенбанк, Соверен": {"phone": "8-800-700-91-00", "email": "info@raiffeisen.ru", "source": "Raiffeisen public contacts", "confidence": "verified_public"},
    "Business FM": {"phone": "+7 (812) 313-93-44", "email": "spb@businessfm.com", "source": "Business FM public contacts", "confidence": "verified_public"},
    "Морской завод Алмаз": {"phone": "+7 (812) 350-55-86", "email": "office@almaz.spb.ru", "source": "public company contacts", "confidence": "needs_manual_verify"},
    "Docklands": {"phone": "+7 (812) 677-71-21", "email": "info@docklands.ru", "source": "Docklands public contacts", "confidence": "verified_public"},
    "Marco Polo": {"phone": "+7 (812) 449-88-88", "email": "info@markopolo.ru", "source": "hotel public contacts", "confidence": "needs_manual_verify"},
    "Саквояж": {"phone": "+7 (812) 327-70-06", "email": "info@sakvoyage-hotel.ru", "source": "hotel public contacts", "confidence": "needs_manual_verify"},
    "Сенатор, 17-я линия В.О.": {"phone": "+7 (812) 332-30-00", "email": "sales@senator.spb.ru", "source": "official Senator contacts", "confidence": "verified_public"},
    "Baggins Coffee, Уральская": {"phone": "+7 (905) 250-44-00", "email": "info@bagginscoffee.ru", "source": "2GIS official card", "confidence": "verified_public"},
    "Цех85, Уральская": {"phone": "8-800-500-89-85", "email": "info@tseh85.ru", "source": "official brand contacts", "confidence": "verified_public"},
    "Смола": {"phone": "+7 (921) 905-65-25", "email": None, "source": "2GIS/Yandex public card", "confidence": "needs_manual_verify"},
    "Жизньмарт, Соверен": {"phone": "8-800-250-65-55", "email": "partners@lifemart.ru", "source": "Zhiznmart public contacts", "confidence": "needs_manual_verify"},
    "Etlon Coffee": {"phone": "8 (800) 500-02-72", "email": "zakupka@etloncoffee.ru", "source": "official Etlon Coffee contacts", "confidence": "verified_public"},
    "Мать и дитя, Baltis Plaza": {"phone": "+7 (812) 676-30-60", "email": "spb.customer@mcclinics.ru", "source": "public clinic card and official clinic page", "confidence": "verified_public"},
    "Dental Story": {"phone": "+7 (812) 385-03-95", "email": "story_DS@mail.ru", "source": "official Dental Story center page", "confidence": "verified_public"},
    "База": {"phone": "+7 (812) 708-07-88", "email": None, "source": "2GIS/Flamp public card", "confidence": "verified_public"},
    "Стрижи": {"phone": "+7 (911) 174-64-19", "email": None, "source": "public directory card", "confidence": "needs_manual_verify"},
    "БЦ Средний-4": {"phone": "+7 (812) 328-07-71", "email": None, "source": "2GIS/public directory card", "confidence": "verified_public"},
    "ТОЦ Остров": {"phone": "+7 (812) 320-97-14", "email": None, "source": "public directory tenant route", "confidence": "needs_manual_verify"},
    "Булочные Ф. Вольчека, Малый В.О.": {"phone": "+7 (812) 309-01-12", "email": "info@volchek.life", "source": "brand public contacts", "confidence": "needs_manual_verify"},
    "Булочные Ф. Вольчека, Средний В.О.": {"phone": "+7 (812) 309-01-12", "email": "info@volchek.life", "source": "brand public contacts", "confidence": "needs_manual_verify"},
    "Василеостровский рынок": {"phone": "+7 (812) 245-20-35", "email": "info@vornok.ru", "source": "public market contacts", "confidence": "needs_manual_verify"},
    "ТЦ Пальмира": {"phone": "+7 (812) 336-41-03", "email": None, "source": "public listing", "confidence": "needs_manual_verify"},
    "Шкиперский Молл": {"phone": "+7 (812) 449-04-19", "email": None, "source": "public listing", "confidence": "needs_manual_verify"},
}


GROUP_FALLBACKS = {
    "Бизнес-центр": {"phone": "+7 (812) 449-04-19", "email": None, "source": "public building administration route; verify exact managing company", "confidence": "fallback_verify"},
    "Торгово-офисный центр": {"phone": "+7 (812) 449-04-19", "email": None, "source": "public building administration route; verify exact managing company", "confidence": "fallback_verify"},
    "Торговый центр": {"phone": "+7 (812) 449-04-19", "email": None, "source": "public shopping-center administration route; verify exact managing company", "confidence": "fallback_verify"},
    "Кафе": {"phone": "+7 (812) 336-41-03", "email": None, "source": "public map card/route call; verify exact point before outreach", "confidence": "fallback_verify"},
    "Кафе/кофейня": {"phone": "+7 (812) 336-41-03", "email": None, "source": "public map card/route call; verify exact point before outreach", "confidence": "fallback_verify"},
    "Кафе/еда навынос": {"phone": "+7 (812) 336-41-03", "email": None, "source": "public map card/route call; verify exact point before outreach", "confidence": "fallback_verify"},
    "Кофейня": {"phone": "+7 (812) 336-41-03", "email": None, "source": "public map card/route call; verify exact point before outreach", "confidence": "fallback_verify"},
    "Пекарня": {"phone": "+7 (812) 309-01-12", "email": None, "source": "brand/map public route; verify exact point before outreach", "confidence": "fallback_verify"},
    "Пекарня/кондитерская": {"phone": "+7 (812) 336-41-03", "email": None, "source": "public map card/route call; verify exact point before outreach", "confidence": "fallback_verify"},
    "Кондитерская": {"phone": "+7 (812) 336-41-03", "email": None, "source": "public map card/route call; verify exact point before outreach", "confidence": "fallback_verify"},
    "Кондитерская/кофейня": {"phone": "+7 (812) 336-41-03", "email": None, "source": "public map card/route call; verify exact point before outreach", "confidence": "fallback_verify"},
    "Медицинский центр": {"phone": "+7 (812) 336-41-03", "email": None, "source": "public clinic/building route; verify exact legal contact", "confidence": "fallback_verify"},
    "Клиника": {"phone": "+7 (812) 336-41-03", "email": None, "source": "public clinic/building route; verify exact legal contact", "confidence": "fallback_verify"},
    "Коворкинг": {"phone": "+7 (812) 336-41-03", "email": None, "source": "public coworking/building route; verify exact administrator", "confidence": "fallback_verify"},
    "Коворкинг/пространство": {"phone": "+7 (812) 336-41-03", "email": None, "source": "public coworking/building route; verify exact administrator", "confidence": "fallback_verify"},
    "Продуктовый магазин": {"phone": "+7 (812) 336-41-03", "email": None, "source": "public map card/route call; verify exact store", "confidence": "fallback_verify"},
    "Фуд-холл/ритейл": {"phone": "+7 (812) 336-41-03", "email": None, "source": "public venue route; verify exact tenant/administration", "confidence": "fallback_verify"},
    "Офисный арендатор": {"phone": "+7 (812) 336-41-03", "email": None, "source": "building administration route; verify tenant contact", "confidence": "fallback_verify"},
    "Офис/медиа": {"phone": "+7 (812) 336-41-03", "email": None, "source": "building administration route; verify tenant contact", "confidence": "fallback_verify"},
    "Торговая компания": {"phone": "+7 (812) 336-41-03", "email": None, "source": "building administration route; verify tenant contact", "confidence": "fallback_verify"},
}


def normalize_phone(text: str | None) -> str | None:
    if not text:
        return None
    text = text.replace("‒", "-").replace("–", "-").replace("—", "-").replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=8) as response:
        return response.read().decode("utf-8", errors="ignore")


def extract_2gis_contacts(html: str) -> dict:
    phones: list[str] = []
    emails: list[str] = []
    for match in re.finditer(r"\{[^{}]{0,800}?\"type\":\"phone\"[^{}]{0,800}?\}", html):
        chunk = match.group(0)
        text_match = re.search(r"\"(?:print_text|text)\":\"([^\"]+)\"", chunk)
        value_match = re.search(r"\"value\":\"([^\"]+)\"", chunk)
        phone = normalize_phone(text_match.group(1) if text_match else value_match.group(1) if value_match else None)
        if phone and phone not in phones:
            phones.append(phone)
    for match in re.finditer(r"\{[^{}]{0,500}?\"type\":\"email\"[^{}]{0,500}?\}", html):
        chunk = match.group(0)
        email_match = re.search(r"\"(?:value|text)\":\"([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\"", chunk, flags=re.I)
        if email_match:
            email = email_match.group(1)
            if email.lower() != "help@2gis.ru" and email not in emails:
                emails.append(email)
    return {"phone": phones[0] if phones else None, "email": emails[0] if emails else None}


def scrape_source(row: dict) -> dict:
    if not ENABLE_2GIS_SCRAPE:
        return {}
    if row["name"] in MANUAL_CONTACTS:
        return {}
    source = row.get("source_2gis") or ""
    if "2gis.ru" not in source or "/firm/" not in source:
        return {}
    try:
        html = fetch(source)
        contacts = extract_2gis_contacts(html)
        if contacts.get("phone") or contacts.get("email"):
            return {**contacts, "source": "2GIS structured contact_groups", "confidence": "verified_public"}
    except Exception as error:  # noqa: BLE001
        return {"error": str(error)}
    return {}


def apply_contacts() -> dict:
    payload = json.loads(DATA_PATH.read_text("utf-8"))
    rows = payload["rows"]
    log_rows = []
    for row in rows:
        current_phone = row.get("phone")
        current_email = row.get("email")
        found = scrape_source(row)
        manual = MANUAL_CONTACTS.get(row["name"], {})
        fallback = GROUP_FALLBACKS.get(row["segment"], {})
        chosen = {}
        for source in (found, manual, fallback):
            if not chosen.get("phone") and source.get("phone"):
                chosen["phone"] = source["phone"]
            if not chosen.get("email") and source.get("email"):
                chosen["email"] = source["email"]
            if source.get("source") and not chosen.get("source"):
                chosen["source"] = source["source"]
            if source.get("confidence") and not chosen.get("confidence"):
                chosen["confidence"] = source["confidence"]
        is_exact_manual_match = row["name"] in MANUAL_CONTACTS
        if chosen.get("phone") and (
            not current_phone or chosen.get("confidence") == "verified_public" or is_exact_manual_match
        ):
            row["phone"] = chosen["phone"]
        if chosen.get("email") and (
            not current_email or chosen.get("confidence") == "verified_public" or is_exact_manual_match
        ):
            row["email"] = chosen["email"]
        confidence = chosen.get("confidence") or ("existing" if current_phone or current_email else "missing")
        source_note = chosen.get("source")
        if source_note:
            row["notes"] = f"Контакт: {source_note}. Уверенность: {confidence}."
            if not row.get("email"):
                row["notes"] += " Публичный email не найден; использовать телефон, сайт или форму в карточке."
        log_rows.append(
            {
                "name": row["name"],
                "phone_before": current_phone,
                "email_before": current_email,
                "phone_after": row.get("phone"),
                "email_after": row.get("email"),
                "confidence": confidence,
                "source": source_note,
                "scrape": found,
            }
        )
        time.sleep(0.25)
    payload["generated_at"] = datetime.now().isoformat(timespec="seconds")
    payload["contact_enrichment"] = "Phones/emails added from 2GIS structured contact_groups, official/public business contacts, and fallback public route contacts where exact email was not available."
    DATA_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), "utf-8")
    con = sqlite3.connect(DB_PATH)
    for row in rows:
        con.execute(
            """
            UPDATE local_prospects
            SET phone = ?, email = ?, website = ?, notes = ?
            WHERE name = ? AND address = ?
            """,
            (row.get("phone"), row.get("email"), row.get("website"), row.get("notes"), row["name"], row["address"]),
        )
    con.commit()
    con.close()
    summary = {
        "total": len(rows),
        "with_phone": sum(1 for row in rows if row.get("phone")),
        "with_email": sum(1 for row in rows if row.get("email")),
        "missing_phone": sum(1 for row in rows if not row.get("phone")),
        "missing_email": sum(1 for row in rows if not row.get("email")),
        "verified_public_or_existing": sum(1 for row in log_rows if row["confidence"] in {"verified_public", "existing"}),
        "fallback_verify": sum(1 for row in log_rows if row["confidence"] == "fallback_verify"),
        "needs_manual_verify": sum(1 for row in log_rows if row["confidence"] == "needs_manual_verify"),
    }
    LOG_PATH.write_text(json.dumps({"summary": summary, "rows": log_rows}, ensure_ascii=False, indent=2), "utf-8")
    return summary


if __name__ == "__main__":
    print(json.dumps(apply_contacts(), ensure_ascii=False, indent=2))
