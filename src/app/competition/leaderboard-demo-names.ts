// Display-only aliases for seeded demo accounts. Never rename an account or change its score.
const aliases = [
    'Ace', 'Mira', 'Baseline Explorer', 'Luka North', 'Quiet Court Analyst',
    'Nika', 'The Patient Returner', 'Spin Doctor', 'Tennis After Midnight', 'Rio',
    'Clay Court Dreamer', 'Marta Moon', 'Break Point Collector', 'Kai', 'Second Serve Society',
    'Elena Blue', 'The Unhurried Baseline Observer', 'Noa', 'Lucky Net Cord', 'Weekend Rally Club'
] as const;

export function leaderboardDemoName(nickname: string): string {
    const match = /^user(0[1-9]|1[0-9]|20)$/i.exec(nickname);
    return match ? aliases[Number(match[1]) - 1] : nickname;
}
