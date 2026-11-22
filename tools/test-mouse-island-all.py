"""滑鼠島 7 關總檢查（M5）：每關一次跑完，補 test-mouse-scenes.py 沒涵蓋的部分。
  A. 原始碼：mount 欄位（unit／grade／zhuyin／skill）照規劃、場景沒有自己寫 click／dblclick／contextmenu／wheel 事件、
     有「連回真的電腦」那句、有 prefers-reduced-motion、scene 有 hint／assist／stop
  B. 三段鷹架：第一段一開始就有發光＋手指示範；每段失手 2 次後發光的目標 → 量大小（第一段最大、第三段最小）、
     不能超出場景、不能壓到寄寄區（左下 x<560 且 y>400）
  C. 平板觸控：1–2／1–4 年級的關用手指點、點兩下、拖；3–4 年級的關用長按（右鍵）、上下滑（滾輪）、拖框，第一段要能過
  D. 交成績：結算 → 交成績給老師 → 按座號 → 出現 QR、核對欄有成功率
用法（repo 根目錄，先開本機預覽 8770）：python tools/test-mouse-island-all.py [輸出 json]
"""
import json
import re
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BASE = "http://127.0.0.1:8770/"
UNITS = [  # unit, 資料夾, 年段, 注音, 技能
    (21, "unit21-mouse-challenge", "12", True, "click"),
    (33, "unit33-egg-tap", "14", True, "dblclick"),
    (19, "unit19-farm-harvest", "14", True, "drag"),
    (2, "unit2-mouse-adventure", "14", True, "mix"),
    (34, "unit34-right-click-wizard", "34", False, "right"),
    (35, "unit35-scroll-sea", "34", False, "wheel"),
    (36, "unit36-box-farm", "34", False, "box"),
]
SIZE_EXEMPT = {2: "第三段魔王戰，魔王大但會移動、招式一直換"}
CRAB = (560, 400)   # 場景座標：x < 560 且 y > 400 是寄寄區
GLOWS = """() => { const f = document.querySelector('.mi-field').getBoundingClientRect(), k = f.width / 1366;
  return [...document.querySelectorAll('.mi-field .mi-glow')].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect();
    return { x: (r.left - f.left) / k, y: (r.top - f.top) / k, w: r.width / k, h: r.height / k, cx: r.left + r.width / 2, cy: r.top + r.height / 2, cls: (e.getAttribute('class') || '').slice(0, 40) }; }); }"""
HITS = "window.__miDebug.run() ? window.__miDebug.run().hits : -1"

results, total_ok, total = {}, 0, 0


def check(rec, name, cond, got=None):
    global total_ok, total
    total += 1; total_ok += bool(cond)
    rec["checks"].append({"name": name, "ok": bool(cond), "got": got})
    print(("  ✓ " if cond else "  ✗ ") + name + ("" if cond or got is None else f"（{got}）"))


def source_checks(rec, unit, folder, grade, zy, skill):
    t = (ROOT / "units" / folder / "index.html").read_text(encoding="utf-8")
    m = re.search(r"MouseIsland\.mount\(\{(.*)", t, re.S); head = m.group(1)[:4000] if m else ""
    check(rec, "mount 欄位照規劃", all(re.search(p, head) for p in (rf"unit:\s*{unit}\b", rf"grade:\s*'{grade}'", rf"zhuyin:\s*{str(zy).lower()}", rf"skill:\s*'{skill}'")))
    scripts = "\n".join(re.findall(r"<script>(.*?)</script>", t, re.S))
    raw = re.findall(r"addEventListener\(\s*['\"](click|dblclick|contextmenu|wheel|mousedown|mouseup|pointerdown)['\"]", scripts)
    check(rec, "操作偵測只用 api.on（沒自己寫滑鼠事件）", not raw, raw)
    check(rec, "有連回真的電腦那句（電腦／網頁／檔案）", bool(re.search(r"api\.say\([^)]*(電腦|網頁|檔案|資料夾)", scripts)))
    check(rec, "尊重 prefers-reduced-motion", "prefers-reduced-motion" in t)
    check(rec, "scene 有 hint／assist／stop", all(re.search(rf"\b{k}\s*[:(]", scripts) for k in ("hint", "assist", "stop")))


