"""promo.html → 社群宣傳圖 PNG（docs/promo/）。

用法（repo 根目錄）：python docs/promo/src/render_promo.py
走 http.server（playwright 開 file:// 會擋本機圖），埠 8897、只綁 127.0.0.1。
"""
import functools, http.server, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[3]
out_dir = Path(__file__).resolve().parents[1]
SIZES = {"fb": (1200, 630, "fb-1200x630.png"), "ig": (1080, 1350, "ig-1080x1350.png"),
         "igsq": (1080, 1080, "ig-1080x1080.png"), "threads": (1080, 1350, "threads-1080x1350.png")}

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
handler.log_message = lambda *a, **k: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8897), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for key, (w, h, name) in SIZES.items():
            pg = b.new_page(viewport={"width": w, "height": h})
            pg.goto(f"http://127.0.0.1:8897/docs/promo/src/promo.html?f={key}")
            pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(400)
            pg.screenshot(path=str(out_dir / name))
            pg.close()
            print(name, (out_dir / name).stat().st_size // 1024, "KB")
        b.close()
finally:
    srv.shutdown()
