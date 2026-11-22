"""從關卡 HTML 原始碼抽出所有含中文的字串常值與標籤內文（不含 <style>、註解），每句一行去重。
不開瀏覽器、抓得比較寬（含 3–4 年級不加注音的字），給 tools/zy-moe-check.py 檢查。

用法：python tools/zy-extract-strings.py <units/.../index.html> <out.txt>
"""
import re
import sys
from pathlib import Path

if len(sys.argv) < 3:
    sys.exit(__doc__)
t = Path(sys.argv[1]).read_text(encoding="utf-8")
t = re.sub(r"<style.*?</style>", "", t, flags=re.S)
t = re.sub(r"/\*.*?\*/", "", t, flags=re.S)
t = re.sub(r"(?m)^\s*//.*$|\s//\s.*$", "", t)
t = re.sub(r"<!--.*?-->", "", t, flags=re.S)
seen, out = set(), []
for m in re.finditer(r"'([^'\n]*)'|\"([^\"\n]*)\"|`([^`]*)`|>([^<>]+)<", t):
    s = next(g for g in m.groups() if g is not None)
    for part in re.split(r"<[^>]+>", s):
        part = part.strip()
        if re.search(r"[一-鿿]", part) and part not in seen:
            seen.add(part)
            out.append(part)
Path(sys.argv[2]).write_text("\n".join(out) + "\n", encoding="utf-8", newline="\n")
print(len(out), "句")
