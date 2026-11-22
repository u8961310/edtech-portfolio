"""滑鼠島偵測器測試：用真的滑鼠動作（移入、單擊、Ctrl＋點、雙擊、單按一下、右鍵、滾輪、拖放、框選）打 assets/mouse/detect-test.html，
比對 mouse-ui.js 偵測器回報的事件。
用法（repo 根目錄，先開本機預覽：python <scratchpad>/scripts/serve_safe.py . 8770）：
    python tools/test-mouse-detect.py [http://127.0.0.1:8770/]
"""
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8770/"
ok_n, fail = 0, []


def check(name, cond, got=None):
    global ok_n
    if cond:
        ok_n += 1; print("  ✓", name)
    else:
        fail.append(name); print("  ✗", name, "→", got)


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1366, "height": 657})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE + "assets/mouse/detect-test.html"); pg.wait_for_load_state("networkidle")
    pg.click(".mi-start"); pg.wait_for_timeout(300)
    M = pg.mouse

    def c(sel, dx=0, dy=0):
        bb = pg.locator(sel).bounding_box(); return bb["x"] + bb["width"] / 2 + dx, bb["y"] + bb["height"] / 2 + dy

    def log(): return pg.evaluate("window.__log.slice()")

    def since(fn, wait=150):
        n = len(log()); fn(); pg.wait_for_timeout(wait); return log()[n:]

    check("指向：停 300 毫秒才算", since(lambda: (M.move(*c("#point")), None), 450) == ["point"], log()[-3:])
    check("單擊", since(lambda: M.click(*c("#click"))) == ["click"], log()[-3:])
    check("Ctrl＋點", since(lambda: (pg.keyboard.down("Control"), M.click(*c("#click")), pg.keyboard.up("Control"))) == ["click+ctrl"], log()[-3:])
    check("在單擊目標按右鍵＝wrong", since(lambda: M.click(*c("#click"), button="right")) == ["click-wrong:right"], log()[-3:])
    check("雙擊", since(lambda: M.dblclick(*c("#dbl")), 200) == ["dbl-first", "dbl"], log()[-3:])
    check("只按一下＝single（等雙擊間隔過了才報）", since(lambda: M.click(*c("#dbl")), 750) == ["dbl-first", "dbl-single"], log()[-3:])
    check("兩下間隔太久＝兩次 single，不算雙擊",
          since(lambda: (M.click(*c("#dbl")), pg.wait_for_timeout(700), M.click(*c("#dbl"))), 750) == ["dbl-first", "dbl-single", "dbl-first", "dbl-single"], log()[-5:])
    check("右鍵", since(lambda: M.click(*c("#right"), button="right")) == ["right"], log()[-3:])
    check("在右鍵目標按左鍵＝wrong", since(lambda: M.click(*c("#right"))) == ["right-wrong:left"], log()[-3:])
    check("滾輪往下", since(lambda: (M.move(*c("#wheel")), M.wheel(0, 200))) == ["wheel:down"], log()[-3:])
    check("滾輪往上", since(lambda: M.wheel(0, -200)) == ["wheel:up"], log()[-3:])

    def drag(a, bxy):
        M.move(*a); M.down(); M.move(*bxy, steps=12); M.up()
    check("拖到目標放開", since(lambda: drag(c("#drag"), c("#drop"))) == ["drop:drop"], log()[-3:])
    check("拖到空地放開＝target null", since(lambda: drag(c("#drag"), (700, 600))) == ["drop:none"], log()[-3:])
    check("按了沒拖＝tap", since(lambda: M.click(*c("#drag"))) == ["drag-tap"], log()[-3:])
    bb = pg.locator("#box").bounding_box()
    check("框選框到 2 個", since(lambda: drag((bb["x"] + 10, bb["y"] + 10), (bb["x"] + 230, bb["y"] + 140))) == ["box:2"], log()[-3:])
    check("框太小＝empty", since(lambda: drag((bb["x"] + 300, bb["y"] + 20), (bb["x"] + 304, bb["y"] + 24))) == ["box-empty"], log()[-3:])
    check("沒有 JS 錯誤", not errs, errs)
    b.close()

print(f"\n{ok_n} 項通過" + (f"，{len(fail)} 項失敗：{fail}" if fail else ""))
sys.exit(1 if fail else 0)
