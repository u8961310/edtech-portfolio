"""產生 unit23 選文審稿頁（HTML）：依領域、年級列出全部文章，中文用注音粉圓顯示（含破音字選擇器）。

用法（repo 根目錄）：python tools/build-passages-review.py <輸出 html> [待確認事項.txt]
字型讀 units/unit23-typing-duel/fonts/bpmf-huninn-duel.woff2（發布時用相對路徑 fonts/ 帶上）
"""
import html
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
js = (root / "units/unit23-typing-duel/passages.js").read_text(encoding="utf-8")
ps = json.loads(re.search(r"window\.PASSAGES = (\[.*\]);", js, re.S).group(1))
notes = Path(sys.argv[2]).read_text(encoding="utf-8").strip().splitlines() if len(sys.argv) > 2 else []

ORDER = ["國語文", "生活課程", "數學", "自然科學", "社會", "健康與體育", "藝術", "綜合活動", "資訊議題", "英語文"]
GR = {"low": "低年級", "mid": "中年級", "high": "高年級"}


def disp(p):
    if p["lang"] != "zh":
        return html.escape(p["text"])
    out = []
    for i, ch in enumerate(p["text"]):
        n = p.get("ivs", {}).get(str(i))
        s = ch + (chr(0xE01E0 + n - 1) if n and n > 1 else "")
        out.append(f'<mark title="指定讀音 {p["zhuyin"][i]}">{s}</mark>' if n else html.escape(s))
    return "".join(out)


def count(p):
    return len([z for z in p.get("zhuyin", [])]) and sum(1 for z in p["zhuyin"] if z) if p["lang"] == "zh" else len(p["text"].split())


zh = [p for p in ps if p["lang"] == "zh"]
en = [p for p in ps if p["lang"] == "en"]
rows = []
for dom in ORDER:
    for g in ["low", "mid", "high"]:
        for p in [q for q in ps if (q["domain"] if q["lang"] == "zh" else "英語文") == dom and q["grade"] == g]:
            unit = "字" if p["lang"] == "zh" else "詞"
            src = html.escape(p["source"])
            rows.append(
                f'<article class="p {p["lang"]}"><header><span class="dom">{html.escape(p["domain"])}</span>'
                f'<span class="gr g-{g}">{GR[g]}</span><h3>{html.escape(p["title"])}</h3>'
                f'<span class="meta">{p["id"]} · {count(p)} {unit} · {src}</span></header>'
                f'<p class="t">{disp(p)}</p></article>')

summary = []
for dom in ORDER[:-1]:
    c = {g: sum(1 for p in zh if p["domain"] == dom and p["grade"] == g) for g in GR}
    summary.append(f"<tr><td>{dom}</td>" + "".join(f'<td class="num">{c[g] or "—"}</td>' for g in GR) +
                   f'<td class="num">{sum(c.values())}</td></tr>')
ec = {g: sum(1 for p in en if p["grade"] == g) for g in GR}
summary.append("<tr><td>英文（各主題）</td>" + "".join(f'<td class="num">{ec[g]}</td>' for g in GR) + f'<td class="num">{len(en)}</td></tr>')
ivs_total = sum(len(p.get("ivs", {})) for p in zh)
note_html = "".join(f"<li>{html.escape(n.lstrip('- '))}</li>" for n in notes if n.strip())

