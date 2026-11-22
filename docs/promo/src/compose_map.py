"""把學習樂園島的分層島圖合成一張圖（宣傳圖用）。

用法（repo 根目錄）：python docs/promo/src/compose_map.py
輸出：docs/promo/src/map-land.webp（橫）、map-port.webp（直），透明背景、長邊 2000 px。
"""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[3]
out_dir = Path(__file__).parent
for mode in ("land", "port"):
    m = json.loads((root / f"island/map-{mode}.json").read_text(encoding="utf-8"))
    canvas = Image.new("RGBA", (m["w"], m["h"]), (0, 0, 0, 0))
    for L in sorted(m["layers"], key=lambda l: -l["depth"]):   # 由後往前疊
        im = Image.open(root / L["file"]).convert("RGBA").resize((L["w"], L["h"]), Image.LANCZOS)
        canvas.alpha_composite(im, (L["x"], L["y"]))
    k = 2000 / max(m["w"], m["h"])
    canvas = canvas.resize((round(m["w"] * k), round(m["h"] * k)), Image.LANCZOS)
    out = out_dir / f"map-{mode}.webp"
    canvas.save(out, quality=88, method=6)
    print(out.name, canvas.size, out.stat().st_size // 1024, "KB")
