
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
  MIDNIGHT = 'midnight'
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
  // Semantic Mappings
  CELEBRATE = 'Celebrate',
  PONDER = 'Ponder',
  ALERT = 'Alert',
  SHUTDOWN = 'Shutdown',
  FLEX = 'Flex',
  SHOCK = 'Shock',
  SULK = 'Sulk',
  GREET = 'Greet'
}

export enum RobotVisualMood {
  NONE = 'none',
  TALKING = 'talking',
  LOADING = 'loading',
  DANCING = 'dancing',
  PAINTING = 'painting'
}
