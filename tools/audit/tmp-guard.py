import sys
BS = chr(92)
DQ = chr(34)
SQ = chr(39)
old = 'onerror=' + BS + DQ + 'this.style.display=' + BS*3 + SQ + 'none' + BS*3 + SQ + BS + DQ
add = ' onload=' + BS + DQ + 'if(!this.naturalWidth)this.style.display=' + BS*3 + SQ + 'none' + BS*3 + SQ + BS + DQ
for p in ['screens/rank.js', 'js/match-result-detail.js']:
    s = open(p, encoding='utf-8').read()
    n = s.count(old)
    print(p, 'found', n)
    if n and 'onload=' + BS + DQ + 'if(!this.naturalWidth)' not in s:
        s = s.replace(old, old + add)
        open(p, 'w', encoding='utf-8').write(s)
        print(p, 'guarded')
