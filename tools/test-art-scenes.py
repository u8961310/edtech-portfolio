"""畫畫島關卡自動驗收（2026-11-21 起；Gemini 交件或改任何一關後跑一次）。

怎麼跑（repo 根目錄）：
    python tools/test-art-scenes.py                # 跑全部已存在的關（含 assets/art/demo.html）
    python tools/test-art-scenes.py unit24 demo    # 只跑指定的
    python tools/test-art-scenes.py --headed       # 開視窗看
需要：Python Playwright（同 render-island.py）。

每關檢查（1366×657 教室電腦，另抽 1280×720）：
  1. 開始畫面：有 🏠 首頁（連到 ../../index.html）、我的畫廊、標題、關卡卡數量＝levels、頁面不捲動
  2. 每一關：start 後 .ai-field 有內容、沒有溢出舞台；有 canvas 就模擬拖一筆
  3. 用 ?debug=1 的 __aiDebug.api.finish 完成 → 完成畫面出現、成績 key 有寫、畫廊多一張
  4. stop 清乾淨：回開始畫面 2 秒內沒有新的 requestAnimationFrame 迴圈還在跑（取樣 rAF 呼叫數）
  5. console 沒有錯誤（favicon 404 不算）
只開 assets/ 與 units/ 的暫存複本當伺服器根目錄，不開 repo 根目錄（repo 有 .dev.vars）。
"""
import functools
import http.server
import shutil
import socketserver
import sys
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
UNITS = {   # 代號 → 路徑（相對暫存根目錄）
    "demo": "assets/art/demo.html",
    "unit24": "units/unit24-color-cauldron/index.html",
    "unit25": "units/unit25-line-train/index.html",
    "unit26": "units/unit26-mirror-workshop/index.html",
    "unit27": "units/unit27-paint-mission/index.html",
    "unit28": "units/unit28-sparkle-fireworks/index.html",
    "unit18": "units/unit18-magic-paint/index.html",
    "unit5": "units/unit5-pixel-art/index.html",
}
ART_MARK = "art-ui.js"   # 舊版 unit5／unit18 還沒換外殼時跳過

RAF_PROBE = """() => { window.__rafN = 0; const o = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => { window.__rafN++; return o(cb); }; }"""


def serve():
    tmp = Path(tempfile.mkdtemp())
    shutil.copytree(ROOT / "assets", tmp / "assets")
    shutil.copytree(ROOT / "units", tmp / "units")
    (tmp / "index.html").write_text("<title>HOME</title>home", encoding="utf-8")
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    H = functools.partial(Quiet, directory=str(tmp))
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, tmp


