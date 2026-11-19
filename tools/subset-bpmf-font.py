"""把注音粉圓（Bpmf Huninn）抽成「只含某單元用到的字」的 woff2。

什麼時候要跑：unit22（或之後用注音字型的單元）改了頁面文字之後——新字不在子集裡，
會退回成沒有注音的一般字型（2026-11-19「黑煤炭」就是這樣沒注音）。

怎麼跑（repo 根目錄）：
    python tools/subset-bpmf-font.py <BpmfHuninn-Regular.ttf> units/unit22-xmas-workshop
    python tools/subset-bpmf-font.py <ttf> units/unit23-typing-duel bpmf-huninn-duel.woff2
原始字型下載：https://github.com/ButTaiwan/bpmfvs/tree/master/fonts （SIL OFL 1.1，原檔 4.8 MB 不進 repo）
需要：pip install fonttools brotli
產出：<單元資料夾>/fonts/<輸出檔名>（第 3 個參數，省略＝bpmf-huninn-xmas.woff2）
字集＝資料夾內所有 .html／.js 的非 ASCII 字＋基本 ASCII（題庫放 .js 也抓得到）
"""
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

src, unit_dir = Path(sys.argv[1]), Path(sys.argv[2])
out_name = sys.argv[3] if len(sys.argv) > 3 else "bpmf-huninn-xmas.woff2"
out = unit_dir / "fonts" / out_name

chars = {chr(c) for c in range(0x20, 0x7F)}
for h in sorted([*unit_dir.glob("*.html"), *unit_dir.glob("*.js")]):
    chars |= {ch for ch in h.read_text(encoding="utf-8") if ord(ch) > 0x7F}

f = TTFont(src)
cmap = f.getBestCmap()
used = sorted(c for c in chars if ord(c) in cmap)
print("用到的字元:", len(chars), "| 字型裡有的:", len(used))

opts = subset.Options()
opts.flavor = "woff2"
opts.layout_features = ["*"]   # 注音標示靠 OpenType 特性，全部保留
opts.name_IDs = ["*"]          # 保留著作權與授權資訊（OFL 要求）
opts.name_languages = ["*"]
opts.notdef_outline = True
sub = subset.Subsetter(opts)
# 連同變體選擇符（IVS）一起保留，破音字才標得對
sub.populate(unicodes=[ord(c) for c in used] + list(range(0xFE00, 0xFE10)) + list(range(0xE0100, 0xE01F0)))
sub.subset(f)
out.parent.mkdir(parents=True, exist_ok=True)
subset.save_font(f, out, opts)
print("輸出:", out, round(out.stat().st_size / 1024), "KB")
