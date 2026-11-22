"""開瀏覽器抽出畫面上真的用注音字型的文字（computed font-family 含 Bpmf），每句一行去重。
比 zy-extract-strings.py 準：只抓小朋友會看到注音的字；但只抓得到「當下畫面」，動態台詞要另外跑。

用法：python tools/zy-extract-dom.py <html 檔或 http 網址> <out.txt>
  本機檔案會自動轉 file:// 網址；頁面要載入字型或模組時改用 http.server 網址。
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

if len(sys.argv) < 3:
    sys.exit(__doc__)
src = sys.argv[1]
url = src if src.startswith("http") else Path(src).resolve().as_uri()
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1366, "height": 700})
    pg.goto(url)
    pg.wait_for_timeout(800)
    lines = pg.evaluate("""() => {
      const out = new Set();
      for (const el of document.querySelectorAll('body *')) {
        if (!/Bpmf/i.test(getComputedStyle(el).fontFamily)) continue;
        // 只取自己這層的文字節點，避免父子重複
        const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').replace(/\\s+/g, ' ').trim();
        if (/[\\u4e00-\\u9fff]/.test(t)) out.add(t);
      }
      return [...out];
    }""")
    b.close()
Path(sys.argv[2]).write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
print(len(lines), "句")
