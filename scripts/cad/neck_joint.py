"""Continuous Oryx heel and full-width pockets, in source CAD millimeters."""
import cadquery as cq

Y = 372.57195887
Z = 1.8625
HEEL_EXTENSION = 165.495288256 - 114.739858854

def block(x0, x1, y0, y1, z0, z1):
    return cq.Workplane('XY').box(x1-x0, y1-y0, z1-z0, centered=False).translate((x0,y0,z0)).val()

def world(shape):
    return shape.rotate((0,0,0),(0,0,1),-90).translate((0,Y,Z))

def envelope(neck, depth):
    # The top face's outer wire includes the open truss-rod slot. A pocket or
    # heel envelope must span that slot rather than copy it through the wood.
    outline = cq.Solid.extrudeLinear(neck.Faces()[13].outerWire(), [], cq.Vector(0,0,-depth))
    return outline.fuse(block(80,265.385,-2.382,2.382,-depth,0)).clean()

def extended_heel(neck):
    # Extend only the exterior heel. The original tenon has a lowered top and
    # the shaft has a rod channel; copying either into the extension creates
    # the horizontal slit and center split seen in the previous showroom.
    exterior = neck.fuse(
        block(133.9,265.385,-2.382,2.382,-9.284,0),
        block(265.38,316.1844,-27.78125,27.78125,-26.988,0)
    ).clean()
    shifted = exterior.intersect(block(134,334,-50,50,-60,1)).translate((-HEEL_EXTENSION,0,0))
    extension = shifted.intersect(envelope(neck,85))
    result = neck.fuse(extension).clean()
    # Preserve the actual internal rod channel in its original position.
    channel = block(80,265.385,-2.38125,2.38125,-9.283,0).cut(neck)
    result = result.cut(channel).clean()
    assert result.isValid() and len(result.Solids()) == 1
    return result

def neck_pocket(neck):
    pocket = world(envelope(neck,42.8645))
    tenon = block(-27.78125,27.78125,56.387565,107.188565,-41.001,-25.124)
    return pocket.fuse(tenon).clean()

def trim_oryx_heel(body):
    # The moved rear section can leave a <0.3 mm wall on the open cutaway
    # side of the extended heel. Remove that exposed lip below the cap;
    # the opposite single-cut shoulder and the neck itself stay untouched.
    relief = block(0,27.80125,Y-233.63439311,165.495288256,
                   -41.002,-25.124)
    return body.cut(relief,tol=.000001).clean()
