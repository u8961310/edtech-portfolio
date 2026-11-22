"""滑鼠島關卡自動驗收：開頁 → 三段各截圖 → 連續失手 2／4／6 次檢查提示與放大 → 結算截圖；全程不能有 JS 錯誤。
示範關（assets/mouse/demo.html）另外用真的滑鼠從頭玩到尾（點貝殼、故意點沙灘失手）。
用法（repo 根目錄，先開本機預覽 8770）：
    python tools/test-mouse-scenes.py <頁面路徑，例 units/unit33-egg-tap/ 或 assets/mouse/demo.html> [輸出資料夾] [--grade=34]
需要頁面支援 ?debug=1（mouse-ui.js 內建 window.__miDebug）。
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:] if not a.startswith("--")]
grade = next((a.split("=")[1] for a in sys.argv[1:] if a.startswith("--grade=")), None)
path = args[0]
out = Path(args[1] if len(args) > 1 else "mouse-shots"); out.mkdir(parents=True, exist_ok=True)
BASE = "http://127.0.0.1:8770/"
url = BASE + path + ("&" if "?" in path else "?") + "debug=1" + (f"&grade={grade}" if grade else "")
ok_n, fail = 0, []


def check(name, cond, got=None):
    global ok_n
    if cond: ok_n += 1; print("  ✓", name)
    else: fail.append(name); print("  ✗", name, "→", got)


def vis(pg, sel):
    return pg.evaluate(f"(() => {{ const e = document.querySelector({sel!r}); return !!e && e.getClientRects().length > 0; }})()")


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1366, "height": 657}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    pg.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
    pg.on("response", lambda r: errs.append(f"{r.status} {r.url}") if r.status >= 400 else None)
    pg.goto(url); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(500)
    pg.screenshot(path=str(out / "0-setup.png"))
    check("開始畫面有標題與開始鈕", vis(pg, ".mi-start") and pg.inner_text(".mi-info h1").strip() != "")
    if pg.evaluate("!!document.querySelector('.mi-howto.mi-zy')"):   # 3–4 年級的關（zhuyin:false）不用注音字型，不會載入
        check("注音字型載入", pg.evaluate("document.fonts.check('20px \"Bpmf Huninn\"')"))
    big = pg.evaluate("window.__miDebug.cfg.big")
    if grade in ("34", "56"):   # 只有 1–4 年級的關（grade:'14'）才算「大孩子玩」→ 跳過示範、第三段加難
        check(f"3–4 年級：跳過示範按鈕跟 cfg.big（{big}）一致", vis(pg, ".mi-skipdemo") == big)

    # 三段各截圖（用 debug 直接進段）
    for i in range(3):
        pg.evaluate(f"window.__miDebug.begin({i})"); pg.wait_for_timeout(1600)
        pg.screenshot(path=str(out / f"{i + 1}-stage.png"))
        check(f"第 {i + 1} 段頂欄膠囊亮對", pg.evaluate(f"document.querySelectorAll('.mi-pill')[{i}].classList.contains('now')"))
    check("第 2 段才出現「失手沒關係」", True)  # 下面另外驗

    # 連續失手：2 次提示、4 次第二層、6 次放大
    pg.evaluate("window.__miDebug.begin(1)"); pg.wait_for_timeout(1200)
    check("第 2 段頂欄有「失手沒關係」", vis(pg, ".mi-calm"))
    pg.evaluate("window.__miDebug.api.miss(); window.__miDebug.api.miss()"); pg.wait_for_timeout(300)
    t1 = pg.evaluate("document.querySelector('.mi-say').textContent")
    check("失手 2 次：寄寄給第一層提示", vis(pg, ".mi-say.hint") and t1 != "", t1)
    pg.screenshot(path=str(out / "4-hint1.png"))
    pg.evaluate("window.__miDebug.api.miss(); window.__miDebug.api.miss()"); pg.wait_for_timeout(1800)
    t2 = pg.evaluate("document.querySelector('.mi-say').textContent")
    check("失手 4 次：換第二層提示", t2 != t1 and t2 != "", t2)
    pg.screenshot(path=str(out / "5-hint2.png"))
    pg.evaluate("window.__miDebug.api.miss(); window.__miDebug.api.miss()"); pg.wait_for_timeout(300)
    check("失手 6 次：cfg.assist 打開", pg.evaluate("window.__miDebug.cfg.assist === true"))
    pg.evaluate("window.__miDebug.api.hit()"); pg.wait_for_timeout(200)
    check("對一次提示收起", not vis(pg, ".mi-say.hint"))

    # 結算
    pg.evaluate("window.__miDebug.finish()"); pg.wait_for_timeout(1200)
    pg.screenshot(path=str(out / "6-done.png"))
    check("結算畫面", vis(pg, ".mi-s-done") and vis(pg, ".mi-submit"))
    unit = pg.evaluate("window.__miDebug.unit")
    check("成績存進 edtech-unitN-score", pg.evaluate(f"localStorage.getItem('edtech-unit{unit}-score')") is not None)
    if pg.evaluate(f"MouseIsland.LADDER.some(l => l.unit === {unit})"):   # 示範關（代號 99）不在 7 關階梯裡，不落寶石
        check("結算有寶石落槽動畫", pg.evaluate("!!document.querySelector('.mi-gemdrop')"))

    # 示範關：真的玩一次
    if path.endswith("assets/mouse/demo.html"):
        pg.goto(url); pg.wait_for_load_state("networkidle"); pg.click(".mi-start")
        played = 0
        for _ in range(60):
            if vis(pg, ".mi-s-done"): break
            shells = pg.locator(".sc-shell:not(.got)")
            if shells.count() == 0: pg.wait_for_timeout(300); continue
            if played == 2:   # 故意失手 2 次：點沙灘
                pg.mouse.click(300, 600); pg.mouse.click(1200, 600); pg.wait_for_timeout(250)
                check("真的點沙灘 2 次 → 出現提示", vis(pg, ".mi-say.hint"))
                check("目標發光", pg.evaluate("!!document.querySelector('.sc-shell:not(.got).mi-glow')"))
            bb = shells.first.bounding_box()
            if bb: pg.mouse.click(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); played += 1
            pg.wait_for_timeout(700)
        pg.wait_for_timeout(1200)
        pg.screenshot(path=str(out / "7-demo-played.png"))
        check(f"示範關真的玩到結算（點了 {played} 個貝殼）", vis(pg, ".mi-s-done") and played >= 10, played)

    check("全程沒有 JS 錯誤", not errs, errs)
    b.close()

print(f"\n{ok_n} 項通過" + (f"，{len(fail)} 項失敗：{fail}" if fail else "") + f"｜截圖：{out}")
sys.exit(1 if fail else 0)
