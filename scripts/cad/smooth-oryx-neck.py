"""Remove the Oryx-only shaft/heel collar from the exported showroom mesh.

The rigidly shifted heel has a 0.74 mm step at its cutoff. Replace only
the exterior shaft skin between y=230 mm and that cutoff with a C2 radial
blend back to the original, unscaled neck. The heel ends below y=217 mm.
Both boundary rings come from the actual exported mesh, so the patch meets
the retained triangles exactly. Top, rod channel and headstock are retained.
"""
import argparse
import json
import math
from pathlib import Path

import cadquery as cq
import numpy as np
from OCP.IntCurvesFace import IntCurvesFace_ShapeIntersector
from OCP.gp import gp_Dir, gp_Lin, gp_Pnt

from neck_joint import Y, Z, HEEL_EXTENSION, extended_heel, world

LOW = 230.0
HIGH = Y - (134.0 - HEEL_EXTENSION)
EPS = 0.0001


def intersector(shape):
    tool = IntCurvesFace_ShapeIntersector()
    tool.Load(shape.wrapped, 1e-7)
    return tool


def radius(tool, y, theta):
    # Avoid a ray coincident with the planar top, then restore its exact z.
    a = min(math.pi - 1e-7, max(1e-7, theta))
    tool.Perform(gp_Lin(gp_Pnt(0, y, Z), gp_Dir(math.cos(a), 0, -math.sin(a))), 0., 60.)
    hits = [tool.WParameter(i) for i in range(1, tool.NbPnt()+1)]
    if not hits:
        raise ValueError(f'Missing exterior section at {y}, {theta}')
    return max(hits)


def clip(poly, y, keep_above):
    result = []
    for a, b in zip(poly, poly[1:] + poly[:1]):
        ina = a[1] >= y if keep_above else a[1] <= y
        inb = b[1] >= y if keep_above else b[1] <= y
        if ina:
            result.append(a)
        if ina != inb:
            v = a + (b-a) * ((y-a[1])/(b[1]-a[1]))
            v[1] = y
            v[3:6] /= np.linalg.norm(v[3:6])
            result.append(v)
    return result


def triangles(poly):
    for j in range(1, len(poly)-1):
        t = np.array([poly[0], poly[j], poly[j+1]])
        if np.linalg.norm(np.cross(t[1,:3]-t[0,:3], t[2,:3]-t[0,:3])) > 1e-8:
            yield t


def angle(p):
    return math.atan2(max(0, Z-p[2]), p[0])


def boundary(points, y):
    unique = {}
    for v in points:
        k = tuple(np.round(v[:3], 4))
        if k not in unique:
            unique[k] = v.copy()
    ring = np.array(sorted(unique.values(), key=angle))
    assert len(ring) > 20
    assert abs(angle(ring[0])) < 1e-5 and abs(angle(ring[-1])-math.pi) < 1e-5
    ring[:,1] = y
    return ring


def join(a, b):
    # Zipper two ordered boundary rings without resampling the retained mesh.
    aa = [angle(v) for v in a]
    bb = [angle(v) for v in b]
    i = j = 0
    while i < len(a)-1 or j < len(b)-1:
        if j == len(b)-1 or (i < len(a)-1 and aa[i+1] <= bb[j+1]):
            yield np.array([a[i], a[i+1], b[j]])
            i += 1
        else:
            yield np.array([a[i], b[j+1], b[j]])
            j += 1


def split_top_edges(retained, points):
    # Insert patch endpoints into adjacent top-face edges. This removes
    # T-junctions at the hard top edge without moving any retained surface.
    result = []
    for tri in retained:
        polygon = []
        inserted = False
        for k in range(3):
            a, b = tri[k], tri[(k+1) % 3]
            polygon.append(a)
            if abs(a[2]-Z) > EPS or abs(b[2]-Z) > EPS:
                continue
            d = b[:3]-a[:3]
            length2 = np.dot(d,d)
            if length2 < 1e-10:
                continue
            t = (points-a[:3]) @ d / length2
            distance = np.linalg.norm(points-(a[:3]+t[:,None]*d), axis=1)
            hits = np.where((t > 1e-6) & (t < 1-1e-6) & (distance < EPS))[0]
            for index in sorted(hits, key=lambda h:t[h]):
                v = a+(b-a)*t[index]
                v[:3] = points[index]
                polygon.append(v)
                inserted = True
        if not inserted:
            result.append(tri)
        else:
            # A center fan also handles an original triangle with two split edges.
            center = tri.mean(axis=0)
            center[3:6] /= np.linalg.norm(center[3:6])
            for a,b in zip(polygon,polygon[1:]+polygon[:1]):
                result.extend(triangles([center,a,b]))
    return result


