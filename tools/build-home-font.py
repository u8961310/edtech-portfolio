"""首頁注音字型子集：掃 index.html（歡迎卡、選嚮導、泡泡的注音句）＋ island/data.js（泡泡「下一站：○○！」用到所有關卡短名），
產出 assets/fonts/bpmf-huninn-home.woff2。
什麼時候要跑：首頁改了注音句（class="zy"）、或 data.js 新增／改名關卡之後；新字不在子集裡會退回沒有注音的字型。
用法（repo 根目錄）：python tools/build-home-font.py <BpmfHuninn-Regular.ttf>
原始字型：家用機 D:\\code\\playground\\art-island-design\\fonts-src\\BpmfHuninn-Regular.ttf（不進 repo；來源 ButTaiwan/bpmfvs，SIL OFL 1.1）
需要：pip install fonttools brotli
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ttf = sys.argv[1]
tmp = Path(tempfile.mkdtemp())
for f in [ROOT / "index.html", ROOT / "island/data.js"]:
    shutil.copy(f, tmp / f.name)
subprocess.run([sys.executable, str(ROOT / "tools/subset-bpmf-font.py"), ttf, str(tmp), "bpmf-huninn-home.woff2"], check=True)
(ROOT / "assets/fonts").mkdir(parents=True, exist_ok=True)
shutil.copy(tmp / "fonts/bpmf-huninn-home.woff2", ROOT / "assets/fonts/bpmf-huninn-home.woff2")
shutil.copy(ROOT / "assets/smart/fonts/FONT-LICENSE.txt", ROOT / "assets/fonts/FONT-LICENSE.txt")
print("已更新 assets/fonts/bpmf-huninn-home.woff2")
