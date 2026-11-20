"""產生打字島中打選文審稿頁（HTML）：依類別（唐詩／宋詞／三字經）× 三階列出全部文章，用注音粉圓顯示（含破音字選擇器）。

用法（repo 根目錄）：python tools/build-typing-review.py <輸出 html> [待確認事項.txt]
讀 assets/typing/passages.js；字型用相對路徑 fonts/bpmf-huninn-typing.woff2（發布時要把字型一起帶上）
"""
import html
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
js = (root / "assets/typing/passages.js").read_text(encoding="utf-8")
ps = json.loads(re.search(r"window\.PASSAGES = (\[.*\]);", js, re.S).group(1))
notes = Path(sys.argv[2]).read_text(encoding="utf-8").strip().splitlines() if len(sys.argv) > 2 else []

CATS = ["唐詩", "宋詞", "三字經"]
TIERS = {"t1": "初階 1–3 年級", "t2": "進階 4–5 年級", "t3": "高階 6 年級"}


def disp(p):
    out = []
    for i, ch in enumerate(p["text"]):
        n = p.get("ivs", {}).get(str(i))
        s = ch + (chr(0xE01E0 + n - 1) if n and n > 1 else "")
        out.append(f'<mark title="指定讀音 {p["zhuyin"][i]}">{s}</mark>' if n else html.escape(s))
    return "".join(out)


def chars(p):
    return sum(1 for z in p["zhuyin"] if z)


sections = []
for cat in CATS:
    cards = []
    for t, label in TIERS.items():
        group = [p for p in ps if p["domain"] == cat and p["grade"] == t]
        if not group:
            continue
        lens = [chars(p) for p in group]
        cards.append(f'<h3 class="tier"><span class="gr g-{t}">{label}</span>'
                     f'<span class="meta">{len(group)} 篇 · {min(lens)}–{max(lens)} 字</span></h3>')
        for p in group:
            by = f'{html.escape(p["author"])} · ' if p.get("author") else ""
            cards.append(
                f'<article class="p"><header><h4>{html.escape(p["title"])}</h4>'
                f'<span class="meta">{by}{chars(p)} 字 · {p["id"]}</span></header>'
                f'<p class="t">{disp(p)}</p>'
                + (f'<p class="gloss">白話：{html.escape(p["gloss"])}</p>' if p.get("gloss") else "")
                + "</article>")
    sections.append(f'<section class="cat"><h2>{cat}</h2><div class="cards">{"".join(cards)}</div></section>')

summary = []
for cat in CATS:
    c = {t: sum(1 for p in ps if p["domain"] == cat and p["grade"] == t) for t in TIERS}
    summary.append(f"<tr><td>{cat}</td>" + "".join(f'<td class="num">{c[t]}</td>' for t in TIERS) +
                   f'<td class="num">{sum(c.values())}</td></tr>')
ivs_total = sum(len(p.get("ivs", {})) for p in ps)
note_html = "".join(f"<li>{html.escape(n.lstrip('- '))}</li>" for n in notes if n.strip())

