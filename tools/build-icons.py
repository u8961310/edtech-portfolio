"""關卡圖示：下載 Microsoft Fluent Emoji（3D，MIT）並縮成 128px webp → assets/unit-icons/（含授權檔）。
什麼時候要跑：新增關卡、要換某關圖示時。先在下面 SRC 加「檔名: Fluent 路徑」，再到 island/data.js 的 ICON 對應 emoji → 檔名。
找路徑：gh api "repos/microsoft/fluentui-emoji/git/trees/main?recursive=1" --jq '.tree[].path' | grep -i "<英文名>.*_3d"
  （資料夾大小寫不一，例 T-rex/3D/t-rex_3d.png；人物類在 Default/3D/ 底下）
用法（repo 根目錄）：python tools/build-icons.py　　需要：pip install pillow
"""
import io, urllib.parse, urllib.request
from pathlib import Path
from PIL import Image

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "assets" / "unit-icons"; OUT.mkdir(parents=True, exist_ok=True)
BASE = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/"
# 檔名 → Fluent 路徑
SRC = {
    "rabbit": "assets/Rabbit face/3D/rabbit_face_3d.png",
    "computer-mouse": "assets/Computer mouse/3D/computer_mouse_3d.png",
    "carrot": "assets/Carrot/3D/carrot_3d.png",
    "hatching-chick": "assets/Hatching chick/3D/hatching_chick_3d.png",   # 滑鼠島 unit33 敲敲蛋寶寶（2026-11-22）
    "magic-wand": "assets/Magic wand/3D/magic_wand_3d.png",             # unit34 右鍵魔法師
    "octopus": "assets/Octopus/3D/octopus_3d.png",                      # unit35 海底捲捲探險
    "ewe": "assets/Ewe/3D/ewe_3d.png",                                  # unit36 牧場圍圍樂
    "hamster": "assets/Hamster/3D/hamster_3d.png",
    "rocket": "assets/Rocket/3D/rocket_3d.png",
    "t-rex": "assets/T-rex/3D/t-rex_3d.png",
    "evergreen-tree": "assets/Evergreen tree/3D/evergreen_tree_3d.png",
    "sparkles": "assets/Sparkles/3D/sparkles_3d.png",
    "turtle": "assets/Turtle/3D/turtle_3d.png",
    "mage": "assets/Person mage/Default/3D/person_mage_3d_default.png",
    "brain": "assets/Brain/3D/brain_3d.png",
    "dog": "assets/Dog face/3D/dog_face_3d.png",
    "basket": "assets/Basket/3D/basket_3d.png",
    "socks": "assets/Socks/3D/socks_3d.png",
    "pot-of-food": "assets/Pot of food/3D/pot_of_food_3d.png",
    "locomotive": "assets/Locomotive/3D/locomotive_3d.png",
    "paintbrush": "assets/Paintbrush/3D/paintbrush_3d.png",
    "alien-monster": "assets/Alien monster/3D/alien_monster_3d.png",
    "butterfly": "assets/Butterfly/3D/butterfly_3d.png",
    "hammer-wrench": "assets/Hammer and wrench/3D/hammer_and_wrench_3d.png",
    "fireworks": "assets/Fireworks/3D/fireworks_3d.png",
    "house": "assets/House/3D/house_3d.png",
    "laptop": "assets/Laptop/3D/laptop_3d.png",
    "alarm-clock": "assets/Alarm clock/3D/alarm_clock_3d.png",
    "dividers": "assets/Card index dividers/3D/card_index_dividers_3d.png",
    "speech-balloon": "assets/Speech balloon/3D/speech_balloon_3d.png",
    "robot": "assets/Robot/3D/robot_3d.png",
    "police": "assets/Police officer/Default/3D/police_officer_3d_default.png",
    "deciduous-tree": "assets/Deciduous tree/3D/deciduous_tree_3d.png",
    "whale": "assets/Spouting whale/3D/spouting_whale_3d.png",
    "christmas-tree": "assets/Christmas tree/3D/christmas_tree_3d.png",
    "trophy": "assets/Trophy/3D/trophy_3d.png",
    # 島圖示（島名牌、島卡片、清單標題；滑鼠島與節慶島跟關卡共用 computer-mouse／christmas-tree）
    "keyboard": "assets/Keyboard/3D/keyboard_3d.png",
    "puzzle-piece": "assets/Puzzle piece/3D/puzzle_piece_3d.png",
    "artist-palette": "assets/Artist palette/3D/artist_palette_3d.png",
    "file-folder": "assets/File folder/3D/file_folder_3d.png",
    "game-die": "assets/Game die/3D/game_die_3d.png",
    "crossed-swords": "assets/Crossed swords/3D/crossed_swords_3d.png",
}
total = 0
for name, path in SRC.items():
    data = urllib.request.urlopen(urllib.request.Request(BASE + urllib.parse.quote(path), headers={"User-Agent": "fetch"}), timeout=20).read()
    im = Image.open(io.BytesIO(data)).convert("RGBA").resize((128, 128), Image.LANCZOS)
    f = OUT / f"{name}.webp"; im.save(f, "WEBP", quality=88, method=6); total += f.stat().st_size
lic = urllib.request.urlopen(urllib.request.Request(BASE + "LICENSE", headers={"User-Agent": "fetch"}), timeout=20).read().decode("utf-8")
(OUT / "LICENSE-fluentui-emoji.txt").write_text(
    "關卡圖示來源：Microsoft Fluent Emoji（3D），https://github.com/microsoft/fluentui-emoji\n"
    "縮成 128px webp。重產：python tools/build-icons.py（對照表見 island/data.js 的 ICON）\n\n" + lic, encoding="utf-8", newline="\n")
print(len(SRC), "張，共", round(total / 1024), "KB")
