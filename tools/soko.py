# BFS sokoban with water sinking: '#'/'T' wall, 'B' boulder, '~' water (boulder sinks -> floor), 'G' goal cells, 'P' start, '_' plate
import sys
from collections import deque
def solve(rows, goal='reach', maxn=400000):
    H=len(rows); W=len(rows[0])
    walls=set(); water=set(); B=set(); G=set(); plates=set(); start=None
    for r,row in enumerate(rows):
        assert len(row)==W,(r,row,len(row),W)
        for c,ch in enumerate(row):
            if ch in '#T': walls.add((c,r))
            elif ch=='~': water.add((c,r))
            elif ch=='B': B.add((c,r))
            elif ch=='G': G.add((c,r))
            elif ch=='P': start=(c,r)
            elif ch=='_': plates.add((c,r))
            elif ch=='*': B.add((c,r)); plates.add((c,r))
    def inb(p): return 0<=p[0]<W and 0<=p[1]<H
    def reach(p,bs,fill):
        seen={p}; dq=[p]
        while dq:
            q=dq.pop()
            for d in ((1,0),(-1,0),(0,1),(0,-1)):
                n=(q[0]+d[0],q[1]+d[1])
                if not inb(n) or n in seen or n in walls or n in bs: continue
                if n in water and n not in fill: continue
                seen.add(n); dq.append(n)
        return seen
    s0=(frozenset(B),frozenset())
    def key(p,bs,fill):
        R=reach(p,bs,fill); return (min(R),bs,fill),R
    k,R=key(start,s0[0],s0[1])
    prev={k:None}; dq=deque([(k,R,0)])
    while dq:
        k,R,n=dq.popleft()
        _,bs,fill=k
        if goal=='reach' and R & G: 
            path=[];x=k
            while prev[x]: path.append(prev[x][1]); x=prev[x][0]
            return n,path[::-1],len(prev)
        if goal=='plates' and plates<=bs:
            path=[];x=k
            while prev[x]: path.append(prev[x][1]); x=prev[x][0]
            return n,path[::-1],len(prev)
        for b in bs:
            for d in ((1,0),(-1,0),(0,1),(0,-1)):
                pp=(b[0]-d[0],b[1]-d[1]); t=(b[0]+d[0],b[1]+d[1])
                if pp not in R or not inb(t) or t in walls or t in bs: continue
                nb=set(bs); nb.discard(b); nf=set(fill)
                if t in water and t not in fill: nf.add(t)
                else: nb.add(t)
                nk,nR=key(b,frozenset(nb),frozenset(nf))
                if nk in prev: continue
                prev[nk]=(k,(b,d)); dq.append((nk,nR,n+1))
                if len(prev)>maxn: return None
    return None
if __name__=='__main__':
    import json
    rows=json.load(open(sys.argv[1]))
    print(solve(rows['rows'],rows.get('goal','reach')))
