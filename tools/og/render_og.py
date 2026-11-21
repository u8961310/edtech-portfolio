"""og-card.html → 1200x630 JPG（1x，檔案小，給 og:image 用）。

用法（repo 根目錄）：python tools/og/render_og.py assets/og/og-cover.jpg
先把首頁截圖存成 tools/og/home.png（1366x657@2x，不進 git）。
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

src = Path(__file__).parent / "og-card.html"
out = Path(sys.argv[1])
out.parent.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1200, "height": 630})
    pg.goto(src.resolve().as_uri())
    pg.wait_for_timeout(800)
    pg.screenshot(path=str(out), type="jpeg", quality=88)
    b.close()
print(out, out.stat().st_size // 1024, "KB")
