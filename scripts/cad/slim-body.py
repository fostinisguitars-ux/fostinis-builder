"""Remove an internal slice, preserving the carved top and rear contours.

Usage: python scripts/cad/slim-body.py /working/cad-review
The supplied originals and the output of fit-neck.py must be in that directory.
All lengths are millimeters. Never scale the guitar or the neck.
"""
from pathlib import Path
import sys, json, shutil
import cadquery as cq
from OCP.ShapeFix import ShapeFix_Shape
from neck_joint import neck_pocket

root = Path(sys.argv[1]).resolve()
source = root / 'fitted'
out = root / 'slimmed'
out.mkdir(exist_ok=True)
spec = json.loads((Path(__file__).parent / 'body-construction.json').read_text())

def slab(low, high):
    return cq.Workplane('XY').box(1100, 1800, high-low, centered=(True, True, False)).translate((0, 200, low)).val()

def repair(shape):
    fixer = ShapeFix_Shape(shape.wrapped)
    fixer.SetPrecision(.01)
    fixer.SetMaxTolerance(.1)
    fixer.Perform()
    return cq.Shape.cast(fixer.Shape())

# Reapply the same unscaled neck envelope after closing the internal slice.
neck = cq.importers.importStep(str(root / 'matadaur-sphyx-neck.step')).val()
pocket = neck_pocket(neck)
necks = {}
for name in ('shared_neck', 'oryx_neck'):
    shutil.copyfile(source / (name+'.step'), out / (name+'.step'))
    necks[name] = cq.importers.importStep(str(source / (name+'.step'))).val()

report = {'construction': spec, 'method': 'remove internal slice and translate rear section; no scaling', 'bodies': {}}
if '--resume' in sys.argv and (out/'construction-report.json').exists():
    previous=json.loads((out/'construction-report.json').read_text())
    if previous['construction']==spec:report=previous
for path in sorted(source.glob('*.step')):
    if 'neck' in path.name:
        continue
    if path.stem in report['bodies'] and (out/path.name).exists():
        continue
    model = path.stem.split('_')[0]
    rim = spec['rimZMm'][model]
    cap_base = rim-spec['exposedMapleCapMm']
    new_back = cap_base-spec['bodyWoodThicknessMm']
    removed_depth = new_back-spec['originalBackZMm']
    fitted_reference = cq.importers.importStep(str(path)).val()
    # Retain the fitted cap exactly. The rear section comes from the original:
    # splitting a previously enlarged pocket can create sub-tolerance sliver
    # wires on the new join face. Recut that lower pocket after joining.
    original = cq.importers.importStep(str(root / (path.stem+'.STEP'))).val()
    original = original.translate((20.8503708884,21.588992035,0) if model=='matadaur' else (13.9326447681,0,0))
    cap = fitted_reference.intersect(slab(cap_base, 20), tol=.000001)
    rear = original.intersect(slab(-100, cap_base-removed_depth), tol=.000001).translate((0, 0, removed_depth))
    joined = repair(cap.fuse(rear, tol=.000001))
    body = repair(joined.cut(pocket, tol=.001))
    selected_neck = necks['oryx_neck' if model=='oryx' else 'shared_neck']
    intersection = body.intersect(selected_neck)
    remaining = intersection.Volume()
    relief = remaining
    if remaining>.1:
        # Moving the back toward the cap can bring the existing pocket wall
        # into the curved heel. Relieve the body to the actual unchanged neck.
        ib=intersection.BoundingBox()
        print(path.stem, 'heel relief bounds', [ib.xmin,ib.ymin,ib.zmin,ib.xmax,ib.ymax,ib.zmax], 'valid',intersection.isValid(),flush=True)
        body = repair(body.cut(selected_neck, tol=.000001))
        remaining = body.intersect(selected_neck).Volume()
    bb = body.BoundingBox()
    # Compare the retained front surfaces directly. Re-integrating trimmed
    # B-spline solids is less reliable than their unchanged surface geometry.
    def front_faces(shape):
        return [f for f in shape.Faces() if min(v.Center().z for v in f.Vertices())>=rim-.055]
    old_front, new_front = front_faces(fitted_reference), front_faces(body)
    old_area, new_area = sum(f.Area() for f in old_front), sum(f.Area() for f in new_front)
    area_difference = abs(new_area-old_area)
    print(path.stem, 'front surface area difference', area_difference, flush=True)
    assert body.isValid() and len(body.Solids())==1, (path.name, body.isValid(), len(body.Solids()))
    assert remaining < .1, (path.name, 'neck intersection', remaining)
    assert abs(bb.zmin-new_back) < .1, (path.name, bb.zmin, new_back)
    assert area_difference < .1, (path.name, 'front surfaces changed', area_difference)
    cq.exporters.export(body, str(out / path.name))
    report['bodies'][path.stem] = {
        'validSolid': True,
        'rimZMm': rim,
        'capBaseZMm': cap_base,
        'backZMm': new_back,
        'rearTranslationMm': removed_depth,
        'bodyWoodThicknessMm': cap_base-new_back,
        'exposedMapleCapMm': rim-cap_base,
        'totalSideThicknessMm': rim-new_back,
        'remainingNeckIntersectionMm3': round(remaining, 8),
        'additionalHeelReliefMm3': round(relief, 6),
        'frontSurfaceAreaDifferenceMm2': round(area_difference, 6),
        'capRetainedWithoutScaling': True,
        'neckScale': 1
    }
    print(path.stem, report['bodies'][path.stem], flush=True)
    (out/'construction-report.json').write_text(json.dumps(report, indent=2))
(out/'construction-report.json').write_text(json.dumps(report, indent=2))
