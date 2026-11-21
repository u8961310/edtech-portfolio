"""把畫畫島某一關給 Gemini 的提示詞組成一個純文字檔：共用提示詞＋本關設定＋設計規範＋場景範本。

用法（repo 根目錄）：python tools/build-art-island-prompt.py <關卡代號，例 unit24> <輸出檔>
來源：docs/plans/art-island-gemini-prompt.md（「## 共用提示詞」與「### <代號>」下的第一個 ``` 區塊）、
      .interface-design/art-island-system.md、assets/art/demo.html
"""
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
md = (root / "docs/plans/art-island-gemini-prompt.md").read_text(encoding="utf-8")
unit, out = sys.argv[1], Path(sys.argv[2])


def block(after):
    m = re.search(re.escape(after) + r"(?![0-9]).*?```\n(.*?)\n```", md, re.S)   # unit2 不能比對到 unit24
    if not m:
        sys.exit(f"找不到區塊：{after}")
    return m.group(1)


base = block("## 共用提示詞")
unit_part = block(f"### {unit}")
system = (root / ".interface-design/art-island-system.md").read_text(encoding="utf-8")
demo = (root / "assets/art/demo.html").read_text(encoding="utf-8")
text = (base + "\n\n" + unit_part +
        "\n\n=== 附件 1：設計規範 art-island-system.md ===\n" + system +
        "\n\n=== 附件 2：場景範本 demo.html（能動的最小範本，路徑是 assets/art/ 底下的相對路徑；你的檔案在 units/ 底下，路徑照骨架） ===\n" + demo + "\n")
out.write_text(text, encoding="utf-8")
print(unit, "字數", len(text))
