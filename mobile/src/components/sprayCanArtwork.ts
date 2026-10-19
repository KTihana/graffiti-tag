/** Aerosol silhouette used by web markers and the native PNG export. */
export function sprayCanArtwork(ink: string, paper: string) {
  return `<g stroke="${ink}" stroke-linejoin="round" stroke-linecap="round"><path d="M54 15H75V33H54Z" fill="${ink}" stroke-width="5"/><circle cx="70" cy="23" r="3.5" fill="${paper}" stroke="none"/><path d="M49 36H80L91 47Q97 54 97 64V139Q97 148 88 151H41Q32 148 32 139V64Q32 54 38 47Z" fill="${paper}" stroke-width="7"/><path d="M38 58Q64 50 91 58M38 138Q65 145 91 138" stroke-width="5"/><path d="M34 75H95V119H34Z" fill="${ink}" stroke="none"/><path d="M47 105L59 89L65 104L80 88" stroke="${paper}" stroke-width="5"/><path d="M86 24L102 19M88 31L108 31M85 38L102 44" stroke-width="4"/></g>`;
}