page = f"""<meta charset="utf-8">
<title>打字擂台選文審稿</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap">
<style>
/* Layout: 頂部摘要表＋待確認清單，下方文章卡依領域排列；文章用注音粉圓 */
@font-face {{ font-family: 'Bpmf Huninn'; src: url('fonts/bpmf-huninn-duel.woff2') format('woff2'); font-display: swap; }}
:root {{ --bg:#e8edf3; --paper:#f8fafc; --fg:#1d2733; --muted:#4a5868; --line:#c9d3df; --thead:#1f3a5f;
  --chip:#dde6f0; --mark:#fff1b8; --low:#2c8a6e; --mid:#2f6db5; --high:#7a4fb0; --warn:#9a4a12; --warn-bg:#fbeadc; }}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg:#1a222c; --paper:#222c38; --fg:#e4eaf1; --muted:#aab6c4;
  --line:#3a4757; --thead:#2c4d78; --chip:#2e3b4b; --mark:#5a4a12; --warn:#f2b483; --warn-bg:#3a2a1e; color-scheme:dark; }} }}
:root[data-theme="dark"] {{ --bg:#1a222c; --paper:#222c38; --fg:#e4eaf1; --muted:#aab6c4; --line:#3a4757; --thead:#2c4d78;
  --chip:#2e3b4b; --mark:#5a4a12; --warn:#f2b483; --warn-bg:#3a2a1e; color-scheme:dark; }}
body {{ background:var(--bg); color:var(--fg); font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif; line-height:1.7; }}
.wrap {{ max-width:980px; margin:0 auto; padding-block:24px 60px; padding-left:max(16px,env(safe-area-inset-left,0px));
  padding-right:max(16px,env(safe-area-inset-right,0px)); display:flex; flex-direction:column; gap:18px; }}
h1 {{ margin:0; font-size:1.7rem; }}
.lead {{ margin:.2rem 0 0; color:var(--muted); }}
section.box {{ background:var(--paper); border:1px solid var(--line); border-radius:6px; overflow:hidden; }}
section.box > h2 {{ margin:0; padding:8px 14px; background:var(--thead); color:#fff; font-size:1rem; }}
.in {{ padding:10px 14px 14px; min-width:0; }}
.tbl {{ overflow-x:auto; }}
table {{ border-collapse:collapse; width:100%; font-size:.92rem; }}
th {{ background:var(--thead); color:#fff; text-align:left; padding:5px 9px; font-weight:500; }}
td {{ padding:5px 9px; border-bottom:1px solid var(--line); }}
.num {{ text-align:right; font-variant-numeric:tabular-nums; }}
.warn {{ background:var(--warn-bg); color:var(--warn); }}
.warn li {{ margin:.25rem 0; }}
.p {{ background:var(--paper); border:1px solid var(--line); border-radius:6px; padding:10px 14px; }}
.p header {{ display:flex; flex-wrap:wrap; align-items:baseline; gap:8px; }}
.p h3 {{ margin:0; font-size:1.05rem; }}
.dom, .gr {{ font-size:.8rem; padding:1px 8px; border-radius:4px; background:var(--chip); }}
.gr {{ color:#fff; }} .g-low {{ background:var(--low); }} .g-mid {{ background:var(--mid); }} .g-high {{ background:var(--high); }}
.meta {{ color:var(--muted); font-size:.82rem; margin-left:auto; }}
.t {{ margin:.5rem 0 0; font-size:24px; line-height:1.9; }}
.zh .t {{ font-family:'Bpmf Huninn','Noto Sans TC',sans-serif; letter-spacing:.02em; }}
.en .t {{ font-family:Consolas,monospace; font-size:18px; }}
mark {{ background:var(--mark); color:inherit; border-radius:3px; }}
</style>
<div class="wrap">
<header><h1>打字擂台：選文審稿</h1>
<p class="lead">中文 {len(zh)} 篇、英文 {len(en)} 篇。中文照遊戲裡的樣子用注音字型顯示；<mark>黃底</mark>的字是我指定了非預設讀音的破音字（共 {ivs_total} 處，滑鼠停上去看讀音）。</p></header>
<section class="box"><h2>篇數分布</h2><div class="in"><div class="tbl"><table>
<tr><th>領域</th><th class="num">低年級</th><th class="num">中年級</th><th class="num">高年級</th><th class="num">合計</th></tr>
{''.join(summary)}</table></div></div></section>
<section class="box"><h2>要請你確認的地方</h2><div class="in warn"><ol>{note_html}</ol></div></section>
{''.join(rows)}
</div>
"""
Path(sys.argv[1]).write_text(page, encoding="utf-8")
print("寫出", sys.argv[1], len(rows), "篇")
