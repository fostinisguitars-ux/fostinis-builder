"""Check the heel split regression in the actual CAD solid."""
from pathlib import Path
import sys,json
import cadquery as cq

root=Path(sys.argv[1]).resolve()
shared=cq.importers.importStep(str(root/'shared_neck.step')).val()
oryx=cq.importers.importStep(str(root/'oryx_neck.step')).val()
for shape in (shared,oryx):
    assert shape.isValid() and len(shape.Solids())==1
a,b=shared.BoundingBox(),oryx.BoundingBox()
for prop in ('xmin','xmax','ymin','ymax','zmin','zmax'):
    assert abs(getattr(a,prop)-getattr(b,prop))<.001,(prop,getattr(a,prop),getattr(b,prop))
stations=[]
for y in (140,150,155,160,165,175,185,195,205,220,245,265):
    section=cq.Workplane('XZ').newObject([oryx]).section(-y).val()
    # The old heel had three disconnected sections at y=155, even though
    # the complete neck was technically one solid.
    assert len(section.Wires())==1,(y,len(section.Wires()))
    stations.append({'yMm':y,'connectedSections':1})
for point in ((0,155,-30),(0,175,-30),(10,155,-24.5),(-10,155,-24.5)):
    assert oryx.isInside(cq.Vector(*point),1e-6),('heel split',point)
report={'validClosedSolids':2,'overallNeckBoundsPreserved':True,
        'oryxHeelSections':stations,'formerSplitLocationsFilled':True,
        'scaleLengthMm':647.7,'neckScale':1}
(root/'joint-validation.json').write_text(json.dumps(report,indent=2))
print('PASS: continuous Oryx heel at all 12 sections; former splits filled; shared neck dimensions retained.',flush=True)
