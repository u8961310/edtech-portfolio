"""小常識島注音字型子集：掃 assets/smart/*.html、assets/js/smart-ui.js（預設回饋句）、寵物小屋與小常識島各關的 index.html，
產出 assets/smart/fonts/bpmf-huninn-smart.woff2。
什麼時候要跑：任何一關交件、或改了注音句（class="sm-zy"、howto、feedback 的 text／explain）之後；新字不在子集裡會退回沒有注音的字型。
用法（repo 根目錄）：python tools/build-smart-font.py <BpmfHuninn-Regular.ttf>
原始字型：家用機 D:\\code\\playground\\art-island-design\\fonts-src\\BpmfHuninn-Regular.ttf（不進 repo；來源 ButTaiwan/bpmfvs，SIL OFL 1.1）
需要：pip install fonttools brotli
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SMART_UNITS = ["smart-pet-house", "unit29-pet-computer", "unit30-pet-schedule", "unit31-pet-message",
               "unit32-pet-ai-homework", "unit8-desktop-organizer", "unit9-net-detective"]

ttf = sys.argv[1]
tmp = Path(tempfile.mkdtemp())
files = list((ROOT / "assets/smart").glob("*.html")) + [ROOT / "assets/js/smart-ui.js"]
for u in SMART_UNITS:
    f = ROOT / "units" / u / "index.html"
    if f.exists() and "smart-ui.js" in f.read_text(encoding="utf-8", errors="ignore") or (f.exists() and u == "smart-pet-house"):
        files.append(f)
for i, f in enumerate(files):
    shutil.copy(f, tmp / f"{i}-{f.parent.name}-{f.name}")
print("掃描：", ", ".join(f.parent.name if f.name == "index.html" else f.name for f in files))
subprocess.run([sys.executable, str(ROOT / "tools/subset-bpmf-font.py"), ttf, str(tmp), "bpmf-huninn-smart.woff2"], check=True)
(ROOT / "assets/smart/fonts").mkdir(parents=True, exist_ok=True)
shutil.copy(tmp / "fonts/bpmf-huninn-smart.woff2", ROOT / "assets/smart/fonts/bpmf-huninn-smart.woff2")
print("已更新 assets/smart/fonts/bpmf-huninn-smart.woff2")
