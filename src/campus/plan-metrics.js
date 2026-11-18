// Metres. Dimensions explicitly legible in the supplied 1F/2F drawings.
// Vertical elevations are absent from those drawings and remain presentation assumptions.
export const CAMPUS_PLAN = {
  width:24.575,
  depth:20.645,
  mainWidth:20.520,
  verticalChain:[1.325,10.400,.200,2.810,4.600,1.310],
  hallSouth:11.725,
  southRoomsNorth:11.925,
  southRoomsSouth:14.735,
  classroomNotchNorth:19.335,
  classroomNotchWidth:2.260,
  field:{west:1.400,north:2.525,width:15.801,depth:7.900},
  office:{east:9.890,bayWidth:1.450,bayDepth:1.450,aisle:1.170,rows:3},
  // Room and stair edges below are scaled traces, not dimension annotations.
  meeting:{west:2.0075,east:6.9975},
  stair:{west:8.270,narrowEast:9.0875,east:9.890,north:12.0725,turn:13.7225,south:14.6225},
  displayAssumptions:{floor2Elevation:3.2,upperClearHeight:2.7,roofHeight:6.3},
};
export const planX = metres => metres - CAMPUS_PLAN.width/2;
export const planZ = metres => metres - CAMPUS_PLAN.depth/2;
