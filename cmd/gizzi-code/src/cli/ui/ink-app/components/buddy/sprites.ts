import type { CompanionBones, Eye, Hat, Species } from './types'
import {
  axolotl,
  blob,
  cactus,
  capybara,
  cat,
  chonk,
  dragon,
  duck,
  ghost,
  goose,
  mushroom,
  octopus,
  owl,
  penguin,
  rabbit,
  robot,
  snail,
  turtle,
} from './types'

// Each sprite is 5 lines tall, 12 wide (after {E}→1char substitution).
// Multiple frames per species for idle fidget animation.
// Line 0 is the hat slot — must be blank in frames 0-1; frame 2 may use it.
const BODIES: Record<Species, string[][]> = {
  [duck]: [
    [
      '            ',
      '    __      ',
      '  <({E} )___  ',
      '   (  ._>   ',
      '    `--´    ',
    ],
    [
      '    `--´~   ',
      '   (  .__>  ',
    ],
  ],
  [goose]: [
    [
      '     ({E}>    ',
      '     ||     ',
      '   _(__)_   ',
      '    ^^^^    ',
    ],
    [
      '    ({E}>     ',
      '     ({E}>>   ',
    ],
  ],
  [blob]: [
    [
      '   .----.   ',
      '  ( {E}  {E} )  ',
      '  (      )  ',
      '   `----´   ',
    ],
    [
      '  .------.  ',
      ' (  {E}  {E}  ) ',
      ' (        ) ',
      '  `------´  ',
    ],
    [
      '    .--.    ',
      '   ({E}  {E})   ',
      '   (    )   ',
    ],
  ],
  [cat]: [
    [
      '   /\\_/\\    ',
      '  ( {E}   {E})  ',
      '  (  ω  )   ',
      '  (")_(")   ',
    ],
    [
      '  (")_(")~  ',
      '   /\\-/\\    ',
    ],
  ],
  [dragon]: [
    [
      '  /^\\  /^\\  ',
      ' <  {E}  {E}  > ',
      ' (   ~~   ) ',
      '  `-vvvv-´  ',
    ],
    [
      '   ~    ~   ',
    ],
  ],
  [octopus]: [
    [
      '  (______)  ',
      '  /\\/\\/\\/\\  ',
      '  \\/\\/\\/\\/  ',
      '     o      ',
    ],
  ],
  [owl]: [
    [
      '   /\\  /\\   ',
      '  (({E})({E}))  ',
      '  (  ><  )  ',
      '  (({E})(-))  ',
    ],
  ],
  [penguin]: [
    [
      '  .---.     ',
      '  ({E}>{E})     ',
      ' /(   )\\    ',
      '  `---´     ',
    ],
    [
      ' |(   )|    ',
      '   ~ ~      ',
    ],
  ],
  [turtle]: [
    [
      '   _,--._   ',
      ' /[______]\\ ',
      '  ``    ``  ',
      '   ``  ``   ',
    ],
    [
      ' /[======]\\ ',
    ],
  ],
  [snail]: [
    [
      ' {E}    .--.  ',
      '  \\  ( @ )  ',
      '   \\_`--´   ',
      '  ~~~~~~~   ',
    ],
    [
      '  {E}   .--.  ',
      '  |  ( @ )  ',
      '  \\  ( @  ) ',
      '   ~~~~~~   ',
    ],
  ],
  [ghost]: [
    [
      '  / {E}  {E} \\  ',
      '  |      |  ',
      '  ~`~``~`~  ',
      '  `~`~~`~`  ',
    ],
    [
      '    ~  ~    ',
      '  ~~`~~`~~  ',
    ],
  ],
  [axolotl]: [
    [
      '}~(______)~{',
      '}~({E} .. {E})~{',
      '  ( .--. )  ',
      '  (_/  \\_)  ',
    ],
    [
      '~}(______){~',
      '~}({E} .. {E}){~',
      '  (  --  )  ',
      '  ~_/  \\_~  ',
    ],
  ],
  [capybara]: [
    [
      '  n______n  ',
      ' ( {E}    {E} ) ',
      ' (   oo   ) ',
      ' (   Oo   ) ',
      '  u______n  ',
    ],
  ],
  [cactus]: [
    [
      ' n  ____  n ',
      ' | |{E}  {E}| | ',
      ' |_|    |_| ',
      '   |    |   ',
    ],
    [
      '    ____    ',
      ' n |{E}  {E}| n ',
      ' n        n ',
      ' |  ____  | ',
    ],
  ],
  [robot]: [
    [
      '   .[||].   ',
      '  [ {E}  {E} ]  ',
      '  [ ==== ]  ',
      '  [ -==- ]  ',
      '     *      ',
    ],
  ],
  [rabbit]: [
    [
      '   (\\__/)   ',
      ' =(  ..  )= ',
      '  (")__(")  ',
      '   (|__/)   ',
    ],
    [
      ' =( .  . )= ',
    ],
  ],
  [mushroom]: [
    [
      ' .-o-OO-o-. ',
      '(__________)',
      '   |{E}  {E}|   ',
      '   |____|   ',
    ],
    [
      ' .-O-oo-O-. ',
      '   . o  .   ',
    ],
  ],
  [chonk]: [
    [
      '  /\\    /\\  ',
      ' (   ..   ) ',
      '  /\\    /|  ',
      '  `------´~ ',
    ],
  ],
}
const HAT_LINES: Record<Hat, string> = {
  none: '',
  crown: '   \\^^^/    ',
  tophat: '   [___]    ',
  propeller: '    -+-     ',
  halo: '   (   )    ',
  wizard: '    /^\\     ',
  beanie: '   (___)    ',
  tinyduck: '    ,>      ',
}
export function renderSprite(bones: CompanionBones, frame = 0): string[] {
  const frames = BODIES[bones.species]
  const body = frames[frame % frames.length]!.map(line =>
    line.replaceAll('{E}', bones.eye),
  )
  const lines = [...body]
  // Only replace with hat if line 0 is empty (some fidget frames use it for smoke etc)
  if (bones.hat !== 'none' && !lines[0]!.trim()) {
    lines[0] = HAT_LINES[bones.hat]
  }
  // Drop blank hat slot — wastes a row in the Card and ambient sprite when
  // there's no hat and the frame isn't using it for smoke/antenna/etc.
  // Only safe when ALL frames have blank line 0; otherwise heights oscillate.
  if (!lines[0]!.trim() && frames.every(f => !f[0]!.trim())) lines.shift()
  return lines
}
export function spriteFrameCount(species: Species): number {
  return BODIES[species].length
}
export function renderFace(bones: CompanionBones): string {
  const eye: Eye = bones.eye
  switch (bones.species) {
    case duck:
    case goose:
      return `(${eye}>`
    case blob:
      return `(${eye}${eye})`
    case cat:
      return `=${eye}ω${eye}=`
    case dragon:
      return `<${eye}~${eye}>`
    case octopus:
      return `~(${eye}${eye})~`
    case owl:
      return `(${eye})(${eye})`
    case penguin:
      return `(${eye}>)`
    case turtle:
      return `[${eye}_${eye}]`
    case snail:
      return `${eye}(@)`
    case ghost:
      return `/${eye}${eye}\\`
    case axolotl:
      return `}${eye}.${eye}{`
    case capybara:
      return `(${eye}oo${eye})`
    case cactus:
      return `|${eye}  ${eye}|`
    case robot:
      return `[${eye}${eye}]`
    case rabbit:
      return `(${eye}..${eye})`
    case mushroom:
    case chonk:
      return `(${eye}.${eye})`
  }
}
