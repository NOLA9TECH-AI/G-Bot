
export enum MessageRole {
  USER = 'user',
  BOT = 'bot',
  SYSTEM = 'system'
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  imageUrl?: string;
  isStreaming?: boolean;
  sources?: GroundingSource[];
}

export enum RobotStyle {
  CYBER = 'cyber',
  STREET = 'street',
  GOLD = 'gold',
  STEALTH = 'stealth'
}

export enum ArtStyle {
  STREET = 'street',
  REALISM = 'realism',
  ANIME = 'anime',
  OIL = 'oil',
  SKETCH = 'sketch',
  VAPORWAVE = 'vaporwave',
  PIXEL = 'pixel',
  COMIC = 'comic',
  RENDER = 'render',
  CLAY = 'clay'
}

export enum SystemTheme {
  CYBERPUNK = 'cyberpunk',
  HOOD = 'hood',
  TOXIC = 'toxic',
  FROST = 'frost',
  BLOOD = 'blood',
  VOID = 'void',
  SUNSET = 'sunset',
  EMERALD = 'emerald',
  MIDNIGHT = 'midnight',
  PHANTOM = 'phantom',
  ONYX = 'onyx',
  NEBULA = 'nebula',
  GHOST = 'ghost',
  CARBON = 'carbon',
  VULCAN = 'vulcan',
  COBALT = 'cobalt',
  TITAN = 'titan',
  CRIMSON = 'crimson',
  MAGMA = 'magma',
  COBALT_STRIKE = 'cobalt_strike',
  NEON_BONE = 'neon_bone',
  NIGHTSHADE = 'nightshade',
  SULFUR = 'sulfur',
  NOIR_COMIC = 'noir_comic',
  VIGILANTE = 'vigilante',
  PULP_FICTION = 'pulp_fiction',
  MUTANT_X = 'mutant_x',
  COSMIC_RAYS = 'cosmic_rays',
  STORM_GRAY_BLUE = 'storm_gray_blue',
  SANGUINE_NOIR = 'sanguine_noir',
  SLATE_PHOSPHOR = 'slate_phosphor',
  DEEP_TRENCH = 'deep_trench',
  CRIMSON_SHADOW = 'crimson_shadow',
  INK_VERIDIAN = 'ink_veridian'
}

export enum EnvironmentType {
  NONE = 'none',
  NEURAL_VOID = 'neural_void',
  CYBER_DISTRICT = 'cyber_district',
  DATA_CORE = 'data_core',
  SYNTH_HORIZON = 'synth_horizon',
  MECHA_HANGAR = 'mecha_hangar',
  NEO_TOKYO = 'neo_tokyo'
}

export enum RobotAnimation {
  IDLE = 'Idle',
  WALKING = 'Walking',
  RUNNING = 'Running',
  DANCE = 'Dance',
  WAVE = 'Wave',
  JUMP = 'Jump',
  SITTING = 'Sitting',
  STANDING = 'Standing',
  YES = 'Yes',
  NO = 'No',
  PUNCH = 'Punch',
  THUMBSUP = 'ThumbsUp',
  DEATH = 'Death',
  CELEBRATE = 'Celebrate',
  PONDER = 'Ponder',
  ALERT = 'Alert',
  SHUTDOWN = 'Shutdown',
  FLEX = 'Flex',
  SHOCK = 'Shock',
  SULK = 'Sulk',
  GREET = 'Greet',
  // Dance Module
  DANCE_ROBOT = 'Dance_Robot',
  DANCE_BREAKDANCE = 'Dance_Breakdance',
  DANCE_FLOSS = 'Dance_Floss',
  DANCE_SHUFFLE = 'Dance_Shuffle',
  DANCE_GROOVE = 'Dance_Groove'
}

export enum RobotVisualMood {
  NONE = 'none',
  TALKING = 'talking',
  LOADING = 'loading',
  DANCING = 'dancing',
  PAINTING = 'painting',
  HAPPY = 'happy',
  ANGRY = 'angry',
  SAD = 'sad',
  CURIOUS = 'curious',
  EXCITED = 'excited'
}
