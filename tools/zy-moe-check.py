"""注音句破音字自動比對（萌典＝教育部《重編國語辭典修訂本》資料）。

用法：python tools/zy-moe-check.py <sentences.txt>
  sentences.txt 每行一句，可用 tools/zy-extract-strings.py 或 tools/zy-extract-dom.py 產生。

做法：每句切出 2、3 字詞查萌典；詞的讀音裡某字的音 ≠ 該字單字第一個讀音（≈ Bpmf Huninn 字型預設）就列出，
人工再決定加 IVS（U+E01E1＝第 2 個讀音字形）或改字。可疑字用 tools/zy-render.py 放大渲染目視。

IVS：字後面跟著異體字選擇符（U+E0100–U+E01EF）時，視為已手動選過讀音，不再列出那個字，
也不會把詞切開（例：蘿蔔 的 蔔 補了 E01E1，整個詞照常查、蔔 跳過）。

快取：tools/.zy-cache/moe_cache.json（已 gitignore），同一個詞只查一次。
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

CACHE = Path(__file__).resolve().parent / ".zy-cache" / "moe_cache.json"
CACHE.parent.mkdir(exist_ok=True)
cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}

HAN = "一-鿿"
IVS = "\U000E0100-\U000E01EF"
RUN = re.compile(f"(?:[{HAN}][{IVS}]?)+")
CHAR = re.compile(f"([{HAN}])([{IVS}]?)")


def readings(w):
    if w in cache:
        return cache[w]
    url = "https://www.moedict.tw/a/" + urllib.parse.quote(w) + ".json"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "zy-check"})
        with urllib.request.urlopen(req, timeout=15) as r:
            d = json.loads(r.read().decode("utf-8"))
        res = [h.get("b", "") for h in d.get("h", []) if h.get("b")]
    except Exception:
        res = []
    cache[w] = res
    time.sleep(0.05)
    return res


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    lines = [l.strip() for l in open(sys.argv[1], encoding="utf-8") if l.strip()]
    flags, skipped = {}, set()
    for line in lines:
        for run in RUN.findall(line):
            chars = CHAR.findall(run)  # [(字, IVS 或空字串)]
            for n in (2, 3):
                for i in range(len(chars) - n + 1):
                    part = chars[i:i + n]
                    w = "".join(c for c, _ in part)
                    rs = readings(w)
                    if not rs:
                        continue
                    syl = rs[0].split()
                    if len(syl) != n:
                        continue
                    for k, (ch, ivs) in enumerate(part):
                        base = readings(ch)
                        if not base or syl[k] == base[0].split()[0]:
                            continue
                        if ivs:
                            skipped.add(f"{w}（{ch}+U+{ord(ivs):X}）")
                            continue
                        flags.setdefault((w, rs[0]), set()).add(f"{ch}：辭典 {syl[k]}，單字預設 {base[0]}")
    CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    for (w, r), notes in sorted(flags.items()):
        hit = [l for l in lines if w in re.sub(f"[{IVS}]", "", l)][:2]
        print(f"{w}（{r}）  {'；'.join(sorted(notes))}\n    例：{' ／ '.join(hit)}")
    if skipped:
        print(f"\n已補 IVS、跳過：{'、'.join(sorted(skipped))}")
    print(f"\n{len(lines)} 句，{len(flags)} 個詞要人工看")


if __name__ == "__main__":
    main()
