import { getInitialSettings } from '../utils/settings/settings.js'

export function getSpinnerVerbs(): string[] {
  const settings = getInitialSettings()
  const config = settings.spinnerVerbs
  if (!config) {
    return SPINNER_VERBS
  }
  if (config.mode === 'replace') {
    return config.verbs.length > 0 ? config.verbs : SPINNER_VERBS
  }
  return [...SPINNER_VERBS, ...config.verbs]
}

// Allternit spinner verbs, in the brand's elemental register (voice.md,
// Register 2): alchemy, the forge, metalwork, building in blocks, signal.
// None are shared with Claude Code's list.
export const SPINNER_VERBS = [
  'Distilling',
  'Refining',
  'Calcining',
  'Decanting',
  'Catalyzing',
  'Amalgamating',
  'Annealing',
  'Assaying',
  'Smelting',
  'Alloying',
  'Quenching',
  'Casting',
  'Hammering',
  'Welding',
  'Soldering',
  'Burnishing',
  'Etching',
  'Engraving',
  'Milling',
  'Machining',
  'Riveting',
  'Plating',
  'Anodizing',
  'Extruding',
  'Galvanizing',
  'Conducting',
  'Grounding',
  'Wiring',
  'Routing',
  'Relaying',
  'Signaling',
  'Tuning',
  'Calibrating',
  'Aligning',
  'Stacking',
  'Tiling',
  'Framing',
  'Scaffolding',
  'Keystoning',
  'Mortaring',
  'Assembling',
  'Interlocking',
  'Squaring',
  'Leveling',
  'Plumbing',
  'Surveying',
  'Charting',
  'Sounding',
  'Sieving',
  'Sifting',
  'Panning',
  'Prospecting',
  'Excavating',
  'Quarrying',
  'Kindling',
  'Stoking',
  'Firing',
  'Glazing',
  'Kilning',
  'Condensing',
  'Vaporizing',
  'Grafting',
  'Threading',
  'Spooling',
  'Binding',
  'Inscribing',
  'Encoding',
  'Compiling',
  'Indexing',
  'Parsing',
  'Resolving',
  'Reconciling',
  'Latticing',
]
