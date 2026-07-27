export const PROJECT_SOURCES = ['campfire', 'makuake', 'green_funding'] as const;

export type ProjectSource = typeof PROJECT_SOURCES[number];
