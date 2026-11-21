"""畫畫島注音字型子集：掃 assets/art/*.html 與畫畫島 6 關的 index.html，產出 assets/art/fonts/bpmf-huninn-art.woff2。
什麼時候要跑：任何一關交件、或改了注音句（class="ai-zy"）之後；新字不在子集裡會退回沒有注音的字型。
用法（repo 根目錄）：python tools/build-art-font.py <BpmfHuninn-Regular.ttf>
原始字型：家用機 D:\\code\\playground\\art-island-design\\fonts-src\\BpmfHuninn-Regular.ttf（不進 repo；來源 ButTaiwan/bpmfvs，SIL OFL 1.1）
需要：pip install fonttools brotli
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ART_UNITS = ["unit5-pixel-art", "unit18-magic-paint", "unit24-color-cauldron", "unit25-line-train",
             "unit26-mirror-workshop", "unit27-paint-mission", "unit28-sparkle-fireworks"]

ttf = sys.argv[1]
tmp = Path(tempfile.mkdtemp())
files = list((ROOT / "assets/art").glob("*.html"))
for u in ART_UNITS:
    f = ROOT / "units" / u / "index.html"
    if f.exists() and "art-ui.js" in f.read_text(encoding="utf-8", errors="ignore"):   # 舊版還沒換外殼的不算
        files.append(f)
for i, f in enumerate(files):
    shutil.copy(f, tmp / f"{i}-{f.parent.name}.html")
print("掃描：", ", ".join(f.parent.name if f.name == "index.html" else f.name for f in files))
subprocess.run([sys.executable, str(ROOT / "tools/subset-bpmf-font.py"), ttf, str(tmp), "bpmf-huninn-art.woff2"], check=True)
(ROOT / "assets/art/fonts").mkdir(parents=True, exist_ok=True)
shutil.copy(tmp / "fonts/bpmf-huninn-art.woff2", ROOT / "assets/art/fonts/bpmf-huninn-art.woff2")
print("已更新 assets/art/fonts/bpmf-huninn-art.woff2")
