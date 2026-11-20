"""打字島 8 關場景自動驗收（2026-11-20 起；重做或調整任何一關的場景後跑一次）。

怎麼跑（repo 根目錄）：
    python tools/test-typing-scenes.py              # 8 關全跑
    python tools/test-typing-scenes.py unit12 unit1 # 只跑指定關
    python tools/test-typing-scenes.py --headed     # 開視窗看
需要：Python Playwright（同 render-island.py）。

每關檢查（1366×657，跟教室電腦一樣）：
  1. 設定畫面 → 開始，上方倒數＝選的分鐘數（預設 10 分鐘 → 09:5x）
  2. 打對 6 個字，計分正確；打字過程中取樣「字卡互疊」（字 ≥ 36px 的單字元素，重疊 > 8px 算一次）
  3. 同一字打錯 3 次 → 第 3 層大鍵盤打開，場景完全靜止（1.2 秒內所有 transform／left／top 不變）
  4. Esc 關掉後閒置，最慢「下落秒數 + 4 秒」內要扣愛心（目標掉到底／怪獸反擊）
  5. 用 ?debug=1 的 __tiDebug.endRound 跑完所有回合 → 進結算畫面
  6. 頁面不捲動、console 沒有錯誤（favicon 404 不算）
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
FALL_SEC = {"t1": 15, "t2": 10.5, "t3": 7.5}

# 代號：(資料夾, 驗收用的階別, 語言)；魔法字彈中英都要測
UNITS = {
    "unit4":   ("unit4-whack-keyboard", "t1", "en"),
    "unit3":   ("unit3-space-typing", "t1", "en"),
    "unit16":  ("unit16-dino-typing", "t1", "en"),
    "unit1":   ("unit1-typing-adventure", "t1", "zh"),
    "unit13":  ("unit13-forest-typing-defense", "t2", "en"),
    "unit11":  ("unit11-space-typing-pro", "t2", "en"),
    "unit12":  ("unit12-space-typing-zh", "t2", "zh"),
    "unit14":  ("unit14-magic-word-bullet", "t3", "en"),
    "unit14zh": ("unit14-magic-word-bullet", "t1", "zh"),
}

JS_CUR = """() => { const t = document.querySelector('.c.cur')?.textContent || '';
  return t === '␣' ? ' ' : [...t][0]; }"""
JS_TYPE_ZH = """(s) => { const i = document.querySelector('.ti-input'); i.value = s;
  i.dispatchEvent(new Event('input', {bubbles: true})); }"""
JS_SNAP = """() => [...document.querySelectorAll('.ti-field *')]
  .filter(e => e.style && (e.style.transform || e.style.left || e.style.top))
  .map(e => e.style.transform + e.style.left + e.style.top).join('|')"""
JS_OVERLAP = """() => {
  const els = [...document.querySelectorAll('.ti-field *')].filter(e => {
    if (e.children.length || !e.offsetParent) return false;
    const t = (e.textContent || '').trim();
    return [...t].length >= 1 && [...t].length <= 2 && parseFloat(getComputedStyle(e).fontSize) >= 36
      && getComputedStyle(e).opacity !== '0';
  }).map(e => e.getBoundingClientRect());
  let n = 0;
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const a = els[i], b = els[j];
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ox > 8 && oy > 8) n++;
  }
  return n;
}"""
JS_VISIBLE = """() => [...document.querySelectorAll('section[class^="ti-"]')]
  .filter(s => !s.hidden && getComputedStyle(s).display !== 'none').map(s => s.className)"""


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve(site):
    handler = functools.partial(QuietHandler, directory=str(site))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def lives(page):
    label = page.evaluate("() => document.querySelector('.ti-lives').getAttribute('aria-label')")
    return int("".join(ch for ch in label if ch.isdigit()) or 0)


def check_unit(page, base, key):
    folder, tier, lang = UNITS[key]
    fails, errs = [], []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: m.type == "error" and "favicon" not in m.text and errs.append(m.text))
    url = f"{base}/units/{folder}/index.html?debug=1&tier={tier}&lang={lang}&min=10"
    page.goto(url)
    page.evaluate("() => { try { localStorage.clear(); } catch (e) {} }")
    page.goto(url)
    page.get_by_role("button", name="開始").first.click()
    page.wait_for_timeout(1200)

    hud = page.evaluate("() => document.querySelector('.ti-hud').innerText.match(/\\d\\d:\\d\\d/)?.[0]")
    if not (hud or "").startswith("09:5"):
        fails.append(f"倒數應從 10 分鐘開始，看到 {hud}")

    def type_char(c):
        if lang == "zh":
            page.evaluate(JS_TYPE_ZH, c)
        else:
            page.keyboard.type(c)

    overlap = 0
    for _ in range(6):
        type_char(page.evaluate(JS_CUR))
        page.wait_for_timeout(350)
        overlap += 1 if page.evaluate(JS_OVERLAP) else 0
    ok = page.evaluate("() => document.querySelector('.ti-play').innerText.match(/打對\\s*(\\d+)/)?.[1]")
    if ok != "6":
        fails.append(f"打對 6 字，計分是 {ok}")
    if overlap:
        fails.append(f"字卡互疊（6 次取樣有 {overlap} 次）")

    for _ in range(3):
        if lang == "zh":
            type_char("一" if page.evaluate(JS_CUR) != "一" else "二")
        else:
            page.keyboard.press("Backquote")
        page.wait_for_timeout(250)
    if not page.evaluate("() => !document.querySelector('.ti-l3').hidden"):
        fails.append("打錯 3 次沒打開大鍵盤")
    a = page.evaluate(JS_SNAP)
    page.wait_for_timeout(1200)
    b = page.evaluate(JS_SNAP)
    if not a or a != b:
        fails.append("大鍵盤暫停時場景還在動")
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)

    before = lives(page)
    waited, limit = 0, (FALL_SEC[tier] + 4) * 1000
    while waited < limit and lives(page) >= before:
        page.wait_for_timeout(500)
        waited += 500
    if lives(page) >= before:
        fails.append(f"閒置 {limit // 1000} 秒沒扣愛心")

    for _ in range(8):
        if "ti-review" in page.evaluate(JS_VISIBLE):
            break
        page.evaluate("() => window.__tiDebug.endRound()")
        page.wait_for_timeout(500)
        nxt = page.get_by_role("button", name="繼續")
        if "ti-rest" in page.evaluate(JS_VISIBLE) and nxt.count():
            nxt.first.click()
            page.wait_for_timeout(500)
    if "ti-review" not in page.evaluate(JS_VISIBLE):
        fails.append("跑完回合沒進結算畫面")

    sh, sw = page.evaluate("() => [document.documentElement.scrollHeight, document.documentElement.scrollWidth]")
    if sh > 657 or sw > 1366:
        fails.append(f"頁面會捲動（{sw}×{sh}）")
    if errs:
        fails.append("console 錯誤：" + "；".join(errs[:3]))
    return fails


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    keys = args or list(UNITS)
    bad = [k for k in keys if k not in UNITS]
    if bad:
        sys.exit(f"不認得的關卡：{bad}；可用：{list(UNITS)}")
    with tempfile.TemporaryDirectory() as tmp:
        site = Path(tmp)
        shutil.copytree(ROOT / "assets", site / "assets")
        shutil.copytree(ROOT / "units", site / "units")
        httpd = serve(site)
        base = f"http://127.0.0.1:{httpd.server_address[1]}"
        total = 0
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless="--headed" not in sys.argv)
                for key in keys:
                    page = browser.new_page(viewport={"width": 1366, "height": 657})
                    try:
                        fails = check_unit(page, base, key)
                    except Exception as e:   # 單關爆掉不影響其他關
                        fails = [f"執行失敗：{e}"]
                    page.close()
                    total += len(fails)
                    print(("✅ " if not fails else "❌ ") + key + ("" if not fails else "：" + "｜".join(fails)), flush=True)
                browser.close()
        finally:
            httpd.shutdown()
    print("全部通過" if not total else f"共 {total} 個問題")
    sys.exit(1 if total else 0)


if __name__ == "__main__":
    main()