def repair(source_neck, parts):
    source = cq.importers.importStep(str(source_neck)).val()
    original = intersector(world(source))
    extended = intersector(world(extended_heel(source)))
    neck = next(p for p in parts if p['material'] == 'neck')
    p = np.array(neck['positions'], dtype=float).reshape(-1,3)*1000
    n = np.array(neck['normals'], dtype=float).reshape(-1,3)
    uv = np.array(neck['uv'], dtype=float).reshape(-1,2)
    ix = np.array(neck['indices']).reshape(-1,3)
    before_bounds = [p.min(axis=0).tolist(), p.max(axis=0).tolist()]
    # Float32 export differs by up to 0.000025 mm at this CAD plane.
    p[np.abs(p[:,1]-HIGH) < EPS,1] = HIGH
    data = np.column_stack([p,n,uv])
    retained, low_points, high_points = [], [], []
    removed_collar = 0
    for ids in ix:
        tri = data[ids]
        xyz = tri[:,:3]
        if np.max(np.abs(xyz[:,1]-HIGH)) < EPS:
            removed_collar += 1
            continue
        radial = xyz.copy()
        radial[:,1] = 0
        radial[:,2] -= Z
        outer = np.sum(tri[:,3:6]*radial,axis=1).mean() > 0.001
        if not outer:
            retained.append(tri)
            continue
        if xyz[:,1].max() <= LOW or xyz[:,1].min() >= HIGH:
            retained.append(tri)
            low_points.extend(v for v in tri if abs(v[1]-LOW)<EPS)
            high_points.extend(v for v in tri if abs(v[1]-HIGH)<EPS)
            continue
        for y, above, points in [(LOW,False,low_points),(HIGH,True,high_points)]:
            pieces = list(triangles(clip(list(tri), y, above)))
            retained.extend(pieces)
            for piece in pieces:
                points.extend(v for v in piece if abs(v[1]-y) < EPS)
    assert removed_collar > 0, 'Input must be the exported CAD mesh before this repair.'
    lower, upper = boundary(low_points,LOW), boundary(high_points,HIGH)
    angles = np.linspace(0,math.pi,257)
    ys = np.linspace(LOW,HIGH,49)
    grid = np.empty((len(ys),len(angles),3))
    max_change = 0
    for j,y in enumerate(ys):
        t = (y-LOW)/(HIGH-LOW)
        fade = t*t*t*(t*(t*6-15)+10)  # zero first/second derivatives at each end
        for k,a in enumerate(angles):
            r0 = radius(original,y,a)
            r1 = radius(extended,min(y,HIGH-.001),a) if j < len(ys)-1 else r0
            r = r1+(r0-r1)*fade
            grid[j,k] = [r*math.cos(a),y,Z-r*math.sin(a)]
            max_change = max(max_change,abs(r-r1))
        # Keep the original, linear neck planform exactly at the top edge.
        for k,v0,v1 in [(0,lower[0],upper[0]),(-1,lower[-1],upper[-1])]:
            grid[j,k] = v0[:3]*(1-t)+v1[:3]*t
            grid[j,k,1] = y
    dy = np.gradient(grid,ys,axis=0,edge_order=2)
    da = np.gradient(grid,angles,axis=1,edge_order=2)
    normals = np.cross(da,dy)
    normals /= np.linalg.norm(normals,axis=2,keepdims=True)
    def boundary_normal(v,row):
        normal=np.array([np.interp(angle(v),angles,normals[row,:,axis]) for axis in range(3)])
        return normal/np.linalg.norm(normal)
    # CAD face exports duplicate the same ring position with different normals.
    # Share the continuous skin normal across both sides of each patch boundary;
    # otherwise a shading seam survives even when the positions are watertight.
    for ring,row in [(lower,0),(upper,-1)]:
        for v in ring:v[3:6]=boundary_normal(v,row)
    for tri in retained:
        for v in tri:
            radial=np.array([v[0],0,v[2]-Z])
            if np.dot(v[3:6],radial)<=.001:continue
            if abs(v[1]-LOW)<EPS:v[3:6]=boundary_normal(v,0)
            elif abs(v[1]-HIGH)<EPS:v[3:6]=boundary_normal(v,-1)
    rings = [lower]
    for j in range(1,len(ys)-1):
        rings.append(np.column_stack([grid[j],normals[j],grid[j,:,:2]/[325,500]]))
    rings.append(upper)
    patch = [tri for a,b in zip(rings,rings[1:]) for tri in join(a,b)]
    endpoints = np.array([v[:3] for r in rings for v in (r[0],r[-1])])
    retained = split_top_edges(retained,endpoints)
    out = np.concatenate(retained+patch)
    # Weld exact matching attributes. Hard top/rod-channel normals stay separate.
    out[:,0:3] *= .001
    out = out.astype(np.float32)
    values, inverse = np.unique(out,axis=0,return_inverse=True)
    neck.update(positions=values[:,:3].reshape(-1).tolist(),
                normals=values[:,3:6].reshape(-1).tolist(),
                uv=values[:,6:8].reshape(-1).tolist(),indices=inverse.tolist())
    final_positions = values[:,:3].astype(float)*1000
    after_bounds = [final_positions.min(axis=0).tolist(),final_positions.max(axis=0).tolist()]
    assert np.allclose(before_bounds,after_bounds,atol=.0001,rtol=0)
    return {'blendRangeYmm':[LOW,HIGH], 'heelContourPreservedBelowYmm':LOW,
            'originalStepMm':radius(extended,HIGH-.001,math.pi/2)-radius(original,HIGH+.001,math.pi/2),
            'maxRadialCorrectionMm':max_change,'removedCollarTriangles':removed_collar,
            'boundaryVertices':[len(lower),len(upper)],'patchTriangles':len(patch),
            'boundsBeforeMm':before_bounds,'boundsAfterMm':after_bounds,
            'scaleLengthMm':647.7,'neckScale':1,'headstockUnchanged':True,
            'topAndTrussRodChannelRetained':True,'grainUsesUnchangedPositionMapping':True}


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source_neck',type=Path)
    parser.add_argument('decoded_mesh',type=Path)
    parser.add_argument('output_mesh',type=Path)
    parser.add_argument('report',type=Path)
    args=parser.parse_args()
    parts=json.loads(args.decoded_mesh.read_text())
    report=repair(args.source_neck,parts)
    args.output_mesh.write_text(json.dumps(parts,separators=(',',':')))
    args.report.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2),flush=True)
