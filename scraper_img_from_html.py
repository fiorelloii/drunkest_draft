import re
import json
from bs4 import BeautifulSoup
import os

INPUT_FILE = "players.html"
OUTPUT_FILE = "nba_player_images.json"

# Carica dati esistenti se presenti
if os.path.exists(OUTPUT_FILE):
    with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
        try:
            results = json.load(f)
        except Exception:
            results = []
else:
    results = []

# Leggi il file HTML
with open(INPUT_FILE, "r", encoding="utf-8") as f:
    html = f.read()

soup = BeautifulSoup(html, "html.parser")

for row in soup.find_all("tr", class_="RosterRow_row__2_hNz"):
    # Player anchor
    player_a = row.find("a", class_="Anchor_anchor__cSc3P RosterRow_playerLink__qw1vG")
    if not player_a:
        continue
    # Nome
    name_div = player_a.find("div", class_="RosterRow_playerName__G28lg")
    if name_div:
        name_parts = [p.get_text(strip=True) for p in name_div.find_all("p")]
        name = " ".join(name_parts)
    else:
        name = player_a.text.strip()
    # Immagine
    img_tag = player_a.find("img", class_="PlayerImage_image__wH_YX PlayerImage_round__bIjPr")
    src = img_tag["src"] if img_tag and img_tag.has_attr("src") else None
    # Team anchor
    team_a = row.find("a", class_="Anchor_anchor__cSc3P RosterRow_team__AunTP")
    team = team_a.text.strip() if team_a else None
    results.append({"src": src, "name": name, "team": team})

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print(f"Totale immagini in {OUTPUT_FILE}: {len(results)}")
