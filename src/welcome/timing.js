// One click plays the complete sequence and reveals the homepage automatically.
// 1,720 ms playback + 160 ms fade, with a 1,950 ms total deadline.
export const WELCOME_TIMING = Object.freeze({
  gold: 250, formed: 800, rotated: 1020, hold: 1100,
  dissolved: 1460, logoStart: 1260, duration: 1720, entryFade: 160,
  maxDuration: 1950
});

// The solid and the logo's source filaments must share the same final pose.
export const WELCOME_TURN_RADIANS = -Math.PI / 4;

// Shaders use one logical unit per phase, with two units for CAD formation.
export function cadPhaseTime(ms){
  const t=WELCOME_TIMING;
  if(ms<=t.gold)return ms/t.gold;
  if(ms<=t.formed)return 1+2*(ms-t.gold)/(t.formed-t.gold);
  if(ms<=t.rotated)return 3+(ms-t.formed)/(t.rotated-t.formed);
  if(ms<=t.hold)return 4+(ms-t.rotated)/(t.hold-t.rotated);
  return 5+Math.min(1,(ms-t.hold)/(t.dissolved-t.hold));
}