def check(pg, base, key, rel):
    errs, fails = [], []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "favicon" not in m.text else None)
    url = f"{base}/{rel}?debug=1"
    pg.goto(url); pg.wait_for_load_state("networkidle")
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(400)
    dbg = pg.evaluate("window.__aiDebug ? { levels: __aiDebug.levels, unit: __aiDebug.unit } : null")
    if not dbg:
        return ["沒有 window.__aiDebug（沒有用 ArtIsland.mount？）"] + errs
    unit = dbg["unit"]

    # 1. 開始畫面
    home = pg.locator(".ai-home")
    if home.count() != 1 or not (home.get_attribute("href") or "").endswith("index.html"):
        fails.append("首頁按鈕不見或連結不對")
    if pg.locator(".ai-bar .ai-gal").count() != 1:
        fails.append("我的畫廊按鈕不見")
    if pg.locator(".ai-lv").count() != dbg["levels"]:
        fails.append(f"關卡卡數 {pg.locator('.ai-lv').count()} ≠ levels {dbg['levels']}")
    for w, h in [(1366, 657), (1280, 720)]:
        pg.set_viewport_size({"width": w, "height": h}); pg.wait_for_timeout(150)
        sw, sh = pg.evaluate("[document.documentElement.scrollWidth, document.documentElement.scrollHeight]")
        if sw > w or sh > h:
            fails.append(f"{w}×{h} 會捲動（{sw}×{sh}）")
    pg.set_viewport_size({"width": 1366, "height": 657})

    # 2–3. 每一關
    for i in range(dbg["levels"]):
        pg.evaluate(f"__aiDebug.start({i})"); pg.wait_for_timeout(500)
        n = pg.evaluate("document.querySelector('.ai-field').children.length")
        if not n:
            fails.append(f"第 {i + 1} 關 start 後場景是空的"); continue
        over = pg.evaluate("""() => { const f = document.querySelector('.ai-field').getBoundingClientRect();
          const s = document.querySelector('.ai-stage').getBoundingClientRect(); let bad = 0;
          document.querySelectorAll('.ai-field *').forEach(el => { const r = el.getBoundingClientRect();
            if (r.width && r.height && getComputedStyle(el).position !== 'fixed' &&
                (r.right > s.right + 2 || r.bottom > s.bottom + 2 || r.left < s.left - 2)) bad++; }); return bad; }""")
        if over:
            fails.append(f"第 {i + 1} 關有 {over} 個元素超出 1366×657 舞台")
        cv = pg.locator(".ai-field canvas")
        if cv.count():
            box = cv.first.bounding_box()
            if box and box["width"] > 60:
                pg.mouse.move(box["x"] + box["width"] * .3, box["y"] + box["height"] * .3); pg.mouse.down()
                pg.mouse.move(box["x"] + box["width"] * .5, box["y"] + box["height"] * .6, steps=8); pg.mouse.up()
        gal0 = pg.evaluate("JSON.parse(localStorage.getItem('edtech-art-gallery') || '[]').length")
        pg.evaluate("""() => { const c = document.querySelector('.ai-field canvas') || Object.assign(document.createElement('canvas'), { width: 40, height: 30 });
          __aiDebug.api.finish({ stars: 3, image: c, praise: '測試' }); }""")
        pg.wait_for_timeout(700)
        if pg.locator(".ai-s-done").is_hidden():
            fails.append(f"第 {i + 1} 關 finish 後沒出現完成畫面")
        gal1 = pg.evaluate("JSON.parse(localStorage.getItem('edtech-art-gallery') || '[]').length")
        if gal1 <= gal0 and gal0 < 15:
            fails.append(f"第 {i + 1} 關完成後畫廊沒有多一張")
    if not pg.evaluate(f"localStorage.getItem('edtech-unit{unit}-score')"):
        fails.append(f"沒寫入 edtech-unit{unit}-score")

    # 4. stop 清乾淨：開一關、回開始畫面，量 2 秒內的 rAF 呼叫
    pg.evaluate("__aiDebug.start(0)"); pg.wait_for_timeout(400)
    pg.evaluate(RAF_PROBE)
    pg.evaluate("__aiDebug.api.toSetup()"); pg.wait_for_timeout(300)
    pg.evaluate("window.__rafN = 0"); pg.wait_for_timeout(2000)
    raf = pg.evaluate("window.__rafN")
    if raf > 5:
        fails.append(f"回開始畫面後 2 秒內還有 {raf} 次 requestAnimationFrame（stop 沒清乾淨）")
    return fails + [f"console：{e}" for e in errs]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    headed = "--headed" in sys.argv
    keys = args or list(UNITS)
    srv, tmp = serve()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    bad = 0
    with sync_playwright() as p:
        b = p.chromium.launch(headless=not headed)
        for k in keys:
            rel = UNITS.get(k)
            if not rel:
                print(f"⚠️ {k}：不認識的代號"); bad += 1; continue
            f = tmp / rel
            if not f.exists():
                print(f"－ {k}：還沒有檔案，略過"); continue
            if ART_MARK not in f.read_text(encoding="utf-8", errors="ignore"):
                print(f"－ {k}：還是舊版（沒用 art-ui.js），略過"); continue
            pg = b.new_page(viewport={"width": 1366, "height": 657})
            fails = check(pg, base, k, rel)
            pg.close()
            if fails:
                bad += 1
                print(f"❌ {k}"); [print("   - " + x) for x in fails]
            else:
                print(f"✅ {k}")
        b.close()
    srv.shutdown()
    print("全部通過" if not bad else f"{bad} 關有問題")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
