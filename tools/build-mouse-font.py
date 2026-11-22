"""滑鼠島注音字型子集：掃 assets/mouse/*.html、assets/js/mouse-ui.js（外殼內建的注音句）、滑鼠島各關的 index.html（zhuyin: true 的關），
產出 assets/mouse/fonts/bpmf-huninn-mouse.woff2。
什麼時候要跑：任何一關交件、或改了注音句（class="mi-zy"、howto、hints、dex 名稱）之後；新字不在子集裡會退回沒有注音的字型。
用法（repo 根目錄）：python tools/build-mouse-font.py <BpmfHuninn-Regular.ttf>
原始字型：家用機 D:\\code\\playground\\art-island-design\\fonts-src\\BpmfHuninn-Regular.ttf（不進 repo；來源 ButTaiwan/bpmfvs，SIL OFL 1.1）
需要：pip install fonttools brotli
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# 滑鼠島 7 關資料夾（新關做好後補進來；舊關 unit2／unit19／unit21 換新外殼後也會用 mouse-ui.js）
MOUSE_UNITS = ["unit21-mouse-challenge", "unit33-egg-tap", "unit19-farm-harvest", "unit2-mouse-adventure",
               "unit34-right-click-wizard", "unit35-scroll-sea", "unit36-box-farm"]

ttf = sys.argv[1]
tmp = Path(tempfile.mkdtemp())
files = list((ROOT / "assets/mouse").glob("*.html")) + [ROOT / "assets/js/mouse-ui.js"]
for u in MOUSE_UNITS:
    f = ROOT / "units" / u / "index.html"
    if not f.exists():
        continue
    t = f.read_text(encoding="utf-8", errors="ignore")
    if "mouse-ui.js" in t and "zhuyin: true" in t:   # 3–4 年級沒注音的關不用掃
        files.append(f)
for i, f in enumerate(files):
    shutil.copy(f, tmp / f"{i}-{f.parent.name}-{f.name}")
print("掃描：", ", ".join(f.parent.name if f.name == "index.html" else f.name for f in files))
subprocess.run([sys.executable, str(ROOT / "tools/subset-bpmf-font.py"), ttf, str(tmp), "bpmf-huninn-mouse.woff2"], check=True)
(ROOT / "assets/mouse/fonts").mkdir(parents=True, exist_ok=True)
shutil.copy(tmp / "fonts/bpmf-huninn-mouse.woff2", ROOT / "assets/mouse/fonts/bpmf-huninn-mouse.woff2")
lic = ROOT / "assets/smart/fonts/FONT-LICENSE.txt"
if lic.exists():
    shutil.copy(lic, ROOT / "assets/mouse/fonts/FONT-LICENSE.txt")
print("已更新 assets/mouse/fonts/bpmf-huninn-mouse.woff2")
