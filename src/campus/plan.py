"""Editable vector tracing of the user-supplied base floor plan (2026-09-26)."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
parts=[]
def path(d,**kw):
    attrs=' '.join(f'{k.replace("_","-")}="{v}"' for k,v in kw.items())
    parts.append(f'<path d="{d}" {attrs}/>')
def rect(x,y,w,h,r=0):
    parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}"/>')
def text(x,y,label,size=11):
    parts.append(f'<text x="{x}" y="{y}" font-size="{size}">{label}</text>')
def chair(x,y,w=12,h=12):
    rect(x,y,w,h,1.5);path(f'M{x+2},{y+2}H{x+w-2}')
def rack(x,y,w,h):
    rect(x,y,w,h)
    for k in range(3):
        yy=y+h*k/3;path(f'M{x},{yy}L{x+w},{yy+h/3}M{x+w},{yy}L{x},{yy+h/3}')
def table(x,y,w,h):
    rect(x,y,w,h,1)
    for xx in (x+6,x+w-6):
        for yy in (y+6,y+h-6):rect(xx-1,yy-1,2,2)

def stair_plan(ox,oy,sx,sy,descending=False):
    # East-facing lower entry; turn south into the unchanged upper flight.
    west,inner,east=(ox+u*sx for u in (8.270,9.0875,9.890))
    north,turn,south=(oy+v*sy for v in (12.185,13.085,14.735))
    path(f'M{west} {north}H{east}V{turn}H{inner}V{south}H{west}Z',stroke_width=1.2)
    for i in range(6):
        xx=inner+(east-inner)*i/5;path(f'M{xx} {north}V{turn}',stroke_width=.65)
    for i in range(11):
        yy=turn+(south-turn)*i/10;path(f'M{west} {yy}H{inner}',stroke_width=.65)
    ax=(west+inner)/2;mid=(north+turn)/2
    if descending:
        tip=east-3
        path(f'M{ax} {south-5}V{mid}H{tip} M{tip-4} {mid-3}L{tip} {mid}L{tip-4} {mid+3}',stroke_width=.7)
    else:
        tip=south-3
        path(f'M{east-4} {mid}H{ax}V{tip} M{ax-3} {tip-4}L{ax} {tip}L{ax+3} {tip-4}',stroke_width=.7)

# Wall centerlines and inner faces retain the geometry and doors of the supplied drawing.
path('M116 383V84H743V154H633V244 M633 291V505 M633 552V608H116V454',stroke_width=2.2)
path('M122 383V90H737V148H627V244 M627 291V499 M627 552V602H122V454',stroke_width=.7)
path('M122 121H327V126H342V116H367V90 M116 379H167 M173 379H326 M340 379H605 M620 379H631',stroke_width=1.6)
path('M167 383V454H122 M173 387V448H239V383 M243 383V454',stroke_width=1.5)
path('M249 389H319V450H249Z M252 389V449',stroke_width=.7)
# Door leafs and opening arcs.
path('M633 244H609A24 24 0 0 0 633 268M633 291H609A23 23 0 0 1 633 268 M633 505H609A24 24 0 0 0 633 529M633 552H609A23 23 0 0 1 633 529')
path('M122 383V405A22 22 0 0 0 144 383 M167 383V405A23 23 0 0 1 144 383 M122 454V431A23 23 0 0 1 145 454 M167 454V432A22 22 0 0 0 145 454')
# Audited field dimensions use the north dimension baseline, not an independent
# estimate of the raster rectangle. Other unreviewed furniture remains a trace.
metre = 612 / 24.575
metre_y = 519 / 20.645
datum_x, datum_y = 121, 88
stair_plan(datum_x,datum_y,metre,metre_y)
field_x, field_y = datum_x + 1.4 * metre, datum_y + 2.525 * metre_y
field_w, field_d = 15.801 * metre, 7.9 * metre_y
field_right, field_bottom = field_x + field_w, field_y + field_d
rect(field_x,field_y,field_w,field_d)
path(f'M{field_x} {field_y+10}H{field_x+10} M{field_x} {field_y+10}V{field_y+20}'
     f'M{field_right-10} {field_y}V{field_y+10}H{field_right}'
     f'M{field_x} {field_bottom-10}H{field_x+10}V{field_bottom}'
     f'M{field_right-10} {field_bottom}V{field_bottom-10}H{field_right}',stroke_width=.7)
path(f'M{field_x+field_w/2} {field_y}V{field_bottom}',stroke_dasharray='3 5',opacity='.3')
# Clear width/depth and offsets retain the source's millimetre notation.
field_measure_y, field_measure_x = 212, 240
east_control = datum_x + 20.495 * metre
path(f'M{datum_x} {field_measure_y}H{east_control}'
     f'M{field_measure_x} {field_y}V{field_bottom}'
     f'M145 {datum_y}V{field_y} M139 {datum_y}H151 M139 {field_y}H151',stroke_width=.45,opacity='.65')
for xx in (datum_x,field_x,field_right,east_control):
    path(f'M{xx-2} {field_measure_y+3}L{xx+2} {field_measure_y-3}',stroke_width=.6)
for yy in (field_y,field_bottom):
    path(f'M{field_measure_x-3} {yy+2}L{field_measure_x+3} {yy-2}',stroke_width=.6)
text((datum_x+field_x)/2,field_measure_y-5,'1 400',7)
text(field_x+field_w/2,field_measure_y-5,'15 801',8)
text((field_right+east_control)/2,field_measure_y-5,'3 294',7)
parts.append(f'<text x="{field_measure_x-5}" y="{field_y+field_d/2}" transform="rotate(-90 {field_measure_x-5} {field_y+field_d/2})" font-size="8">7 900</text>')
parts.append(f'<text x="140" y="{(datum_y+field_y)/2}" transform="rotate(-90 140 {(datum_y+field_y)/2})" font-size="7">2 525</text>')
# North lounge chairs, entrance posts, and columns.
for x in range(375,511,16):chair(x,98)
for x,y,w,h in [(606,110,15,15),(698,110,15,15),(326,372,14,13),(605,372,14,14)]:rect(x,y,w,h)
# Meeting area: two communal islands with perimeter seats.
for y in (500,552):
    table_depth = .7 * metre_y
    table(277,y,61,table_depth)
    path(f'M307.5 {y}V{y+table_depth}',stroke_width=.65)
    for x in (278,293,308,323):chair(x,y-15,13,12);chair(x,y+table_depth+4,13,12)
    chair(262,y+table_depth/2-7,11,14);chair(342,y+table_depth/2-7,11,14)
# Storage / tool / display zones and furniture.
for spec in [(120,487,19,82),(156,486,21,83),(220,486,25,91),(178,582,53,21)]:rack(*spec)
table(368,588,183,15)
# Revised entrance detail uses the supplied 600 + 400 mm paired racks,
# 5100 mm run and 2270 mm clear east aisle, on the existing plan datum.
storage_west, storage_back, display_front = (datum_x + u * metre for u in (17.225,17.825,18.225))
rack_north, rack_south, return_south = (datum_y + v * metre_y for v in (13.915,19.015,19.925))
rack(storage_west,rack_north,.600*metre,rack_south-rack_north)
rack(storage_back,rack_north,.400*metre,rack_south-rack_north)
# The west storage run continues to the existing south tool row; the
# new east display face ends at the transverse screen wall.
rack(storage_west,rack_south,.600*metre,return_south-rack_south)
screen_east = display_front + 1.840 * metre
rect(display_front-.040*metre,rack_south,1.920*metre,.130*metre_y)
rect(display_front,rack_south-.090*metre_y,1.840*metre,.075*metre_y)
dimension_y, length_x = rack_north-12, storage_west-10
path(f'M{storage_west} {dimension_y}H{east_control} '
     f'M{length_x} {rack_north}V{rack_south}',stroke_width=.45,opacity='.65')
for xx in (storage_west,storage_back,display_front,east_control):
    path(f'M{xx} {dimension_y-3}V{dimension_y+3}',stroke_width=.5,opacity='.7')
for yy in (rack_north,rack_south):
    path(f'M{length_x-3} {yy}H{length_x+3}',stroke_width=.5,opacity='.7')
text((storage_west+storage_back)/2,dimension_y-5,'600',6)
text((storage_back+display_front)/2,dimension_y-5,'400',6)
text((display_front+east_control)/2,dimension_y-5,'2 270',7)
parts.append(f'<text x="{length_x-5}" y="{(rack_north+rack_south)/2}" transform="rotate(-90 {length_x-5} {(rack_north+rack_south)/2})" font-size="7">5 100</text>')
text((display_front+screen_east)/2,rack_south-7,'显示屏 1 840',7)
for x in (271,295):chair(x,402,12,12);chair(x,420,12,12)
rect(271,438,20,11);rect(299,439,12,10)
path('M319 424H326')
text(field_x+field_w/2,field_y+field_d/2,'练习场',13);text(442,129,'休息区',11)
text(443,486,'搭建区',12);text(303,474,'交流区',11)
text(198,530,'存储区',10);text(510,455,'货架区',9)
text(445,579,'工具区',10);text(597,492,'展示区',10)
# Quiet dimensional annotation, in millimetres as in the original drawing.
path('M121 75V29M733 75V29M121 33H733 M121 58H733 M367 58V85M632 58V85 M108 88H57M108 607H57M62 88V607 M121 623V667M634 616V667M121 659H634',stroke_width=.55,opacity='.55')
for x,y in [(121,33),(733,33),(121,58),(367,58),(632,58),(733,58),(62,88),(62,607),(121,659),(634,659)]:path(f'M{x-3} {y+3}L{x+3} {y-3}',stroke_width=.75)
text(427,25,'24 575',9);text(244,51,'9 890',8);text(500,51,'10 605',8);text(684,51,'4 080',8);text(379,651,'20 520',9)
parts.append('<text x="49" y="350" transform="rotate(-90 49 350)" font-size="9">20 645</text>')
svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="35 12 730 666" width="2190" height="1998"><g fill="none" stroke="#f1ece3" stroke-width="1.15" stroke-linecap="square" stroke-linejoin="miter">'+''.join(p for p in parts if not p.startswith('<text'))+'</g><g fill="#f1ece3" stroke="none" text-anchor="middle" font-family="Arial, PingFang SC, Microsoft YaHei, sans-serif">'+''.join(p for p in parts if p.startswith('<text'))+'</g></svg>'
(ROOT/'src/site/published-welcome/campus/floorplan.svg').write_text(svg)

# Second floor: coordinates trace the supplied 2F drawing at its original scale.
# Its shell is translated into the first-floor coordinate system on export.
# The large north and southeast regions are voids, not enclosed rooms.
parts=[]
path('M160 86H786V156H681V610H159V453H213V388H160Z',stroke_width=2.2)
path('M166 92H780V150H675V604H165V459H219V382H166V124',stroke_width=.7)
path('M166 124H370V129H386V119H411V92 M166 383H369 M386 383H648 M664 383H675',stroke_width=1.3)
# Void diagonals distinguish the two open-to-below areas in the source drawing.
path('M166 125L218 334L675 372 M418 386L460 555L609 603',stroke_width=.8)
path('M386 380H648 M386 386H648',stroke_width=.8,stroke_dasharray='6 7')
text(262,316,'挑空区',11);text(488,547,'挑空区',11)

# Structural columns and the small southeast perimeter projection.
for spec in [(649,113,16,16),(742,113,16,16),(369,375,17,17),(649,375,16,17)]:rect(*spec)
path('M670 92V98H688V92 M670 98L687 92',stroke_width=.8)
path('M609 609V568H663V609',stroke_width=1)

# The meeting room, the adjoining stair, and the classroom entrance corridor.
path('M219 389H339V455H335 M311 455H219Z M223 393H335V433',stroke_width=1.4)
# The south entrance is shared by both drawings; the arrow here descends.
path('M339 389H370V457 M391 457H411',stroke_width=1.2)
stair_plan(165,90,611/24.575,514/20.645,descending=True)
path('M335 455V433A22 22 0 0 0 313 455 M285 459V482A23 23 0 0 0 308 459',stroke_width=.8)
text(380,417,'下',7)

# Ten meeting seats surround one long table, with the room name left legible.
table(243,412,63,24)
for xx in (244,260,276,292):chair(xx,397,12,12);chair(xx,440,12,12)
chair(226,415,12,13);chair(310,415,12,13)
text(276,428,'会议室',10)

# Seven 800 mm modules: three desks, one aisle, then three desks. The west
# block has only two rows; the southeast block has three (15 seats total).
classroom_left, classroom_south, classroom_metre = 165, 604, 25
classroom_module, desk_depth, classroom_pitch = .8*classroom_metre, .6*classroom_metre, 1.5*classroom_metre
notch_east = classroom_left + 2.26 * classroom_metre
notch_top = classroom_south - 1.31 * classroom_metre
path(f'M165 459H285 M308 459H338 M165 {notch_top}H{notch_east}V604 M308 493V604',stroke_width=1.3)
path('M338 459V489',stroke_width=1.2)
for col in (0,1,2,4,5,6):
    xx = classroom_left + col * classroom_module
    for row in range(2 if col < 3 else 3):
        yy = 497 + row * classroom_pitch
        table(xx,yy,classroom_module,desk_depth)
        chair(xx+4,yy+desk_depth+2,12,11)
path(f'M{classroom_left} 493H{classroom_left+7*classroom_module}',stroke_width=.45,opacity='.7')
for step in range(8):
    xx = classroom_left + step * classroom_module
    path(f'M{xx} 490V497',stroke_width=.45,opacity='.7')
    if step < 7:text(xx+classroom_module/2,490,'800',6)
text(238,481,'教室–15人',11)

# The source office has 1450 mm stations on both sides of a 1170 mm aisle.
# Each row is 1450 mm deep. The desktop runs along its NORTH and OUTSIDE
# edges, with a rounded inside elbow; its south/aisle side remains open.
office_left, office_top = 310, 496.25
station, aisle = 36.25, 29.25  # 25 drawing pixels per metre, as in this region.
office_right = office_left + station * 2 + aisle
right_station = office_left + station + aisle
depth, elbow = 12.5, 5.0
path(f'M308 {office_top}V605 M412 {office_top}V605',stroke_width=1.3)
for row in range(3):
    yy = office_top + row * station
    # Low dividers mark each northern edge; no wall closes the centre aisle.
    path(f'M308 {yy}H{office_left+station} M{right_station} {yy}H412',stroke_width=1.15)
    x, top, w, bottom = office_left + 1, yy + 1, station - 2, yy + station - 1
    path(f'M{x} {top}H{x+w}V{top+depth}H{x+depth+elbow}'
         f'A{elbow} {elbow} 0 0 0 {x+depth} {top+depth+elbow}'
         f'V{bottom}H{x}Z',stroke_width=.8)
    # Mirror the west workstation about the central aisle.
    x = office_right - 1
    path(f'M{x} {top}H{x-w}V{top+depth}H{x-depth-elbow}'
         f'A{elbow} {elbow} 0 0 1 {x-depth} {top+depth+elbow}'
         f'V{bottom}H{x}Z',stroke_width=.8)
    for cx, facing in ((office_left+21, -1), (office_right-21, 1)):
        cy = yy + 22
        # The diagonal backrest is opposite the north/outside-facing seat.
        path(f'M{cx-5} {cy}L{cx} {cy-5}L{cx+5} {cy}L{cx} {cy+5}Z',stroke_width=.8)
        path(f'M{cx-facing*6.5} {cy+.5}L{cx-facing*.5} {cy+6.5}',stroke_width=1)
    # Corner screens follow the same diagonal direction as the source plan.
    for cx, mirror in ((office_left+5, 1), (office_right-5, -1)):
        cy = yy + 6
        path(f'M{cx-mirror*3} {cy}L{cx} {cy-3}L{cx+mirror*3} {cy}'
             f'L{cx} {cy+3}Z M{cx-mirror*3.8} {cy+1}L{cx-mirror*.8} {cy+4}',stroke_width=.65)
text(358,479,'办公室',10)
# Office dimensions are local to the trace, with enough space around the labels.
path(f'M{office_left} 493H{office_right} M{office_left} 490V498 '
     f'M{office_left+station} 490V498 M{right_station} 490V498 M{office_right} 490V498',stroke_width=.45,opacity='.75')
for xx, label in ((office_left+station/2,'1450'),
                  (office_left+station+aisle/2,'1170'),
                  (right_station+station/2,'1450')):
    text(xx,490,label,7)
dimension_x = office_left + station + 3.5
path(f'M{dimension_x} {office_top}V605',stroke_width=.4,opacity='.7')
for row in range(4):
    yy = office_top + station * row
    path(f'M{dimension_x-2} {yy}H{dimension_x+2}',stroke_width=.55)
for row in range(3):
    yy = office_top + station * (row+.5)
    parts.append(f'<text x="{dimension_x-2}" y="{yy}" transform="rotate(-90 {dimension_x-2} {yy})" font-size="6.5">1450</text>')

# Restrained envelope dimensions retain the source's millimetre measurements.
path(f'M165 78V31M776 78V31M165 32H776 M165 57H776 M411 57V87M675 57V87 M150 92H116M150 606H116M122 92V606 M165 625V675M675 615V675M165 674H675 M165 650H675M{notch_east} 641V653M370 641V653M386 641V653M608 641V653M664 641V653',stroke_width=.55,opacity='.55')
for xx,yy in [(165,32),(776,32),(165,57),(411,57),(675,57),(776,57),(122,92),(122,606),(165,674),(675,674),(165,650),(notch_east,650),(370,650),(386,650),(608,650),(664,650),(675,650)]:
    path(f'M{xx-3} {yy+3}L{xx+3} {yy-3}',stroke_width=.7)
text(471,25,'24 575',9);text(288,51,'9 890',8);text(543,51,'10 605',8);text(726,51,'4 080',8)
text(421,668,'20 520',9)
for xx,label in [(193,'2 260'),(295,'6 010'),(378,'645'),(497,'8 935'),(636,'2 240')]:text(xx,643,label,7)
parts.append('<text x="111" y="350" transform="rotate(-90 111 350)" font-size="9">20 645</text>')

svg_2f='<svg xmlns="http://www.w3.org/2000/svg" viewBox="35 12 730 666" width="2190" height="1998"><g transform="translate(-44 -2)"><g fill="none" stroke="#f1ece3" stroke-width="1.15" stroke-linecap="square" stroke-linejoin="miter">'+''.join(p for p in parts if not p.startswith('<text'))+'</g><g fill="#f1ece3" stroke="none" text-anchor="middle" font-family="Arial, PingFang SC, Microsoft YaHei, sans-serif">'+''.join(p for p in parts if p.startswith('<text'))+'</g></g></svg>'
(ROOT/'src/site/published-welcome/campus/floorplan-2f.svg').write_text(svg_2f)
