"""兩個瀏覽器分頁真的連線對打：A 開擂台、B 輸入房號加入、A 開打、雙方打字到結算。
前提：127.0.0.1:8000 有 http.server（repo 根目錄）、127.0.0.1:8788 有 duel-worker 的 wrangler dev。
用法：python nettest.py <截圖資料夾>"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
ARG = sys.argv[2] if len(sys.argv) > 2 else "?duel=ws://127.0.0.1:8788"
URL = ARG if ARG.startswith("http") else "http://127.0.0.1:8000/units/unit23-typing-duel/index.html" + ARG
errs = {"A": [], "B": []}

def chars(pg, pid):
    return pg.evaluate("""id => { const p = PASSAGES.find(x => x.id === id);
      return [...p.text].filter((c, i) => !DuelCore.isAuto(p, i)); }""", pid)

with sync_playwright() as p:
    b = p.chromium.launch()
    pages = {}
    for k in "AB":
        ctx = b.new_context(viewport={"width": 1366, "height": 657})
        pg = ctx.new_page()
        pg.on("console", lambda m, k=k: errs[k].append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e, k=k: errs[k].append("pageerror: " + str(e)))
        pg.goto(URL, wait_until="networkidle")
        pages[k] = pg
    A, B = pages["A"], pages["B"]
    print("A 連線按鈕可按：", A.eval_on_selector("#btn-create-net", "e => !e.disabled"))
    A.click("#btn-create-net")
    A.wait_for_function("() => /\\d{4}/.test(document.getElementById('room-code-digits').textContent.replace(/\\s/g,''))", timeout=8000)
    code = "".join(ch for ch in A.inner_text("#room-code-digits") if ch.isdigit())
    print("房號：", code)
    A.screenshot(path=str(out / "net-1-A-room.png"))
    B.fill("#join-code-input", code)
    B.click("#btn-join-net")
    B.wait_for_selector("#screen-room", state="visible", timeout=8000)
    A.wait_for_timeout(800)
    print("A 看到對手：", A.inner_text("#room-opp-name"), "| B 看到：", B.inner_text("#room-me-name"), "vs", B.inner_text("#room-opp-name"))
    A.click("#opt-lang-group .chip[data-lang=zh]")
    A.click("#opt-grade-group .chip[data-grade=low]")
    A.click("[data-duration='60']")
    A.wait_for_timeout(600)
    print("B 同步到設定（低年級亮起）：", B.eval_on_selector("#opt-grade-group .chip[data-grade=low]", "e => e.classList.contains('on')"))
    B.screenshot(path=str(out / "net-2-B-room.png"))
    A.click("#btn-room-start")
    A.wait_for_timeout(4200)
    A.screenshot(path=str(out / "net-3-A-battle.png"))
    title = A.inner_text("#battle-title-txt")
    pid = A.evaluate("t => (PASSAGES.find(p => '《' + p.title + '》' === t || p.title === t) || {}).id", title)
    print("文章：", title, pid, "| B 同一篇：", B.inner_text("#battle-title-txt") == title)
    cs = chars(A, pid) * 3
    # A 快、B 慢：A 每 0.3 秒打 2 字，B 每 0.9 秒打 1 字
    A.locator("#type-input").focus(); B.locator("#type-input").focus()
    ia = ib = 0
    t0 = time.time()
    while time.time() - t0 < 70:
        A.keyboard.insert_text("".join(cs[ia:ia + 2])); ia += 2
        if int((time.time() - t0) / 0.9) > ib:
            B.keyboard.insert_text(cs[ib]); ib += 1
        A.wait_for_timeout(300)
        if A.is_visible("#screen-result") and B.is_visible("#screen-result"):
            break
    A.wait_for_timeout(1500)
    A.screenshot(path=str(out / "net-4-A-result.png")); B.screenshot(path=str(out / "net-5-B-result.png"))
    print("A 結算：", A.inner_text("#res-ribbon"), "| B 結算：", B.inner_text("#res-ribbon"))
    b.close()
print("console 錯誤：", errs)
