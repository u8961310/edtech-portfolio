"""從 agy stream-json 輸出取出回覆全文，拆出 ```html 區塊與自檢表。
用法：python extract.py <gen.jsonl> <輸出 html> <輸出自檢表.txt>"""
import json, re, sys
parts, result = [], None
for line in open(sys.argv[1], encoding="utf-8"):
    line = line.strip()
    if not line.startswith("{"):
        continue
    ev = json.loads(line)
    su = ev.get("step_update") or {}
    if su.get("step_type") == "agent_response" and su.get("text_delta"):
        parts.append(su["text_delta"])
    if ev.get("event") == "result":
        result = ev["result"]
text = "".join(parts)
if result:
    print("status", result.get("status"), "| 錯誤", result.get("error"), "|", result.get("duration_seconds"), "秒 |", result.get("usage"))
m = re.search(r"```html\s*\n(.*?)\n```", text, re.S)
if not m:
    print("找不到 ```html 區塊；回覆長度", len(text))
    open(sys.argv[3], "w", encoding="utf-8").write(text)
    sys.exit(1)
html = m.group(1)
open(sys.argv[2], "w", encoding="utf-8").write(html + "\n")
open(sys.argv[3], "w", encoding="utf-8").write(text[m.end():].strip() + "\n")
print("HTML", html.count("\n") + 1, "行", len(html), "字；結尾是 </html>：", html.rstrip().endswith("</html>"))