page = f"""<meta charset="utf-8">
<title>打字島選文審稿</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap">
<style>
/* Layout: 頂部摘要＋待確認清單，下方依類別分節、節內依三階分組；文章用注音粉圓，跟遊戲畫面一致 */
@font-face {{ font-family: 'Bpmf Huninn'; src: url('fonts/bpmf-huninn-typing.woff2') format('woff2'); font-display: swap; }}
:root {{ --bg:#e8edf3; --paper:#f8fafc; --fg:#1d2733; --muted:#4a5868; --line:#c9d3df; --thead:#1f3a5f;
  --chip:#dde6f0; --mark:#fff1b8; --t1:#2c8a6e; --t2:#2f6db5; --t3:#7a4fb0; --warn:#8a3f0c; --warn-bg:#fbeadc; }}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg:#1a222c; --paper:#222c38; --fg:#e4eaf1; --muted:#aab6c4;
  --line:#3a4757; --thead:#2c4d78; --chip:#2e3b4b; --mark:#5a4a12; --warn:#f2b483; --warn-bg:#3a2a1e; color-scheme:dark; }} }}
:root[data-theme="dark"] {{ --bg:#1a222c; --paper:#222c38; --fg:#e4eaf1; --muted:#aab6c4; --line:#3a4757; --thead:#2c4d78;
  --chip:#2e3b4b; --mark:#5a4a12; --warn:#f2b483; --warn-bg:#3a2a1e; color-scheme:dark; }}
body {{ background:var(--bg); color:var(--fg); font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif; line-height:1.7; }}
.wrap {{ max-width:980px; margin:0 auto; padding-block:24px 60px; padding-left:max(16px,env(safe-area-inset-left,0px));
  padding-right:max(16px,env(safe-area-inset-right,0px)); display:flex; flex-direction:column; gap:18px; }}
h1 {{ margin:0; font-size:1.7rem; text-wrap:balance; }}
.lead {{ margin:.2rem 0 0; color:var(--muted); }}
section.box, section.cat {{ background:var(--paper); border:1px solid var(--line); border-radius:6px; overflow:hidden; }}
section > h2 {{ margin:0; padding:8px 14px; background:var(--thead); color:#fff; font-size:1rem; }}
.in {{ padding:10px 14px 14px; min-width:0; }}
.tbl {{ overflow-x:auto; }}
table {{ border-collapse:collapse; width:100%; font-size:.92rem; }}
th {{ background:var(--thead); color:#fff; text-align:left; padding:5px 9px; font-weight:500; }}
td {{ padding:5px 9px; border-bottom:1px solid var(--line); }}
.num {{ text-align:right; font-variant-numeric:tabular-nums; }}
.warn {{ background:var(--warn-bg); color:var(--warn); }}
.warn li {{ margin:.3rem 0; }}
.cards {{ padding:4px 14px 14px; display:flex; flex-direction:column; gap:10px; }}
h3.tier {{ display:flex; align-items:baseline; gap:10px; margin:12px 0 0; font-size:1rem; }}
.gr {{ color:#fff; font-size:.85rem; padding:1px 9px; border-radius:4px; }}
.g-t1 {{ background:var(--t1); }} .g-t2 {{ background:var(--t2); }} .g-t3 {{ background:var(--t3); }}
.p {{ border:1px solid var(--line); border-radius:6px; padding:8px 12px; background:var(--bg); }}
.p header {{ display:flex; flex-wrap:wrap; align-items:baseline; gap:8px; }}
.p h4 {{ margin:0; font-size:1rem; }}
.meta {{ color:var(--muted); font-size:.82rem; }}
.p .meta {{ margin-left:auto; }}
.t {{ margin:.4rem 0 0; font-size:26px; line-height:1.9; font-family:'Bpmf Huninn','Noto Sans TC',sans-serif; letter-spacing:.02em; }}
.gloss {{ margin:.2rem 0 0; color:var(--muted); font-size:.9rem; }}
mark {{ background:var(--mark); color:inherit; border-radius:3px; }}
</style>
<div class="wrap">
<header><h1>打字島：中打選文審稿</h1>
<p class="lead">共 {len(ps)} 篇，照遊戲裡的樣子用注音字型顯示；<mark>黃底</mark>的字是我指定了非預設讀音的破音字（共 {ivs_total} 處，滑鼠停上去看讀音）。要換掉的篇目回覆編號（例如 song-1-04）就好。</p></header>
<section class="box"><h2>篇數分布</h2><div class="in"><div class="tbl"><table>
<tr><th>類別</th>{''.join(f'<th class="num">{v}</th>' for v in TIERS.values())}<th class="num">合計</th></tr>
{''.join(summary)}</table></div></div></section>
<section class="box"><h2>要請你決定的地方</h2><div class="in warn"><ol>{note_html}</ol></div></section>
{''.join(sections)}
</div>
"""
Path(sys.argv[1]).write_text(page, encoding="utf-8")
print("寫出", sys.argv[1], len(ps), "篇")
