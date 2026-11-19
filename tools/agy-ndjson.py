"""把純文字提示詞包成 agy stream-json 輸入的一行 NDJSON。
格式（2026-11-19 試出來的）：{"event":"user","message":{"content":"…"}}；text／prompt 欄位無效。
用法：python to_ndjson.py <txt> <out.ndjson>"""
import json, sys
text = open(sys.argv[1], encoding="utf-8").read()
msg = {"event": "user", "message": {"content": text}}
open(sys.argv[2], "w", encoding="utf-8").write(json.dumps(msg, ensure_ascii=False) + "\n")
