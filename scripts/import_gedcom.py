"""Turn a Family Echo GEDCOM export into the small public tree payload."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source" / "family.ged"
TARGET = ROOT / "public" / "family-data.js"


def records(text):
    current = None
    for line in text.splitlines():
        match = re.match(r"0 @([^@]+)@ (INDI|FAM)$", line)
        if match:
            if current:
                yield current
            current = {"id": match[1], "type": match[2], "lines": []}
        elif line.startswith("0 "):
            if current:
                yield current
            current = None
        elif current:
            current["lines"].append(line)
    if current:
        yield current


def field(lines, tag):
    for line in lines:
        match = re.match(rf"1 {tag}(?: (.*))?$", line)
        if match:
            return match[1] or ""
    return ""


def references(lines, tag):
    return [match[1] for line in lines if (match := re.match(rf"1 {tag} @([^@]+)@$", line))]


people = []
families = []
for record in records(SOURCE.read_text(encoding="utf-8-sig")):
    lines = record["lines"]
    if record["type"] == "INDI":
        name = field(lines, "NAME").replace("/", "").strip()
        deceased = any(re.match(r"1 DEAT(?: |$)", line) for line in lines)
        people.append({"id": record["id"], "name": name or "שם לא ידוע", "deceased": deceased})
    else:
        families.append({
            "id": record["id"],
            "parents": [value for tag in ("HUSB", "WIFE") for value in references(lines, tag)],
            "children": references(lines, "CHIL"),
        })

ids = {person["id"] for person in people}
for family in families:
    if any(person not in ids for person in family["parents"] + family["children"]):
        raise ValueError(f"Missing person referenced by {family['id']}")

TARGET.parent.mkdir(parents=True, exist_ok=True)
TARGET.write_text("window.FAMILY_DATA = " + json.dumps({"people": people, "families": families}, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
print(f"Wrote {len(people)} people and {len(families)} families")