def scaffold_checks(pg, rec, url):
    sizes = []
    for s in range(3):
        pg.goto(url); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(300)
        pg.evaluate(f"window.__miDebug.begin({s})"); pg.wait_for_timeout(700)
        if s == 0:
            check(rec, "第一段一開始就發光＋手指示範", pg.evaluate("document.querySelectorAll('.mi-field .mi-glow').length > 0 && !!document.querySelector('.mi-demo')"))
            pg.wait_for_timeout(2600)
        pg.evaluate("window.__miDebug.api.miss(); window.__miDebug.api.miss()"); pg.wait_for_timeout(500)
        g = pg.evaluate(GLOWS)
        if not g:
            check(rec, f"第 {s + 1} 段失手 2 次有目標發光", False); sizes.append(None); continue
        big = max(g, key=lambda r: r["w"] * r["h"])
        sizes.append(round(min(big["w"], big["h"])))
        inside = all(r["x"] >= -4 and r["y"] >= -4 and r["x"] + r["w"] <= 1370 and r["y"] + r["h"] <= 585 for r in g)
        crab = [r["cls"] for r in g if r["x"] < CRAB[0] and r["y"] + r["h"] > CRAB[1]]
        check(rec, f"第 {s + 1} 段發光目標在場景內", inside, [(round(r["x"]), round(r["y"]), round(r["w"]), round(r["h"])) for r in g])
        check(rec, f"第 {s + 1} 段目標沒壓到寄寄區", not crab, crab)
    rec["sizes"] = sizes
    if all(sizes) and rec.get("unit") in SIZE_EXEMPT:
        check(rec, "目標大小（例外：" + SIZE_EXEMPT[rec["unit"]] + "）", True, sizes)
    elif all(sizes):
        check(rec, "目標由大到小（第一段 ≥ 第三段）", sizes[0] >= sizes[2], sizes)


def touch(cdp, kind, pts):
    cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [{"x": x, "y": y} for x, y in pts]})


def tap(cdp, pg, x, y, hold=60):
    touch(cdp, "touchStart", [(x, y)]); pg.wait_for_timeout(hold); touch(cdp, "touchEnd", [])


def swipe(cdp, pg, a, b, steps=10, hold=0):
    touch(cdp, "touchStart", [a]); pg.wait_for_timeout(hold or 30)
    for i in range(1, steps + 1):
        touch(cdp, "touchMove", [(a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps)]); pg.wait_for_timeout(16)
    pg.wait_for_timeout(60); touch(cdp, "touchEnd", [])


