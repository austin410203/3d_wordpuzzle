import random, sys
from soko import solve
best=None
random.seed(int(sys.argv[1]) if len(sys.argv)>1 else 7)
for it in range(600):
    W,H=10,7
    g=[['#']*W for _ in range(H)]
    for r in range(1,H-1):
        for c in range(1,W-1):
            g[r][c]='#' if random.random()<0.22 else '.'
    g[H-2][2]='P'; g[H-2][1]='.'; g[H-2][3]='.'
    free=[(c,r) for r in range(1,H-1) for c in range(1,W-1) if g[r][c]=='.']
    random.shuffle(free)
    if len(free)<8: continue
    for (c,r) in free[:2]: g[r][c]='B'
    for (c,r) in free[2:4]: g[r][c]='_'
    rows=[''.join(x) for x in g]
    res=solve(rows,'plates',60000)
    if res and (best is None or res[0]>best[0]):
        best=(res[0],rows)
print(best[0]); print('\n'.join(best[1]))
