#!/bin/bash
# wipe-guard: local source vs srcfresh(pub-source-of-truth) drift check.
# Wipe-recovery ke baad ALWAYS run karo; DRIFT lines = restore karo srcfresh se.
set -u
SRC=/home/user/.tmp/srcfresh
LOC=/home/user/ff-user-panel
n=0
for d in assets js core screens features; do
  while IFS= read -r line; do echo "DRIFT: $line"; n=$((n+1)); done < <(diff -r --brief "$SRC/$d" "$LOC/$d" 2>/dev/null | grep -v "^Only in $LOC" | head -40)
done
for f in index.html styles.css sw.js manifest.json screen-e2e.html _d103.html; do
  cmp -s "$SRC/$f" "$LOC/$f" || { echo "DRIFT: $f"; n=$((n+1)); }
done
echo "wipe-guard drift count: $n"
