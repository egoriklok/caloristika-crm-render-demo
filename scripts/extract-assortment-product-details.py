import json
import os
import re
import sys
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DOCX = Path(r"C:\Users\egori\OneDrive\Рабочий стол\lanch up\Внешний Ассортимент Lunch-UP 2026.docx")
OUTPUT = ROOT / "data" / "product-details-from-assortment.json"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def cell_text(cell: ET.Element) -> str:
    text = "".join((node.text or "") for node in cell.findall(".//w:t", NS))
    return re.sub(r"\s+", " ", text).strip()


def parse_int(value: str) -> int | None:
    match = re.search(r"\d+", value or "")
    return int(match.group(0)) if match else None


def parse_price(value: str) -> float | None:
    cleaned = (value or "").replace("₽", "").replace(" ", "").replace(",", ".")
    match = re.search(r"\d+(?:\.\d+)?", cleaned)
    return float(match.group(0)) if match else None


def main() -> int:
    docx = Path(os.environ.get("LUNCH_UP_ASSORTMENT_DOCX") or (sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DOCX))
    if not docx.exists():
        raise SystemExit(f"Assortment docx not found: {docx}")

    with ZipFile(docx) as archive:
        document_xml = archive.read("word/document.xml")
    root = ET.fromstring(document_xml)
    tables = root.findall(".//w:tbl", NS)
    if not tables:
        raise SystemExit("No tables found in assortment docx")

    rows = tables[0].findall("./w:tr", NS)
    header = [cell_text(cell) for cell in rows[0].findall("./w:tc", NS)]
    required = ["Категория", "Наименование", "Штрих-код", "Вес нетто(+- 10 гр)", "Состав", "Б/Ж/У порция", "ОСГ, сутки", "Цена"]
    if header[: len(required)] != required:
        raise SystemExit(f"Unexpected header: {header}")

    products = []
    current_category = ""
    for row in rows[1:]:
        cells = [cell_text(cell) for cell in row.findall("./w:tc", NS)]
        if len(cells) < 8:
            continue
        category, name, barcode, net_weight, composition, nutrition, shelf_life, price = cells[:8]
        if category:
            current_category = category
        if not name or not barcode:
            continue
        products.append(
            {
                "category": current_category,
                "name": name,
                "barcode": barcode,
                "net_weight": net_weight.replace("гр", "г").strip(),
                "composition": composition,
                "nutrition": nutrition,
                "shelf_life_days": parse_int(shelf_life),
                "price": parse_price(price),
                "source_file": str(docx)
            }
        )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({"source_file": str(docx), "product_count": len(products), "products": products}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "output": str(OUTPUT), "product_count": len(products)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
