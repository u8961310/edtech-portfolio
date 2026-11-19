"""把 unit23 給 Gemini 的提示詞組成一個純文字檔：提示詞區塊＋B 版設計稿全文。

用法（repo 根目錄）：python tools/build-unit23-prompt.py <輸出檔>
提示詞來源：docs/plans/unit23-gemini-prompt.md 第一個 ``` 區塊；設計稿：docs/plans/mockups/unit23-mockup-b.html
"""
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
md = (root / "docs/plans/unit23-gemini-prompt.md").read_text(encoding="utf-8")
prompt = re.search(r"## 提示詞\s*```\n(.*?)\n```", md, re.S).group(1)
mock = (root / "docs/plans/mockups/unit23-mockup-b.html").read_text(encoding="utf-8")
text = prompt + "\n\n" + mock + "\n"
Path(sys.argv[1]).write_text(text, encoding="utf-8")
print("字數", len(text), "（提示詞", len(prompt), "＋設計稿", len(mock), "）")
