"""Independent continuity and preservation checks on decoded, published glTF data."""
import json
import sys
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree

LOW, HIGH, TOP = 230., 289.327388272, 1.8625


def arrays(parts):
    part = next(p for p in parts if p['material']=='neck')
    return (np.array(part['positions']).reshape(-1,3)*1000,
            np.array(part['normals']).reshape(-1,3),
            np.array(part['indices']).reshape(-1,3))


def section(data,y):
    p,n,ix=data
    t=p[ix];ns=n[ix]
    crosses=(t[:,:,1].min(axis=1)<y)&(t[:,:,1].max(axis=1)>y)
    seg=[]
    for tri,norm in zip(t[crosses],ns[crosses]):
        hits=[]
        for i,j in [(0,1),(1,2),(2,0)]:
            if (tri[i,1]-y)*(tri[j,1]-y)<0:
                f=(y-tri[i,1])/(tri[j,1]-tri[i,1])
                point=tri[i]+(tri[j]-tri[i])*f
                normal=norm[i]+(norm[j]-norm[i])*f
                hits.append(np.r_[point[[0,2]]-[0,TOP],normal])
        if len(hits)==2:seg.append(hits)
    return np.array(seg)


def cross(a,b):
    return a[...,0]*b[...,1]-a[...,1]*b[...,0]


def rays(data,y):
    s=section(data,y);a=s[:,0,:2];v=s[:,1,:2]-a
    radii=[];normals=[]
    for theta in np.linspace(.002,np.pi-.002,181):
        d=np.array([np.cos(theta),-np.sin(theta)])
        den=cross(d,v)
        den=np.where(abs(den)<1e-12,np.nan,den)
        r=cross(a,v)/den;t=cross(a,d)/den
        valid=(r>0)&(t>=-1e-6)&(t<=1.000001)
        assert valid.any(),f'Open exterior at y={y}, angle={theta}'
        idx=np.argmax(np.where(valid,r,-np.inf))
        normal=s[idx,0,2:]+t[idx]*(s[idx,1,2:]-s[idx,0,2:])
        radii.append(r[idx]);normals.append(normal/np.linalg.norm(normal))
    return np.array(radii),np.array(normals)


def signatures(parts,selection):
    p,n,ix=arrays(parts)
    # Sets of complete triangles, independent of compression/reordering.
    result=set()
    for tri in ix[np.all(selection(p)[ix],axis=1)]:
        result.add(tuple(sorted(tuple(np.r_[p[i],n[i]]) for i in tri)))
    return result


def check(before,after):
    old,new=arrays(before),arrays(after)
    p,n,ix=new
    assert np.isfinite(p).all() and np.isfinite(n).all()
    assert np.max(abs(np.linalg.norm(n,axis=1)-1))<1e-5
    assert np.array_equal(old[0].min(axis=0),p.min(axis=0))
    assert np.array_equal(old[0].max(axis=0),p.max(axis=0))
    for region,select in [('heel',lambda p:p[:,1]<LOW-.001),
                          ('headstock',lambda p:p[:,1]>610)]:
        old_faces,new_faces=signatures(before,select),signatures(after,select)
        assert old_faces <= new_faces,region+' changed'
        # Splitting a long top-face edge may introduce coplanar top triangles
        # outside the band; every original heel/headstock triangle remains.
        for face in new_faces-old_faces:
            assert all(abs(v[2]-TOP)<.0001 and v[5]>.99999 for v in face)
    old_head=next(p for p in before if p['material']=='headstock_front')
    new_head=next(p for p in after if p['material']=='headstock_front')
    # Accessors may be reordered by the lossless encoder.
    def head_rows(part):
        return set(map(tuple,np.column_stack([np.array(part['positions']).reshape(-1,3),
                                             np.array(part['normals']).reshape(-1,3),
                                             np.array(part['uv']).reshape(-1,2)])))
    assert head_rows(old_head)==head_rows(new_head)

    # Position welding is for topology measurement, not an edit to the model.
    parent=np.arange(len(p))
    def root(i):
        while parent[i]!=i:
            parent[i]=parent[parent[i]];i=parent[i]
        return i
    for a,b in cKDTree(p).query_pairs(.0001):parent[root(a)]=root(b)
    ids=np.array([root(i) for i in range(len(p))])
    edges=np.sort(np.concatenate([ids[ix[:,[0,1]]],ids[ix[:,[1,2]]],ids[ix[:,[2,0]]]]),axis=1)
    edges,counts=np.unique(edges,axis=0,return_counts=True)
    ends=p[edges]
    region=(ends[:,:,1].min(axis=1)>LOW-.001)&(ends[:,:,1].max(axis=1)<HIGH+.001)
    assert np.all(counts[region]==2),'Open or nonmanifold edge in the repaired band'
    cross_norm=np.cross(p[ix[:,1]]-p[ix[:,0]],p[ix[:,2]]-p[ix[:,0]])
    center=p[ix].mean(axis=1)
    band=(center[:,1]>LOW)&(center[:,1]<HIGH)&(center[:,2]<TOP-.001)
    assert np.min(np.linalg.norm(cross_norm[band],axis=1))>1e-8
    assert np.all(np.sum(cross_norm[band]*n[ix[band]].mean(axis=1),axis=1)>0),'Flipped triangles'

    report={'boundaryChecks':[]}
    for y in [LOW,HIGH]:
        r0,n0=rays(new,y-.002);r1,n1=rays(new,y+.002)
        jump=float(np.max(abs(r1-r0)))
        angle=float(np.max(np.degrees(np.arccos(np.clip((n0*n1).sum(axis=1),-1,1)))))
        assert jump<.005,('surface step',y,jump)
        assert angle<.5,('normal seam',y,angle)
        report['boundaryChecks'].append({'yMm':y,'maxRadialDifferenceAcross4MicronsMm':jump,
                                         'maxNormalAngleDegrees':angle,'anglesChecked':181})
    a,_=rays(old,HIGH-.002);b,_=rays(old,HIGH+.002)
    report.update(originalStepMm=float(np.max(abs(a-b))),
                  openOrNonmanifoldEdgesInRepair=0,heelAndHeadstockTrianglesUnchanged=True,
                  overallDimensionsUnchanged=True,normalAndWindingChecksPassed=True)
    return report


if __name__=='__main__':
    before=json.loads(Path(sys.argv[1]).read_text())
    after=json.loads(Path(sys.argv[2]).read_text())
    report=check(before,after)
    print(json.dumps(report,indent=2))
    if len(sys.argv)>3:Path(sys.argv[3]).write_text(json.dumps(report,indent=2)+'\n')
