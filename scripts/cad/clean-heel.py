"""Remove the Oryx cutaway's thin pocket-wall remnant after fitting."""
from pathlib import Path
import sys,json
import cadquery as cq
from neck_joint import trim_oryx_heel,block

root=Path(sys.argv[1]).resolve()
neck=cq.importers.importStep(str(root/'oryx_neck.step')).val()
report={'neckUnchanged':True,'carvedCapUnchanged':True,'bodies':{}}
for path in sorted(root.glob('oryx_*.step')):
    if 'neck' in path.name:continue
    body=cq.importers.importStep(str(path)).val()
    cleaned=trim_oryx_heel(body)
    assert cleaned.isValid() and len(cleaned.Solids())==1
    overlap=cleaned.intersect(neck).Volume()
    assert overlap<.1
    # The lip seen in the side render must no longer be present.
    assert not cleaned.isInside(cq.Vector(27.62,156.747,-34.8188),1e-6)
    original_top=body.intersect(block(-300,300,-400,400,-20.1,20))
    new_top=cleaned.intersect(block(-300,300,-400,400,-20.1,20))
    assert abs(original_top.Volume()-new_top.Volume())<.01
    removed=body.cut(cleaned).Volume()
    cq.exporters.export(cleaned,str(path))
    report['bodies'][path.stem]={'validSolid':True,'remainingNeckIntersectionMm3':round(overlap,8),
        'removedPocketLipMm3':round(removed,6),'carvedCapUnchanged':True}
    print(path.stem,report['bodies'][path.stem],flush=True)
(root/'heel-cleanup-report.json').write_text(json.dumps(report,indent=2))
