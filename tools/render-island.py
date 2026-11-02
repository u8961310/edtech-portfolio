"""學習樂園島產圖工具：把 island-3d.html 的 3D 場景算成分層 WebP＋熱區座標。

什麼時候要跑：改了 island/data.js（新增／調整關卡）或 island-3d.html 的場景之後。
怎麼跑：在 repo 根目錄執行
    python tools/render-island.py
需要：Python Playwright（pip install playwright && playwright install chromium）。
產出：
    island/img/land/*.webp、island/map-land.json   橫向（桌機、平板橫放）
    island/img/port/*.webp、island/map-port.json   直向（手機、平板直放）
只算一格畫面，用 CPU 軟體算圖也跑得完，不吃顯卡。
"""
import base64
import functools
import http.server
import json
import pathlib
import socketserver
import sys
import threading
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "island"
MODES = ["land", "port"]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def main():
    httpd, port = serve()
    print(f"本機伺服器 http://127.0.0.1:{port}/")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
            for mode in MODES:
                t0 = time.time()
                page = browser.new_page()
                errors = []
                page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda e: errors.append(str(e)))
                page.goto(f"http://127.0.0.1:{port}/island-3d.html?export={mode}")
                page.wait_for_function("window.__export", timeout=300_000, polling=1000)
                data = page.evaluate("window.__export")
                page.close()
                if errors:
                    sys.exit(f"[{mode}] 頁面有錯誤，停止產圖：\n" + "\n".join(errors))

                img_dir = OUT_DIR / "img" / mode
                img_dir.mkdir(parents=True, exist_ok=True)
                for old in img_dir.glob("*.webp"):
                    old.unlink()
                total = 0
                for layer in data["layers"]:
                    raw = base64.b64decode(layer.pop("data").split(",", 1)[1])
                    (img_dir / f"{layer['id']}.webp").write_bytes(raw)
                    layer["file"] = f"island/img/{mode}/{layer['id']}.webp"
                    total += len(raw)
                (OUT_DIR / f"map-{mode}.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
                print(f"[{mode}] {len(data['layers'])} 層、{len(data['spots'])} 個熱區、圖檔共 {total / 1024:.0f} KB（{time.time() - t0:.0f} 秒）")
            browser.close()
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
