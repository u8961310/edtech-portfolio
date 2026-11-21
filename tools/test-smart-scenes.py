"""小常識島關卡自動驗收（2026-11-21 起；Gemini 交件或改任何一關後跑一次）。

怎麼跑（repo 根目錄）：
    python tools/test-smart-scenes.py                # 跑全部已存在的關（含 assets/smart/demo.html）
    python tools/test-smart-scenes.py unit29 demo    # 只跑指定的
    python tools/test-smart-scenes.py --headed       # 開視窗看
需要：Python Playwright（同 render-island.py）。

每關檢查（1366×657 教室電腦，另抽 1280×720）：
  1. 開始畫面：有首頁（連到 ../../index.html）、標題、關卡卡數量＝levels、頁面不捲動；注音關的注音字型有載入
  2. 先領養一隻測試寵物；每一關：start 後 .sm-field 有內容、有呼叫 api.progress、沒有溢出舞台
  3. 自動作答：一直點場景裡第一個可以按的按鈕、遇到回饋卡就按「下一題」，直到結算畫面（點選題應該走得完）；
     走不完（例如拖曳關）就改用 __smDebug.api.finish 收尾，並註記「自動作答沒走完」
  4. 結算：結算畫面出現、成績 key 有寫、寵物點心 +1（同一關重玩不再加）、自動作答走完的關 review 有每題紀錄
  5. stop 清乾淨：回開始畫面 2 秒內沒有 requestAnimationFrame 迴圈還在跑
  6. console 沒有錯誤（favicon 404 不算）
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
    "demo": "assets/smart/demo.html",
    "unit29": "units/unit29-pet-computer/index.html",
    "unit30": "units/unit30-pet-schedule/index.html",
    "unit31": "units/unit31-pet-message/index.html",
    "unit32": "units/unit32-pet-ai-homework/index.html",
    "unit8": "units/unit8-desktop-organizer/index.html",
    "unit9": "units/unit9-net-detective/index.html",
}
MARK = "smart-ui.js"   # 舊版 unit8／unit9 還沒換外殼時跳過

RAF_PROBE = """() => { window.__rafN = 0; const o = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => { window.__rafN++; return o(cb); }; }"""

# 自動作答一步：有回饋卡就按下一題；否則點場景裡第一個看得到、沒鎖住的按鈕（或有 data-* 可點的元素）
STEP = """() => {
  const done = document.querySelector('.sm-s-done'); if (done && !done.hidden) return 'done';
  const go = document.querySelector('.sm-fb:not([hidden]) .sm-fbgo'); if (go) { go.click(); return 'next'; }
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 20 && r.height > 20 && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && getComputedStyle(el).pointerEvents !== 'none'; };
  const c = [...document.querySelectorAll('.sm-field button, .sm-field [role=button], .sm-field [data-k], .sm-field [data-ans], .sm-field [data-i]')].filter(vis);
  if (!c.length) return 'none';
  c[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); return 'click';
}"""


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


def check(pg, base, key, rel, zy):
    errs, fails, notes = [], [], []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "favicon" not in m.text else None)
    pg.goto(f"{base}/{rel}?debug=1"); pg.wait_for_load_state("networkidle")
    pg.evaluate("localStorage.clear()")
    pg.evaluate("SmartPet.adopt({ seat: '1', owner: '測試', name: '測試寵物', type: 'turtle' })")
    pg.reload(); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(400)
    dbg = pg.evaluate("window.__smDebug ? { levels: __smDebug.levels, unit: __smDebug.unit } : null")
    if not dbg:
        return ["沒有 window.__smDebug（沒有用 SmartIsland.mount？）"] + errs, notes
    unit = dbg["unit"]

    # 1. 開始畫面
    home = pg.locator(".sm-home")
    if home.count() != 1 or not (home.get_attribute("href") or "").endswith("index.html"):
        fails.append("首頁按鈕不見或連結不對")
    if pg.locator(".sm-lv").count() != dbg["levels"]:
        fails.append(f"關卡卡數 {pg.locator('.sm-lv').count()} ≠ levels {dbg['levels']}")
    if zy and not pg.evaluate("document.fonts.check('20px \"Bpmf Huninn\"')"):
        fails.append("注音字型沒有載入")
    for w, h in [(1366, 657), (1280, 720)]:
        pg.set_viewport_size({"width": w, "height": h}); pg.wait_for_timeout(150)
        sw, sh = pg.evaluate("[document.documentElement.scrollWidth, document.documentElement.scrollHeight]")
        if sw > w or sh > h:
            fails.append(f"{w}×{h} 會捲動（{sw}×{sh}）")
    pg.set_viewport_size({"width": 1366, "height": 657})

    # 2–4. 每一關
    for i in range(dbg["levels"]):
        snack0 = pg.evaluate("SmartPet.current().snacks")
        pg.evaluate(f"__smDebug.start({i})"); pg.wait_for_timeout(600)
        if not pg.evaluate("document.querySelector('.sm-field').children.length"):
            fails.append(f"第 {i + 1} 關 start 後場景是空的"); continue
        if not pg.evaluate("document.querySelector('.sm-prog').textContent.trim()"):
            fails.append(f"第 {i + 1} 關沒有呼叫 api.progress（頂欄沒有題號）")
        over = pg.evaluate("""() => { const s = document.querySelector('.sm-stage').getBoundingClientRect(); let bad = 0;
          document.querySelectorAll('.sm-field *').forEach(el => { const r = el.getBoundingClientRect();
            if (r.width && r.height && getComputedStyle(el).position !== 'fixed' &&
                (r.right > s.right + 2 || r.bottom > s.bottom + 2 || r.left < s.left - 2)) bad++; }); return bad; }""")
        if over:
            fails.append(f"第 {i + 1} 關有 {over} 個元素超出 1366×657 舞台")
        state, steps = "", 0
        while steps < 80:
            state = pg.evaluate(STEP); steps += 1
            if state in ("done", "none"):
                break
            pg.wait_for_timeout(250 if state == "click" else 450)
        played = state == "done"
        if not played:
            notes.append(f"第 {i + 1} 關自動作答沒走完（{state}），改用 finish 收尾")
            pg.evaluate("__smDebug.api.finish({ stars: 2, review: [{ ok: true, q: '測試' }], learned: '測試' })")
            pg.wait_for_timeout(600)
        if pg.locator(".sm-s-done").is_hidden():
            fails.append(f"第 {i + 1} 關 finish 後沒出現結算畫面"); continue
        if played and not pg.locator(".sm-review .mk").count():
            fails.append(f"第 {i + 1} 關結算沒有每題回顧（api.finish 少了 review）")
        if played and not pg.locator(".sm-review .learned").count():
            fails.append(f"第 {i + 1} 關結算沒有「今天學到」（api.finish 少了 learned）")
        if pg.evaluate("SmartPet.current().snacks") != snack0 + 1:
            fails.append(f"第 {i + 1} 關過關後點心沒有 +1")
    if not pg.evaluate(f"localStorage.getItem('edtech-unit{unit}-score')"):
        fails.append(f"沒寫入 edtech-unit{unit}-score")
    s0 = pg.evaluate("SmartPet.current().snacks")
    pg.evaluate("__smDebug.start(0)"); pg.wait_for_timeout(300)
    pg.evaluate("__smDebug.api.finish({ stars: 1, review: [], learned: '' })"); pg.wait_for_timeout(300)
    if pg.evaluate("SmartPet.current().snacks") != s0:
        fails.append("同一關重玩又給了點心")

    # 5. stop 清乾淨
    pg.evaluate("__smDebug.start(0)"); pg.wait_for_timeout(400)
    pg.evaluate(RAF_PROBE)
    pg.evaluate("__smDebug.api.toSetup()"); pg.wait_for_timeout(300)
    pg.evaluate("window.__rafN = 0"); pg.wait_for_timeout(2000)
    raf = pg.evaluate("window.__rafN")
    if raf > 5:
        fails.append(f"回開始畫面後 2 秒內還有 {raf} 次 requestAnimationFrame（stop 沒清乾淨）")
    return fails + [f"console：{e}" for e in errs], notes


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
            text = f.read_text(encoding="utf-8", errors="ignore")
            if MARK not in text:
                print(f"－ {k}：還是舊版（沒用 smart-ui.js），略過"); continue
            pg = b.new_page(viewport={"width": 1366, "height": 657})
            fails, notes = check(pg, base, k, rel, "zhuyin: true" in text)
            pg.close()
            if fails:
                bad += 1
                print(f"❌ {k}"); [print("   - " + x) for x in fails]
            else:
                print(f"✅ {k}")
            [print("   · " + x) for x in notes]
        b.close()
    srv.shutdown()
    print("全部通過" if not bad else f"{bad} 關有問題")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
