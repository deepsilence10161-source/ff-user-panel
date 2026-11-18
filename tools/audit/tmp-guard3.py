BS = chr(92)
DQ = chr(34)
SQ = chr(39)
for p in ['screens/rank.js', 'js/match-result-detail.js']:
    s = open(p, encoding='utf-8').read()
    add = ' onload=' + DQ + 'if(!this.naturalWidth)this.style.display=' + BS + SQ + 'none' + BS + SQ + DQ
    out = []
    i = 0
    cnt = 0
    while True:
        j = s.find('onerror=', i)
        if j < 0:
            out.append(s[i:])
            break
        close = s.find(DQ, j + 9)
        if close < 0:
            out.append(s[i:])
            break
        end = close + 1
        seg = s[j:end]
        if 'onload=' not in s[end:end + 10]:
            seg = seg + add
            cnt += 1
        out.append(s[i:j])
        out.append(seg)
        i = end
    open(p, 'w', encoding='utf-8').write(''.join(out))
    print(p, 'guarded', cnt)
