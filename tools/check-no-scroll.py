"""量頁面在教室常見螢幕下需不需要上下／左右捲動。

為什麼要這支（2026-11-19）：Gemini 產的頁面常把高度寫死（牌高 184px、外框 min-height 700px），
在大螢幕截圖看不出來，但 1366×768 筆電（瀏覽器扣掉工具列約 1366×657）要捲 18～199px。

怎麼跑（repo 根目錄，先開 `python -m http.server 8000`）：
    python tools/check-no-scroll.py units/unit22-xmas-workshop/index.html units/unit22-xmas-workshop/draw.html ...
需要：Python Playwright。只量開始畫面；翻牌這類會切難度的頁面要另外點過再量。
"""
import sys

from playwright.sync_api import sync_playwright

SIZES = [(1366, 657), (1280, 720), (1280, 800)]
pages = sys.argv[1:]
bad = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for w, h in SIZES:
        row = []
        for path in pages:
            pg = b.new_page(viewport={"width": w, "height": h})
            pg.goto(f"http://127.0.0.1:8000/{path}", wait_until="load")
            pg.wait_for_timeout(700)
            dy, dx = pg.evaluate("() => { const s = document.scrollingElement; return [s.scrollHeight - innerHeight, s.scrollWidth - innerWidth]; }")
            ok = dy <= 0 and dx <= 0
            bad += not ok
            row.append(f"{path.split('/')[-1]}:{'OK' if ok else f'直{dy}/橫{dx}'}")
            pg.close()
        print(f"{w}x{h} | " + " ".join(row))
    b.close()
sys.exit(1 if bad else 0)
