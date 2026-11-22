"""用實際的注音子集字型，把要人工看的詞／句放大渲染成圖，目視確認注音對不對（含 IVS 選到的字形）。

用法：python tools/zy-render.py <字型.woff2> <out.png> <words.txt>
  字型例：assets/fonts/ 底下各島的子集（mouse、home、smart…）；words.txt 每行一句。
"""
import base64
import sys
from playwright.sync_api import sync_playwright

if len(sys.argv) < 4:
    sys.exit(__doc__)
words = [l.strip() for l in open(sys.argv[3], encoding="utf-8") if l.strip()]
b64 = base64.b64encode(open(sys.argv[1], "rb").read()).decode()
html = ("<style>@font-face{font-family:Z;src:url(data:font/woff2;base64," + b64 + ")}"
        "body{font-family:Z;font-size:56px;margin:16px;background:#fff}div{margin:6px 0}</style>"
        + "".join(f"<div>{w}</div>" for w in words))
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 900, "height": 300})
    pg.set_content(html)
    pg.wait_for_timeout(600)
    pg.screenshot(path=sys.argv[2], full_page=True)
    b.close()
print("已存", sys.argv[2])
