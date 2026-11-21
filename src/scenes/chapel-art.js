// Original front-elevation illustration. All geometry is shared with the live window masks.
// Architectural reference: https://chapel.duke.edu/we-believe/
export const chapelWindows = [
  { x: 493, y: 205, w: 87, h: 206, group: 0 },
  { x: 620, y: 205, w: 87, h: 206, group: 1 },
  { x: 516, y: 502, w: 48, h: 143, group: 2 },
  { x: 576, y: 480, w: 48, h: 165, group: 3 },
  { x: 636, y: 502, w: 48, h: 143, group: 2 },
  ...[204, 281, 358, 798, 875, 952].map((x, i) => ({ x, y: 737, w: 44, h: 89, group: i % 4 })),
  { x: 449, y: 703, w: 25, h: 112, group: 0 },
  { x: 726, y: 703, w: 25, h: 112, group: 1 }
];

export function pointedArch({ x, y, w, h }) {
  return `M${x} ${y + h}V${y + w * 0.7}Q${x} ${y + w * 0.3} ${x + w / 2} ${y}Q${x + w} ${y + w * 0.3} ${x + w} ${y + w * 0.7}V${y + h}Z`;
}

const pinnacle = x => `<g fill="url(#trim)" stroke="#9099aa" stroke-width="1.3"><path d="M${x - 13} 183V102L${x - 7} 88V66L${x} 35L${x + 7} 66V88L${x + 13} 102V183Z"/><path d="M${x - 19} 119h38v10h-38zM${x - 16} 145h32v8h-32z"/><path d="M${x} 57v108" fill="none" stroke="#c1c4c5"/></g>`;
const buttress = x => `<g stroke="#6e788a" stroke-width="1.2"><path d="M${x - 17} 878V454l8-12V185l9-25 9 25v257l8 12v424z" fill="url(#trim)"/><path d="M${x - 21} 670h42v12h-42zM${x - 21} 495h42v10h-42zM${x - 14} 308h28v9h-28z" fill="#8d96a1"/><path d="M${x - 6} 208v643" stroke="#bac0c4" opacity=".4"/></g>`;
const windowMarkup = chapelWindows.map(window => `<path d="${pointedArch(window)}" fill="#182939" stroke="#a3a6ac" stroke-width="5"/>`).join('');
const crenels = Array.from({ length: 13 }, (_, i) => `<path d="M${449 + i * 24} 156v-16h12v16" fill="#7d8795" stroke="#a1a9b2" stroke-width="1.3"/>`).join('');
const carvings = Array.from({ length: 9 }, (_, i) => `<path d="${pointedArch({ x: 482 + i * 27, y: 436, w: 20, h: 30 })}" fill="#283342" stroke="#8d96a1" stroke-width="2"/>`).join('');
const arcade = [180, 257, 334, 411, 745, 822, 899, 976].map(x => `<path d="${pointedArch({ x, y: 840, w: 44, h: 61 })}" fill="#091323" stroke="#85909c" stroke-width="7"/>`).join('');

export const chapelIllustration = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1000" viewBox="0 0 1200 1000">
<defs>
  <linearGradient id="stone" x2="1" y2=".5"><stop stop-color="#344253"/><stop offset=".5" stop-color="#596676"/><stop offset="1" stop-color="#303e50"/></linearGradient>
  <linearGradient id="trim"><stop stop-color="#626f80"/><stop offset=".45" stop-color="#a0a6ac"/><stop offset="1" stop-color="#455467"/></linearGradient>
  <pattern id="masonry" width="42" height="26" patternUnits="userSpaceOnUse"><path d="M0 0h42v26H0zM21 0v13M0 13h42M8 13v13M36 13v13" fill="none" stroke="#152538" stroke-opacity=".28" stroke-width="1"/><path d="M1 1h39M1 14h39" stroke="#b8bdc5" stroke-opacity=".12"/></pattern>
</defs>
<g stroke="#7f8b9c" stroke-width="2">
  <path d="M160 904V721l20-24h274v207zM746 904V697h274l20 24v183z" fill="url(#stone)"/>
  <path d="M165 722h285v15H165zM750 722h285v15H750z" fill="url(#trim)"/>
  <path d="M448 901V157h304v744z" fill="url(#stone)"/>
  <path d="M160 904V721l20-24h274V157h292v540h274l20 24v183z" fill="url(#masonry)" stroke="none"/>
  <path d="M441 160h318v16H441zM443 420h314v14H443zM440 667h320v15H440z" fill="url(#trim)"/>
  ${crenels}${pinnacle(449)}${pinnacle(751)}${pinnacle(479)}${pinnacle(721)}
  ${buttress(448)}${buttress(752)}
  <path d="M600 182v231M484 185h232M484 194h232" stroke="#a5aab0" opacity=".55"/>
  ${windowMarkup}${carvings}
  <path d="M488 654h224v9H488" fill="url(#trim)"/>
  <path d="M493 901V799Q493 729 600 684Q707 729 707 799V901Z" fill="url(#trim)"/>
  <path d="M508 901V801Q508 743 600 702Q692 743 692 801V901Z" fill="#293646"/>
  <path d="M521 901V804Q521 753 600 717Q679 753 679 804V901Z" fill="#76818c"/>
  <path d="M535 901V808Q535 765 600 735Q665 765 665 808V901Z" fill="#152234"/>
  <path d="M546 901v-93q0-35 54-61 54 26 54 61v93z" fill="#46372f" stroke="#9d9485"/>
  <path d="M600 757v144M546 818h108M555 829v60h35v-60zM610 829v60h35v-60z" fill="none" stroke="#8b7761"/>
  <path d="M554 805q46-26 92 0M563 793q37-24 74 0" fill="none" stroke="#b5a28b" opacity=".5"/>
  ${arcade}
  <g fill="url(#trim)"><path d="M162 829h283v11H162zM755 829h283v11H755z"/>${[169, 246, 323, 400, 789, 866, 943, 1020].map(x => `<path d="M${x} 900v-60h10v60z"/>`).join('')}</g>
  <path d="M148 906h904v9H148zM134 918h932v9H134zM116 931h968v9H116z" fill="url(#trim)"/>
</g></svg>`;
