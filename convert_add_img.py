import json

def load_json(filename):
    with open(filename, encoding="utf-8") as f:
        return json.load(f)

def save_json(filename, data):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def normalize_name(name):
    return name.replace("\n", " ").replace("  ", " ").strip().lower()

def find_player_info(name, players):
    name_norm = normalize_name(name)
    for player in players:
        if normalize_name(player["name"]) in name_norm or name_norm in normalize_name(player["name"]):
            return player
    return None

def main():
    # Carica i dati
    with open("converted_with_img.json", encoding="utf-8") as f:
        converted = json.load(f)
    nba_players = load_json("nba_player_images.json")

    # Aggiorna ogni entry con il campo team
    for entry in converted:
        if len(entry) < 4:
            continue
        name = entry[0]
        player = find_player_info(name, nba_players)
        if player:
            entry[2] = player.get("team", "")
        else:
            entry[2] = ""

    save_json("converted_with_img.json", converted)

if __name__ == "__main__":
    main()