"""unit23 自動試玩：大廳→房間→中打對電腦（含打錯 3 次看分層提示）→結算；再英打一局。
用法：python playtest.py <repo 根目錄> <截圖資料夾> [寬 高]"""
import subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

repo, out = Path(sys.argv[1]), Path(sys.argv[2])
W, H = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (1366, 657)
out.mkdir(parents=True, exist_ok=True)
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8923"], cwd=repo,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
URL = "http://localhost:8923/units/unit23-typing-duel/index.html"

OVER = """() => {
  const vh = innerHeight, vw = innerWidth;
  const doc = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - vh;
  let over = 0, who = '';
  document.querySelectorAll('[id^=screen-]').forEach(s => {
    if (getComputedStyle(s).display === 'none' || getComputedStyle(s).visibility === 'hidden') return;
    s.querySelectorAll('*').forEach(e => {
      const st = getComputedStyle(e);
      if (st.display === 'none' || st.visibility === 'hidden' || st.position === 'fixed') return;
      if (e.closest('#text-viewport')) return;          // 文章區本來就會內部捲動
      const b = e.getBoundingClientRect();
      if (!b.width || !b.height) return;
      const o = Math.max(b.bottom - vh, b.right - vw);
      if (o > over) { over = o; who = (e.id || e.className || e.tagName) + ''; }
    });
  });
  return { doc, over: Math.round(over), who };
}"""

def shot(pg, name):
    pg.screenshot(path=str(out / f"{W}x{H}-{name}.png"))
    print(f"  [{name}] 超出", pg.evaluate(OVER))

def typing_chars(pg, pid):
    return pg.evaluate("""id => { const p = PASSAGES.find(x => x.id === id);
      return [...p.text].filter((c, i) => !DuelCore.isAuto(p, i)); }""", pid)

def wait_result(pg, sec):
    try:
        pg.wait_for_selector("#screen-result", state="visible", timeout=sec * 1000)
        return True
    except Exception:
        return False

errs = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": W, "height": H})
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
        pg.goto(URL, wait_until="networkidle")
        pg.wait_for_timeout(800)
        shot(pg, "1-lobby")
        print("  連線按鈕 disabled：", pg.eval_on_selector("#btn-create-net", "e => e.disabled || e.getAttribute('aria-disabled')"))

        # ---- 中打
        pg.click("#btn-start-bot"); pg.wait_for_timeout(600)
        pg.click("#opt-lang-group .chip[data-lang=zh]")
        pg.click("#opt-grade-group .chip[data-grade=mid]")
        pg.click("[data-duration='60']")
        pg.wait_for_timeout(300)
        shot(pg, "2-room")
        pg.click("#btn-room-start")
        pg.wait_for_timeout(4200)
        shot(pg, "3-battle")
        pg.locator("#passage-text").screenshot(path=str(out / f"{W}x{H}-3b-passage.png"))
        inp = pg.locator("#type-input")
        inp.focus()
        for i in range(3):
            pg.keyboard.insert_text("火"); pg.wait_for_timeout(500)
            shot(pg, f"4-wrong{i + 1}")
        chars = typing_chars(pg, "nat-m-01")
        done = False
        for k in range(0, len(chars) * 3, 2):
            seg = "".join((chars * 3)[k:k + 2])
            pg.keyboard.insert_text(seg); pg.wait_for_timeout(330)
            if pg.is_visible("#screen-result"):
                done = True; break
        done = done or wait_result(pg, 70)
        print("  中打結算出現：", done)
        pg.wait_for_timeout(1200)
        shot(pg, "5-result-zh")
        print("  localStorage：", pg.evaluate("Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('edtech-unit23')).map(k=>[k,localStorage.getItem(k)]))"))

        # ---- 英打（從結算回大廳再開一局）
        pg.click("#btn-res-lobby"); pg.wait_for_timeout(600)
        pg.click("#btn-start-bot"); pg.wait_for_timeout(600)
        pg.click("#opt-lang-group .chip[data-lang=en]")
        pg.click("#opt-grade-group .chip[data-grade=low]")
        pg.click("[data-duration='60']")
        pg.click("#btn-room-start"); pg.wait_for_timeout(4200)
        shot(pg, "6-battle-en")
        en = pg.evaluate("PASSAGES.find(x => x.id === 'en-l-01').text")
        pg.keyboard.press("x"); pg.wait_for_timeout(200)
        pg.keyboard.press("x"); pg.wait_for_timeout(400)
        shot(pg, "7-en-wrong2")
        done = False
        for c in (en + " ") * 3:
            pg.keyboard.type(c); pg.wait_for_timeout(140)
            if pg.is_visible("#screen-result"):
                done = True; break
        done = done or wait_result(pg, 70)
        print("  英打結算出現：", done)
        pg.wait_for_timeout(1200)
        shot(pg, "8-result-en")
        b.close()
finally:
    srv.terminate()
print("console 錯誤：", errs[:10] if errs else "無")
