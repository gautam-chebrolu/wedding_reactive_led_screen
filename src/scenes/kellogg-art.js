// Original elevation study of KPMB's Global Hub: curved glass wings, five
// horizontal levels, warm soffits and the lakefront plaza. No skyline artwork.
// Reference: https://www.kellogg.northwestern.edu/the-experience/campuses/global-hub/
export const hubGlass = [
  'M145 320Q255 247 524 291L524 575Q304 626 145 548Z',
  'M504 327Q626 291 773 335L773 575Q628 616 504 573Z',
  'M738 231Q1006 153 1360 265L1360 573Q1080 666 738 573Z',
  'M1270 318Q1398 285 1490 346L1490 539Q1398 581 1270 566Z'
];
const mullions = Array.from({ length: 60 }, (_, i) => `<path d="M${145 + i * 23} 180V640"/>`).join('');
const floors = [295, 355, 417, 479, 541].map(y => `<path d="M110 ${y}Q740 ${y + 42} 1520 ${y + 9}"/>`).join('');
export const globalHubIllustration = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">
<defs>
 <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#29284d"/><stop offset=".35" stop-color="#46516c"/><stop offset=".7" stop-color="#222c49"/><stop offset="1" stop-color="#52516a"/></linearGradient>
 <linearGradient id="soffit"><stop stop-color="#a3856b"/><stop offset=".5" stop-color="#d0ab7d"/><stop offset="1" stop-color="#6f5268"/></linearGradient>
 <linearGradient id="plaza" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#5d5666"/><stop offset="1" stop-color="#1a273c"/></linearGradient>
 <clipPath id="windows">${hubGlass.map(d => `<path d="${d}"/>`).join('')}</clipPath>
</defs>
<path d="M60 578Q810 536 1540 571L1600 624H0Z" fill="#243731"/>
<path d="M95 578L1505 575L1595 623H5Z" fill="url(#plaza)"/>
${hubGlass.map(d => `<path d="${d}" fill="url(#glass)" stroke="#7e8190" stroke-width="3"/>`).join('')}
<g clip-path="url(#windows)" fill="none" stroke="#a4a2ad" stroke-width="1" opacity=".55">${mullions}${floors}</g>
<g fill="url(#soffit)">
<path d="M139 307Q270 232 530 280L530 296Q270 253 139 327Z"/>
<path d="M498 315Q627 279 781 324L781 340Q627 299 498 334Z"/>
<path d="M731 217Q1010 138 1367 252L1367 270Q1010 160 731 236Z"/>
<path d="M1263 305Q1398 273 1497 335L1497 351Q1398 294 1263 324Z"/>
</g>
<g fill="none" stroke="#b5a690" stroke-width="7">
<path d="M145 548Q304 626 524 575M504 573Q628 616 773 575M738 573Q1080 666 1360 573M1270 566Q1398 581 1490 539"/>
</g>
<g stroke="#d5c6ae" stroke-width="7"><path d="M182 335V563M490 305V579M768 248V581M1318 281V588M1452 345V549"/></g>
<path d="M560 465Q627 447 700 470V586H560Z" fill="#121a2c" stroke="#a59a9c" stroke-width="2"/>
<g stroke="#8a869b" stroke-width="2"><path d="M583 465V587M607 460V587M632 460V587M657 465V587M682 469V587"/></g>
<path d="M551 589H712L752 613H512Z" fill="#908591"/>
<g stroke="#b6a8af" stroke-width="2"><path d="M525 605H740M534 599H728M545 594H719"/></g>
<text x="1045" y="512" text-anchor="middle" fill="#e9e3ed" font-family="Georgia,serif" font-size="28">Northwestern | Kellogg</text>
<text x="1045" y="541" text-anchor="middle" fill="#c8bfd6" font-family="system-ui,sans-serif" font-size="12" letter-spacing="5">GLOBAL HUB</text>
<g fill="#151c30"><rect x="283" y="600" width="150" height="7" rx="3"/><rect x="1150" y="611" width="140" height="7" rx="3"/></g>
</svg>`;
