export const difficulties = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'] as const;
export type Difficulty = typeof difficulties[number];
