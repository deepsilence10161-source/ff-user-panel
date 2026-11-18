BS = chr(92)
DQ = chr(34)
for p in ['screens/rank.js', 'js/match-result-detail.js']:
    s = open(p, encoding='utf-8').read()
    add = ' onload=' + BS + DQ + 'if(!this.naturalWidth)this.style.display=' + BS + BS + BS + chr(39) + 'none' + BS + BS + BS + chr(39) + BS + DQ
    out = []
    i = 0
    cnt = 0
    while True:
        j = s.find('onerror=', i)
        if j < 0:
            out.append(s[i:])
            break
        close = s.find(BS + DQ, j + 8)
        if close < 0:
            out.append(s[i:])
            break
        end = close + 2
        seg = s[j:end]
        if 'onload=' not in s[end:end + 12]:
            seg = seg + add
            cnt += 1
        out.append(s[i:j])
        out.append(seg)
        i = end
    open(p, 'w', encoding='utf-8').write(''.join(out))
    print(p, 'guarded', cnt)
