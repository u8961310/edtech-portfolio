#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
驗收 Gemini Canvas 產出的大富翁 HTML 是否符合 CANVAS_PROMPT.md 的契約。

用法：
    python board/verify-canvas.py <canvas產出的.html>                 # 大富翁（edtech-board-*）
    python board/verify-canvas.py <檔案.html> --unit 22               # 單元：key 要是 edtech-unit22-*，且要存 -score

只做靜態檢查。版面（390px 不可橫向捲動）與視覺層次要在瀏覽器裡看，
腳本最後會列出那幾項提醒人工確認。
"""
import io
import os
import re
import sys

OK, WARN, FAIL = 'PASS', 'WARN', 'FAIL'
results = []


def check(name, status, detail=''):
    results.append((status, name, detail))


# ---------------------------------------------------------------- 讀檔
if len(sys.argv) < 2:
    print('用法：python board/verify-canvas.py <檔案.html>')
    sys.exit(2)

path = sys.argv[1]
# --unit N：驗單元而不是大富翁（2026-11-19 為 unit22 聖誕遊戲加）
UNIT = None
if '--unit' in sys.argv:
    UNIT = sys.argv[sys.argv.index('--unit') + 1]
KEY_PREFIX = 'edtech-unit%s-' % UNIT if UNIT else 'edtech-board-'
if not os.path.exists(path):
    print('找不到檔案：' + path)
    sys.exit(2)

html = io.open(path, encoding='utf-8', errors='replace').read()
size_kb = os.path.getsize(path) / 1024


def strip_comments(s):
    """去掉註解再掃描。

    否則「請勿使用 🪙」這種說明文字本身就會被判成違規——
    解釋規則的註解反而害檢查失敗，是典型的假陽性。
    """
    s = re.sub(r'<!--.*?-->', ' ', s, flags=re.S)       # HTML
    s = re.sub(r'/\*.*?\*/', ' ', s, flags=re.S)        # CSS / JS 區塊註解
    s = re.sub(r'(?<!:)//[^\n]*', ' ', s)               # JS 行註解（避開 http://）
    return s


scan = strip_comments(html)

# ---------------------------------------------------------------- 1. 單一檔案
ext_script = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html, re.I)
ext_css = re.findall(r'<link[^>]+rel=["\']stylesheet["\'][^>]*>', html, re.I)

allowed_host = ('fonts.googleapis.com', 'fonts.gstatic.com')
# 整合階段才加的四區共用證書（board/ 底下的本地檔）。Canvas 交件時不該出現，
# 但整合後的檔案要能重跑這支腳本，所以放行。
allowed_local = ('certificate.js', 'certificate.css')
# unit23 打字擂台：遊戲邏輯刻意拆在同資料夾的 JS（Claude 維護），Gemini 產的頁面只載入它們
UNIT_LOCAL_JS = {'23': ('passages.js', 'duel-rules.js', 'duel-core.js', 'duel-net.js')}


def is_allowed(url):
    # 單元模式另外放行整合階段放進同資料夾的子集字型（unit22 注音粉圓 fonts/*.woff2）
    local_font = bool(UNIT) and url.startswith('fonts/') and url.endswith('.woff2')
    unit_js = url in UNIT_LOCAL_JS.get(UNIT, ())
    return any(h in url for h in allowed_host) or url in allowed_local or local_font or unit_js


bad_script = [s for s in ext_script if not is_allowed(s)]
check('單一 HTML：沒有外部 <script src>', FAIL if bad_script else OK,
      '、'.join(bad_script))

bad_css = []
for tag in ext_css:
    m = re.search(r'href=["\']([^"\']+)["\']', tag, re.I)
    if m and not is_allowed(m.group(1)):
        bad_css.append(m.group(1))
check('單一 HTML：沒有外部 stylesheet（Google Fonts 除外）',
      FAIL if bad_css else OK, '、'.join(bad_css))

# ---------------------------------------------------------------- 2. 外部素材
media_src = re.findall(r'<(?:img|audio|video|source)[^>]+src=["\']([^"\']+)["\']', html, re.I)
# (?<![\w-]) 是必要的：忽略大小寫時 `url(` 會吃到 `toDataURL(`、`createObjectURL(`，
# 把 'image/png' 誤判成外部素材。要求前面不是字母才算真正的 CSS url()。
css_url = re.findall(r'(?<![\w-])url\(\s*["\']?([^)"\']+)', scan, re.I)

def is_inline(u):
    return u.startswith('data:') or u.startswith('#')

bad_media = [u for u in media_src if not is_inline(u)]
bad_url = [u for u in css_url if not is_inline(u) and not is_allowed(u)]

check('沒有引用外部圖片／音效檔', FAIL if (bad_media or bad_url) else OK,
      '、'.join((bad_media + bad_url)[:4]))

# ---------------------------------------------------------------- 3. emoji 年份
# 啟發式：U+1FA00–1FAFF 是 Unicode 12+（2019 後），舊系統字型幾乎都沒有。
# U+1F900–1F9FF 是 Unicode 8–11（2015–2018），部分舊機器也缺。
risky_new = sorted(set(re.findall(r'[\U0001FA00-\U0001FAFF]', scan)))
risky_mid = sorted(set(re.findall(r'[\U0001F900-\U0001F9FF]', scan)))

check('沒有使用 2019 年後的新 emoji（U+1FA00+）',
      FAIL if risky_new else OK,
      ' '.join('%s(U+%04X)' % (e, ord(e)) for e in risky_new))

check('未使用 2015–2018 的次新 emoji（U+1F900+，舊機可能缺字）',
      WARN if risky_mid else OK,
      ' '.join('%s(U+%04X)' % (e, ord(e)) for e in risky_mid))

# ---------------------------------------------------------------- 4. localStorage key
# 直接寫字面字串的
keys = set(re.findall(r'localStorage\.(?:get|set|remove)Item\(\s*[\'"`]([^\'"`]+)', scan))

# 透過常數傳入的（Canvas 很常這樣寫）：先抓識別字，再回頭解析它的值。
# 沒做這步會出現最糟的 false negative——key 命名錯誤會被誤報成「完全沒有存檔」。
idents = set(re.findall(r'localStorage\.(?:get|set|remove)Item\(\s*([A-Za-z_$][\w$]*)\s*[,)]', scan))
unresolved = []
for name in idents:
    m = re.search(r'(?:const|let|var)\s+' + re.escape(name) + r'\s*=\s*[\'"`]([^\'"`]+)', scan)
    if m:
        keys.add(m.group(1))
    else:
        unresolved.append(name)

keys = sorted(keys)
off_contract = [k for k in keys if not k.startswith(KEY_PREFIX)]

if off_contract:
    status, detail = FAIL, '未照契約：' + '、'.join(off_contract)
elif unresolved:
    # 用了常數但解析不到值 —— 不能當作通過，必須人工看
    status, detail = WARN, '有無法解析的 key 變數：' + '、'.join(unresolved)
elif keys:
    status, detail = OK, '找到：' + '、'.join(keys)
else:
    status, detail = WARN, '完全沒有存檔'

check('localStorage key 都是 %s* 前綴' % KEY_PREFIX, status, detail)

if UNIT:
    # 首頁徽章只讀 edtech-unit{N}-score；unit13～21 有 6 個單元就是漏了這條，徽章永遠不亮
    score_key = 'edtech-unit%s-score' % UNIT
    check('有存首頁徽章用的 %s' % score_key,
          OK if score_key in keys else FAIL,
          '' if score_key in keys else '首頁「最佳成績」徽章會永遠不亮')

# ---------------------------------------------------------------- 5. reduced-motion
check('有 prefers-reduced-motion 區塊',
      OK if 'prefers-reduced-motion' in html else FAIL)

# ---------------------------------------------------------------- 6. viewport
vp = re.search(r'<meta[^>]+name=["\']viewport["\'][^>]*>', html, re.I)
check('有 viewport meta', OK if vp else FAIL)

# ---------------------------------------------------------------- 7. QUESTIONS 常數
qm = re.search(r'(?:const|let|var)\s+QUESTIONS\s*=\s*\[', html)
check('題目抽成 QUESTIONS 常數陣列', OK if qm else FAIL,
      '' if qm else '老師要加題目就得翻程式碼')

if qm:
    n_q = len(re.findall(r'\bq\s*:\s*[\'"`]', html))
    n_a = len(re.findall(r'\ba\s*:\s*\d', html))
    check('QUESTIONS 格式看起來正確（有 q / opts / a）',
          OK if (n_q and n_a and 'opts' in html) else WARN,
          '偵測到 %d 個 q、%d 個 a' % (n_q, n_a))

# ---------------------------------------------------------------- 8. 字級
sizes = [int(x) for x in re.findall(r'font-size:\s*(\d+)px', html)]
small = [s for s in sizes if s < 16]
check('沒有過小字級（<16px）', WARN if small else OK,
      ('出現 %d 處，最小 %dpx' % (len(small), min(small))) if small else '')

# ---------------------------------------------------------------- 9. cursor
check('可點擊元素有 cursor: pointer',
      OK if 'cursor: pointer' in html or 'cursor:pointer' in html else WARN)

# ------------------------------------------------- 10. 彈窗關閉要移出 Tab 順序（契約 v2 #11）
# 只有 opacity:0 + pointer-events:none 時，按鈕仍可被 Tab 聚焦後按 Enter。
has_hide = re.search(r'visibility:\s*hidden', scan) or re.search(r'\binert\b', scan)
check('彈出視窗關閉時移出 Tab 順序（visibility:hidden 或 inert）',
      OK if has_hide else WARN,
      '' if has_hide else '只靠 opacity/pointer-events 的話鍵盤仍可操作隱藏按鈕')

# ------------------------------------------------- 11. SVG points 百分比（契約 v3 #15）
# SVG 的 points 只吃數字，寫百分比會整個不渲染且 console 報錯，
# 但畫面上看不出來——沒畫出來的東西是看不見的。2026-09-20 海洋區首生踩到。
pct_points = re.findall(r'<(?:polygon|polyline)[^>]*\bpoints\s*=\s*"([^"]*%[^"]*)"', scan, re.I)
check('SVG polygon/polyline 的 points 沒有用百分比',
      FAIL if pct_points else OK,
      ('%d 處，例：%s' % (len(pct_points), pct_points[0][:40])) if pct_points else '')

# ------------------------------------------------- 12. ZONE_ID 標記（契約 v2 #14）
if not UNIT:
    zone = re.search(r'<!--\s*ZONE_ID:\s*([a-z]+)\s*-->', html)
    check('檔頭有 ZONE_ID 標記', OK if zone else WARN,
          ('zone = ' + zone.group(1)) if zone else '整合時要靠它辨識區域')

# ------------------------------------------- 13. 縮放盒子要 flex-shrink: 0（契約 v3.1 #17）
# 「固定 px 畫布 + JS scale」的做法，盒子放在 flex 父層裡會先被壓到視窗寬，
# 座標超出的格子被 overflow:hidden 裁掉、完全點不到，而且等於縮了兩次。
# 2026-09-20 海洋區與森林區都中：390px 下 6 格有 2 格點不到。
uses_js_scale = re.search(r'transform\s*=\s*[`\'"]\s*scale\(', scan)
has_no_shrink = re.search(r'flex-shrink:\s*0', scan)
if not uses_js_scale:
    check('固定尺寸畫布有 flex-shrink: 0', OK, '沒有用 JS scale，不適用')
else:
    check('固定尺寸畫布有 flex-shrink: 0',
          OK if has_no_shrink else FAIL,
          '' if has_no_shrink else '父層 flex 會把盒子壓小，超出的格子會被裁掉點不到')

# ---------------------------------------------------------------- 輸出
W = max(len(n) for _, n, _ in results) + 2
icon = {OK: '[OK]  ', WARN: '[WARN]', FAIL: '[FAIL]'}

print()
print('驗收：%s  (%.0f KB)' % (os.path.basename(path), size_kb))
print('=' * (W + 30))
for status, name, detail in results:
    line = '%s %s' % (icon[status], name.ljust(W))
    if detail:
        line += ' -> ' + detail
    print(line)

n_fail = sum(1 for s, _, _ in results if s == FAIL)
n_warn = sum(1 for s, _, _ in results if s == WARN)

print('=' * (W + 30))
print('FAIL %d / WARN %d / 共 %d 項' % (n_fail, n_warn, len(results)))

print()
print('以下需在瀏覽器人工確認（腳本測不到）：')
for item in [
    '390px 直立六格全在畫面內（腳本只驗 CSS，實際位置仍要量）',
    '有場景層次（天空／遠山／地面／前景）',
    '路徑蜿蜒、格子造型有變化',
    '棋子是有表情的角色，不是 emoji 放圓圈',
    '走過／未走過的格子一眼可分',
    '答錯一題仍拿得到最高評等',
    '可變值（校名等）是介面可編輯，不是寫死的',
    '音效能關閉',
]:
    print('  [ ] ' + item)

sys.exit(1 if n_fail else 0)
