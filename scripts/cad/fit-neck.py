from pathlib import Path
import cadquery as cq,json
from OCP.ShapeFix import ShapeFix_Shape
import sys
from neck_joint import extended_heel, neck_pocket, world, Y, Z, HEEL_EXTENSION
root=Path(sys.argv[1]).resolve();out=root/'fitted';out.mkdir(exist_ok=True)
neck=cq.importers.importStep(str(root/'matadaur-sphyx-neck.step')).val()
# All lengths are millimeters. No scale is applied to the source neck.
# Match the difference between the actual pocket endpoints in the supplied bodies.
extension=HEEL_EXTENSION
oryx=extended_heel(neck)
assert oryx.isValid()
neck_global=world(neck)
oryx_global=world(oryx)
cq.exporters.export(neck_global,str(out/'shared_neck.step'))
cq.exporters.export(oryx_global,str(out/'oryx_neck.step'))
pocket=neck_pocket(neck)
report={'units':'mm','scale':1,'neckTransform':{'rotationZDegrees':-90,'translation':[0,Y,Z]},'oryxHeelExtensionMm':extension,'neckUnscaled':True,'bodies':{}}
if '--resume' in sys.argv and (root/'fit-report.json').exists():
 report['bodies']=json.loads((root/'fit-report.json').read_text())['bodies']
for path in sorted(root.glob('*.STEP')):
 if path.stem in report['bodies'] and (out/(path.stem+'.step')).exists():continue
 model=path.stem.split('_')[0];body=cq.importers.importStep(str(path)).val()
 dx=20.8503708884 if model=='matadaur' else 13.9326447681
 dy=21.588992035 if model=='matadaur' else 0
 body=body.translate((dx,dy,0));n=oryx_global if model=='oryx' else neck_global
 overlap=body.intersect(n).Volume();fitted=body.cut(pocket,tol=.001)
 fixer=ShapeFix_Shape(fitted.wrapped);fixer.SetPrecision(.01);fixer.SetMaxTolerance(.1);fixer.Perform();fitted=cq.Shape.cast(fixer.Shape())
 remaining=fitted.intersect(n).Volume()
 print("fit diagnostic",path.name,fitted.isValid(),len(fitted.Solids()),[q.Volume() for q in fitted.Solids()],flush=True)
 assert fitted.isValid() and len(fitted.Solids())==1
 assert remaining<.1,(path.name,remaining)
 removed=body.Volume()-fitted.Volume()
 added=0
 if removed<0:
  # Integrate only the cut tool's intersection. Subtracting two large trimmed
  # B-spline solids loses accuracy and can return a null difference shape.
  removed=body.intersect(pocket,tol=.000001).Volume()
 report['bodies'][path.stem]={'addedBodyVolumeMm3':round(added,8),'translationMm':[dx,dy,0],'removedBodyVolumeMm3':round(removed,6),'originalNeckIntersectionMm3':round(overlap,6),'remainingIntersectionMm3':round(remaining,8),'sourceNeckScale':1,'validSolid':True}
 cq.exporters.export(fitted,str(out/(path.stem+'.step')))
 (root/'fit-report.json').write_text(json.dumps(report,indent=2))
 print(path.stem,report['bodies'][path.stem],flush=True)
(root/'fit-report.json').write_text(json.dumps(report,indent=2))
print('Done',extension,flush=True)
