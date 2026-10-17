"""Close the fretboard/pickup clearance without moving the nut or bridge."""
from pathlib import Path
import sys, json, shutil
import cadquery as cq
from OCP.ShapeFix import ShapeFix_Shape
from neck_joint import block, neck_pocket

root = Path(sys.argv[1]).resolve()
source, out = root/'slimmed', root/'aligned'
out.mkdir(exist_ok=True)
spec = json.loads((Path(__file__).parent/'assembly-layout.json').read_text())
construction = json.loads((source/'construction-report.json').read_text())
shift = spec['neckPickupY'] - spec['originalNeckPickupY']
original_neck = cq.importers.importStep(str(root/'matadaur-sphyx-neck.step')).val()
pocket = neck_pocket(original_neck)
necks = {}
for name in ('shared_neck','oryx_neck'):
    shutil.copyfile(source/(name+'.step'),out/(name+'.step'))
    necks[name] = cq.importers.importStep(str(source/(name+'.step'))).val()
shutil.copyfile(source/'construction-report.json',out/'construction-report.json')

def repair(shape):
    fixer=ShapeFix_Shape(shape.wrapped)
    fixer.SetPrecision(.00001); fixer.SetMaxTolerance(.001); fixer.Perform()
    return cq.Shape.cast(fixer.Shape()).clean()

report = {'layout': spec, 'neckPickupShiftMm': shift, 'scaleLengthMm':647.7,
          'neckTranslated':False, 'bridgeTranslated':False, 'bodies':{}}
for path in sorted(source.glob('*.step')):
    if 'neck' in path.name: continue
    model=path.stem.split('_')[0]
    original=cq.importers.importStep(str(root/(path.stem+'.STEP'))).val()
    original=original.translate((20.8503708884,21.588992035,0) if model=='matadaur' else (13.9326447681,0,0))
    # Extract the real CAD routing, including its rounded mounting ears.
    floors=[f for f in original.Faces() if f.geomType()=='PLANE'
            and abs(f.Center().z+41)<.001 and f.BoundingBox().ymin>50
            and f.BoundingBox().ymin<60 and f.BoundingBox().xmax<45]
    assert len(floors)==1, (path.name,len(floors))
    top=spec['originalNeckPickupY']+21
    profile=floors[0].intersect(block(-50,50,50,top,-42,-40))
    assert len(profile.Faces())==1
    wire=profile.Faces()[0].outerWire()
    depth_shift=construction['bodies'][path.stem]['rearTranslationMm']
    floor=-41+depth_shift
    fill=cq.Solid.extrudeLinear(wire,[],cq.Vector(0,0,-1-floor)).translate((0,0,depth_shift))
    cutter=cq.Solid.extrudeLinear(wire,[],cq.Vector(0,0,20-floor)).translate((0,shift,depth_shift))
    body=cq.importers.importStep(str(path)).val()
    neck=necks['oryx_neck' if model=='oryx' else 'shared_neck']
    adjusted=repair(body.fuse(fill,tol=.000001).cut(cutter,tol=.000001).cut(pocket,tol=.000001).cut(neck,tol=.000001))
    remaining=adjusted.intersect(neck).Volume()
    assert adjusted.isValid() and len(adjusted.Solids())==1, (path.name,'invalid solid')
    assert remaining<.1, (path.name,'neck overlap',remaining)
    # This edit is confined to the old/new pickup recess, not the carved perimeter.
    area=block(-45,45,55,top+shift+.1,-42,20)
    outside_removed=body.cut(adjusted).cut(area).Volume()
    outside_added=adjusted.cut(body).cut(area).Volume()
    assert abs(outside_removed)<.1 and abs(outside_added)<.1,(path.name,outside_removed,outside_added)
    cq.exporters.export(adjusted,str(out/path.name))
    report['bodies'][path.stem]={'validSolid':True,'remainingNeckIntersectionMm3':round(remaining,8),
        'outsideRoutingRemovedMm3':round(outside_removed,8),'outsideRoutingAddedMm3':round(outside_added,8),
        'routingFloorZMm':floor,'neckPickupY':spec['neckPickupY']}
    print(path.stem,report['bodies'][path.stem],flush=True)
    (out/'pickup-alignment-report.json').write_text(json.dumps(report,indent=2))
