export function mouthFromLevel(rms,sensitivity=1.5,strength=1) {
 const level=Math.max(0,Math.min(1,(rms*sensitivity-0.018)*8));
 return {level,mouth:level*strength>0.48?2:level*strength>0.09?1:0};
}