def touch_check(br, rec, unit, url):
    ctx = br.new_context(viewport={"width": 1366, "height": 657}, has_touch=True, is_mobile=False)
    pg = ctx.new_page(); cdp = ctx.new_cdp_session(pg); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
    pg.goto(url); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(300)
    pg.evaluate("window.__miDebug.begin(0)"); pg.wait_for_timeout(3400)
    h0 = pg.evaluate(HITS); g = pg.evaluate(GLOWS); note = ""
    c = (g[0]["cx"], g[0]["cy"]) if g else None
    if unit in (21, 2) and c:
        tap(cdp, pg, *c); note = "點一下（指向在平板上＝點）"
    elif unit == 33 and c:
        tap(cdp, pg, *c); pg.wait_for_timeout(110); tap(cdp, pg, *c); note = "點兩下"
    elif unit == 19 and c:
        b = pg.evaluate("(() => { const r = document.querySelector('.sc-basket').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
        touch(cdp, "touchStart", [c]); pg.wait_for_timeout(40)
        for i in range(1, 9): touch(cdp, "touchMove", [(c[0], c[1] - 16 * i)]); pg.wait_for_timeout(16)
        swipe_from = (c[0], c[1] - 128)
        for i in range(1, 15): touch(cdp, "touchMove", [(swipe_from[0] + (b[0] - swipe_from[0]) * i / 14, swipe_from[1] + (b[1] - swipe_from[1]) * i / 14)]); pg.wait_for_timeout(16)
        pg.wait_for_timeout(60); touch(cdp, "touchEnd", []); note = "手指拖進菜籃"
    elif unit == 34 and c:
        tap(cdp, pg, *c, hold=750); pg.wait_for_timeout(400)
        opt = pg.evaluate("""(() => { const e = [...document.querySelectorAll('.mi-field [class*=menu]')].filter(x => /打開/.test(x.textContent) && x.getClientRects().length).pop();
          if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()""")
        check(rec, "觸控：長按叫出右鍵選單", bool(opt))
        if opt: tap(cdp, pg, *opt)
        note = "長按 750ms → 點「打開」"
    elif unit == 35:
        sig = "[...document.querySelectorAll('.mi-field [style*=translate]')].map(e => e.style.transform).join('|')"
        s0 = pg.evaluate(sig)
        for _ in range(4): swipe(cdp, pg, (900, 470), (900, 170)); pg.wait_for_timeout(120)
        check(rec, "觸控：手指往上滑＝滾輪往下（海底有捲動）", pg.evaluate(sig) != s0)
        pg.wait_for_timeout(500)
        t = pg.evaluate(GLOWS) or []
        pg.evaluate("window.__miDebug.api.miss(); window.__miDebug.api.miss()"); pg.wait_for_timeout(400)
        t = [r for r in pg.evaluate(GLOWS) if r["w"] < 300]
        if t: tap(cdp, pg, t[-1]["cx"], t[-1]["cy"])
        note = "上滑 4 次 → 點寶物"
    elif unit == 36 and g:
        x0 = min(r["cx"] - r["w"] / 2 for r in g); y0 = min(r["cy"] - r["h"] / 2 for r in g)
        x1 = max(r["cx"] + r["w"] / 2 for r in g); y1 = max(r["cy"] + r["h"] / 2 for r in g)
        swipe(cdp, pg, (x0 - 30, y0 - 30), (x1 + 30, y1 + 30), steps=14); note = "手指拉框"
    pg.wait_for_timeout(900)
    h1 = pg.evaluate(HITS)
    check(rec, f"觸控：第一段{note}能過（hits {h0}→{h1}）", h1 > h0)
    check(rec, "觸控：沒有 JS 錯誤", not errs, errs)
    ctx.close()


def submit_check(pg, rec, url):
    pg.goto(url); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(300)
    pg.evaluate("window.__miDebug.begin(2)"); pg.wait_for_timeout(500)
    pg.evaluate("window.__miDebug.api.hit(); window.__miDebug.finish()"); pg.wait_for_timeout(2500)
    pg.click(".mi-submit"); pg.wait_for_timeout(1200)
    pg.click(".cs-pad button[data-n='7']"); pg.wait_for_timeout(800)
    qr = pg.evaluate("!!document.querySelector('.cs-qr svg, .cs-qr img, .cs-qr canvas, .cs-qr table')")
    chk = pg.evaluate("(document.querySelector('.cs-chk') || {}).textContent || ''")
    check(rec, "交成績：按座號後出現 QR", qr)
    check(rec, "交成績：核對欄有成功率", "成功率" in chk, chk[:80])


with sync_playwright() as p:
    br = p.chromium.launch()
    for unit, folder, grade, zy, skill in UNITS:
        print(f"== unit{unit} {folder}（{grade} 年段，技能 {skill}）")
        rec = {"checks": [], "unit": unit}; results[unit] = rec
        url = BASE + f"units/{folder}/?debug=1"
        source_checks(rec, unit, folder, grade, zy, skill)
        pg = br.new_page(viewport={"width": 1366, "height": 657}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        try:
            scaffold_checks(pg, rec, url)
            submit_check(pg, rec, url)
        except Exception as e:
            check(rec, "流程跑完", False, str(e)[:160])
        check(rec, "滑鼠流程沒有 JS 錯誤", not errs, errs)
        pg.close()
        try:
            touch_check(br, rec, unit, url)
        except Exception as e:
            check(rec, "觸控流程跑完", False, str(e)[:160])
    br.close()

print(f"\n{total_ok}／{total} 項通過")
if len(sys.argv) > 1:
    Path(sys.argv[1]).write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")
