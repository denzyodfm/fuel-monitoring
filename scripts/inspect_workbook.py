from __future__ import annotations

import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships", "p": "http://schemas.openxmlformats.org/package/2006/relationships"}


def col_index(ref: str) -> int:
    letters = re.match(r"[A-Z]+", ref).group(0)
    value = 0
    for letter in letters:
        value = value * 26 + ord(letter) - 64
    return value - 1


def main(path: str) -> None:
    workbook_path = Path(path)
    with zipfile.ZipFile(workbook_path) as archive:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = ["".join(t.text or "" for t in item.findall(".//m:t", NS)) for item in root.findall("m:si", NS)]
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
        report: dict[str, object] = {"file": workbook_path.name, "sheets": []}
        for sheet in workbook.findall("m:sheets/m:sheet", NS):
            name = sheet.attrib["name"]
            target = targets[sheet.attrib[f"{{{NS['r']}}}id"]].lstrip("/")
            xml_path = target if target.startswith("xl/") else f"xl/{target}"
            root = ET.fromstring(archive.read(xml_path))
            rows = root.findall("m:sheetData/m:row", NS)
            samples: list[dict[str, object]] = []
            max_col = 0
            for row in rows:
                values: dict[int, object] = {}
                for cell in row.findall("m:c", NS):
                    idx = col_index(cell.attrib["r"])
                    max_col = max(max_col, idx + 1)
                    kind = cell.attrib.get("t")
                    value_node = cell.find("m:v", NS)
                    inline = cell.find("m:is", NS)
                    formula = cell.find("m:f", NS)
                    value: object = None
                    if formula is not None:
                        value = f"={formula.text or ''}"
                    elif kind == "s" and value_node is not None:
                        value = shared[int(value_node.text)]
                    elif kind == "inlineStr" and inline is not None:
                        value = "".join(t.text or "" for t in inline.findall(".//m:t", NS))
                    elif value_node is not None:
                        value = value_node.text
                    if value not in (None, ""):
                        values[idx] = value
                if values and len(samples) < 20:
                    width = min(max(max(values) + 1, 1), 18)
                    samples.append({"row": int(row.attrib["r"]), "values": [str(values.get(i))[:120] if i in values else None for i in range(width)]})
            report["sheets"].append({"name": name, "max_row": max((int(r.attrib["r"]) for r in rows), default=0), "max_column": max_col, "nonempty_rows": len(rows), "sample_rows": samples})
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1])
