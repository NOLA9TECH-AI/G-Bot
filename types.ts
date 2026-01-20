
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
  STEALTH = 'stealth',
  BLACK_DIAMOND = 'black_diamond'
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
  CYBER_BLUE = 'cyber_blue',
  SANGUINE = 'sanguine',
  PHOSPHOR = 'phosphor',
  DEEP_SEA = 'deep_sea',
  CRIMSON = 'crimson',
  VERIDIAN = 'veridian',
  GOLD_LEAF = 'gold_leaf',
  TOXIC_LIME = 'toxic_lime',
  ELECTRIC_VIOLET = 'electric_violet',
  SOLAR_ORANGE = 'solar_orange',
  NEON_PINK = 'neon_pink',
  NEURAL_WHITE = 'neural_white'
}

export enum EnvironmentType {
  NONE = 'none',
  NEURAL_VOID = 'neural_void',
  DATA_CORE = 'data_core',
  MECHA_HANGAR = 'mecha_hangar'
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
