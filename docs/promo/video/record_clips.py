"""Record scripted gameplay clips from edtech-portfolio with CDP screencast (sharp JPEG frames) → MP4.

python record.py [clip ...]   (default: all)  → clips/<name>.mp4 (1920×1080, 30 fps CFR)
"""
import base64, functools, glob, http.server, os, shutil, subprocess, sys, threading, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(r"D:\code\repos\edtech-portfolio")
HERE = Path(__file__).parent
CLIPS = HERE / "clips"; CLIPS.mkdir(exist_ok=True)
FF = glob.glob(r"D:\code\repos\mografy\node_modules\.pnpm\ffmpeg-static@*\node_modules\ffmpeg-static\ffmpeg.exe")[0]
BASE = "http://127.0.0.1:8898"

h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
h.log_message = lambda *a, **k: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8898), h)
threading.Thread(target=srv.serve_forever, daemon=True).start()


class Rec:
    def __init__(self, page, name):
        self.page, self.name, self.frames = page, name, []
        self.dir = HERE / "frames" / name
        shutil.rmtree(self.dir, ignore_errors=True); self.dir.mkdir(parents=True)
        self.cdp = page.context.new_cdp_session(page)
        self.cdp.on("Page.screencastFrame", self._frame)

    def _frame(self, ev):
        i = len(self.frames)
        p = self.dir / f"{i:05d}.jpg"
        p.write_bytes(base64.b64decode(ev["data"]))
        self.frames.append((ev["metadata"]["timestamp"], p))
        try: self.cdp.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]})
        except Exception: pass

    def start(self):
        self.cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": 1920, "maxHeight": 1080, "everyNthFrame": 1})

    def stop(self):
        self.page.wait_for_timeout(300)
        self.cdp.send("Page.stopScreencast")
        # concat list with real durations → CFR 30 fps
        lst = self.dir / "list.txt"
        rows = []
        for k, (ts, p) in enumerate(self.frames):
            nxt = self.frames[k + 1][0] if k + 1 < len(self.frames) else ts + 1 / 30
            rows.append(f"file '{p.as_posix()}'\nduration {max(0.001, nxt - ts):.4f}")
        rows.append(f"file '{self.frames[-1][1].as_posix()}'")
        lst.write_text("\n".join(rows), encoding="utf-8")
        out = CLIPS / f"{self.name}.mp4"
        subprocess.run([FF, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
                        "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30",
                        "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", str(out)], check=True)
        dur = self.frames[-1][0] - self.frames[0][0]
        print(f"{self.name}: {len(self.frames)} frames, {dur:.1f}s → {out.name}")


def key_of(t):
    t = t or " "
    return " " if t in ("␣", "\u00a0") or not t.strip() else t


def type_cur(pg, seconds, delay=0.13):
    end = time.time() + seconds
    while time.time() < end:
        t = pg.evaluate("() => { const e = document.querySelector('.c.cur'); return e ? e.textContent : null; }")
        if t is None: pg.wait_for_timeout(150); continue
        pg.keyboard.press("Space" if key_of(t) == " " else key_of(t))
        pg.wait_for_timeout(int(delay * 1000))


def egg(pg, r):
    pg.goto(f"{BASE}/units/unit33-egg-tap/"); pg.wait_for_timeout(1200)
    pg.click(".mi-start"); pg.wait_for_timeout(600)
    r.start()
    pg.wait_for_timeout(4200)                     # the demo double-click plays itself
    for _ in range(4):                            # then we double-click the egg(s)
        pg.mouse.move(684, 345, steps=8); pg.mouse.dblclick(684, 345); pg.wait_for_timeout(1300)


def dino(pg, r):
    pg.goto(f"{BASE}/units/unit16-dino-typing/?tier=t1"); pg.wait_for_timeout(1200)
    pg.click(".ti-start"); pg.wait_for_timeout(1500)
    r.start()
    type_cur(pg, 8, .16)


def pixel(pg, r):
    pg.goto(f"{BASE}/units/unit5-pixel-art/"); pg.wait_for_timeout(1200)
    pg.click(".ai-start"); pg.wait_for_timeout(1200)
    target = [[3,3,3,3,3,3,3,3],[3,1,1,3,3,1,1,3],[1,2,2,1,1,1,1,1],[1,2,1,1,1,1,1,1],
              [1,1,1,1,1,1,1,1],[3,1,1,1,1,1,1,3],[3,3,1,1,1,1,3,3],[3,3,3,1,1,3,3,3]]
    box = pg.locator(".sc-pixel-cv").bounding_box(); cell = box["width"] / 8
    xy = lambda r_, c_: (box["x"] + cell * (c_ + .5), box["y"] + cell * (r_ + .5))
    r.start()
    pg.wait_for_timeout(600)
    for color in (1, 2, 3):
        pg.click(f".sc-pal-item[data-color-id='{color}']"); pg.wait_for_timeout(250)
        for row in range(8):
            cols = [c for c in range(8) if target[row][c] == color]
            if not cols: continue
            x0, y0 = xy(row, cols[0]); pg.mouse.move(x0, y0, steps=4); pg.mouse.down()
            for c in cols[1:]:
                x, y = xy(row, c); pg.mouse.move(x, y, steps=3)
            pg.mouse.up(); pg.wait_for_timeout(90)
    pg.wait_for_timeout(400)
    pg.click(".sc-done"); pg.wait_for_timeout(3500)


def turtle(pg, r):
    pg.goto(f"{BASE}/units/unit6-turtle-commander/"); pg.wait_for_timeout(1200)
    pg.click(".big-btn.gold"); pg.wait_for_timeout(1200)
    r.start()
    pg.wait_for_timeout(500)
    right = pg.locator(".dir-btn[data-dir='right']")
    for _ in range(5):
        right.hover(); pg.wait_for_timeout(120); right.click(); pg.wait_for_timeout(380)
    pg.locator("#run-btn").hover(); pg.wait_for_timeout(200); pg.click("#run-btn")
    pg.wait_for_timeout(4500)


def duel(pg, r):
    pg.goto(f"{BASE}/units/unit23-typing-duel/"); pg.wait_for_timeout(1200)
    pg.click("#btn-start-bot"); pg.wait_for_timeout(1200)
    pg.click("text=英打 ABC"); pg.wait_for_timeout(400)
    pg.click("#btn-room-start"); pg.wait_for_timeout(1500)
    r.start()
    type_cur(pg, 8, .12)


FLOWS = {"egg": egg, "dino": dino, "pixel": pixel, "turtle": turtle, "duel": duel}
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name in (sys.argv[1:] or FLOWS):
            ctx = b.new_context(viewport={"width": 1280, "height": 720}, device_scale_factor=1.5)
            pg = ctx.new_page()
            r = Rec(pg, name)
            try:
                FLOWS[name](pg, r); r.stop()
            except Exception as e:
                print(f"{name}: FAILED {e}")
            ctx.close()
        b.close()
finally:
    srv.shutdown()
