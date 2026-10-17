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
import ast, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, "host_driver.py")

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
