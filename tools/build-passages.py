"""把 unit23 打字擂台的選文原稿（passages-src.json）轉成遊戲用的 passages.js。

做三件事：
1. 每個國字查注音粉圓的讀音表，產生逐字注音（給「第 2 層提示：注音拆成按鍵」用）
2. 破音字：原稿在字後面寫 [n] 指定第 n 個讀音，例如「樣子[2]」的「子」唸輕聲。
   n > 1 的字會記進 ivs，遊戲顯示時在字後補上異體字選擇器 U+E01E0+(n-1)，
   注音粉圓就會畫出那個讀音（第 1 讀音不用補）
3. 印審稿報表：所有「有多個讀音但原稿沒指定」的字都列出來，確認預設讀音對不對

讀音表來源：ButTaiwan/bpmfvs 的 phonetic/phonic_table_Z.txt（跟字型的破音順序一致，不進 repo）
    https://raw.githubusercontent.com/ButTaiwan/bpmfvs/master/phonetic/phonic_table_Z.txt

怎麼跑（repo 根目錄）：
    python tools/build-passages.py <phonic_table_Z.txt> units/unit23-typing-duel
讀 <單元>/passages-src.json，寫 <單元>/passages.js。改了原稿就要重跑，再重跑 subset-bpmf-font.py。
"""
import json
import re
import sys
from pathlib import Path

table_path, unit_dir = Path(sys.argv[1]), Path(sys.argv[2])
src = json.loads((unit_dir / "passages-src.json").read_text(encoding="utf-8"))

readings = {}
for line in table_path.read_text(encoding="utf-8").splitlines():
    cols = line.split("\t")
    if len(cols) >= 4:
        readings[cols[0]] = cols[3:]

MARK = re.compile(r"\[(\d+)\]")
errors, review = [], []
out = []

for p in src["passages"]:
    raw = p["text"]
    text, zhuyin, ivs = [], [], {}
    i = 0
    while i < len(raw):
        ch = raw[i]
        i += 1
        n = 1
        m = MARK.match(raw, i)
        if m:
            n = int(m.group(1))
            i = m.end()
        idx = len(text)
        text.append(ch)
        if p["lang"] != "zh" or ch not in readings:
            zhuyin.append("")
            if p["lang"] == "zh" and "一" <= ch <= "鿿":
                errors.append(f"{p['id']}：「{ch}」不在讀音表")
            continue
        rs = readings[ch]
        if n > len(rs):
            errors.append(f"{p['id']}：「{ch}」只有 {len(rs)} 個讀音，原稿寫了 [{n}]")
            n = 1
        zhuyin.append(rs[n - 1])
        if n > 1:
            ivs[idx] = n
        if len(rs) > 1:
            ctx = "".join(text[max(0, idx - 3):idx]) + f"【{ch}】" + MARK.sub("", raw[i:i + 6])[:3]
            tag = "已指定" if m else "預設"
            review.append(f"{p['id']}\t{ctx}\t{tag}：{rs[n - 1]}\t全部讀音：{' / '.join(f'{k + 1}.{r}' for k, r in enumerate(rs))}")
    item = {k: p[k] for k in ("id", "lang", "grade", "domain", "curriculum", "source", "title")}
    # 選填欄位（打字島 2026-11-20 加）：作者、白話一句
    item.update({k: p[k] for k in ("author", "gloss") if k in p})
    item["text"] = "".join(text)
    if p["lang"] == "zh":
        item["zhuyin"] = zhuyin
        item["ivs"] = ivs
    out.append(item)

if errors:
    print("❌ 錯誤：")
    print("\n".join(errors))
    sys.exit(1)

js = ("// 自動產生，不要手改：改 passages-src.json 後重跑 tools/build-passages.py\n"
      "// 欄位說明見 docs/specs/unit23-duel-protocol.md「選文格式」\n"
      "window.PASSAGES = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n")
(unit_dir / "passages.js").write_text(js, encoding="utf-8")

print(f"✅ {len(out)} 篇 → {unit_dir / 'passages.js'}")
for p in out:
    print(f"  {p['id']}\t{p['lang']}\t{p['grade']}\t{p['domain']}\t{len(p['text'])} 字\t{p['title']}")
print(f"\n破音字審稿（{len(review)} 處，「預設」的要確認讀音對不對，不對就在原稿字後加 [n]）：")
print("\n".join(review))
