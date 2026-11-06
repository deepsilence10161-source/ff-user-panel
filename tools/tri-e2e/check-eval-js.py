#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Harness ke JS strings ka syntax check (fast, 1 second).

Kyun (2026-10-17): `host_driver.py` me page.evaluate ke andar likhe JS me
Python ki escape-galti se ek ASLI newline ghus gaya tha — nateeja: 30-minute
TRI run me H15 "SyntaxError: Invalid or unexpected token" se fail hua aur
asli wajah chhupi rahi. Ye script wahi class pehle hi pakad leti hai:
har evaluate(...) string ko nikaal kar `node --check` se guzarti hai.

RUN: python3 tools/tri-e2e/check-eval-js.py     (exit 0 = saaf, 1 = kharab)
"""
import ast, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, "host_driver.py")

def _newline_in_string(js: str):
    """Single/double quoted string ke andar raw newline dhundo (JS me illegal).
    Backtick (template) aur comment ignore — sirf wahi bug class pakadni hai."""
    q = None
    i = 0
    n = len(js)
    while i < n:
        c = js[i]
        if q:
            if c == "\\":
                i += 2
                continue
            if c == q:
                q = None
            elif c == "\n":
                return i
            i += 1
            continue
        if c in ("'", '"'):
            q = c
        i += 1
    return None


def main() -> int:
    src = open(TARGET, encoding="utf-8").read()
    tree = ast.parse(src)
    checked = bad = 0
    for node in ast.walk(tree):
        if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "evaluate"):
            continue
        for a in node.args:
            if not (isinstance(a, ast.Constant) and isinstance(a.value, str) and len(a.value) > 30):
                continue
            checked += 1
            # 1) node ke bina bhi chalne wala pakka check: single/double quoted
            #    JS string ke andar ASLI newline (JS me ye illegal hai) — yahi
            #    wo bug tha jo Python escape se aaya tha.
            bad_lit = _newline_in_string(a.value)
            if bad_lit:
                bad += 1
                print(f"❌ line {node.lineno}: string literal ke andar asli newline "
                      f"(~{bad_lit} akshar par) — Python escape ne JS tod diya")
                continue
            if not shutil.which("node"):
                continue
            with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
                f.write(a.value)
                path = f.name
            r = subprocess.run(["node", "--check", path], capture_output=True, text=True)
            os.unlink(path)
            if r.returncode:
                bad += 1
                print(f"❌ line {node.lineno}: " + " | ".join(r.stderr.strip().splitlines()[:3]))
                print("   (Python escape ne JS tod diya — `\\n`/`\\u000a` ki jagah "
                      "String.fromCharCode(10) jaisa escape-free likho)")
    print(f"evaluate strings check: {checked} dekhe, {bad} kharab")
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main())
