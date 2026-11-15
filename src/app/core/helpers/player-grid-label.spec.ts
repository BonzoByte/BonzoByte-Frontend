import { compactPlayerGridLabel, playerGridFlagCode, playerGridLabel } from './player-grid-label';

describe('Shared player grid labels', () => {
    it('formats full labels and suppresses missing or zero metadata', () => {
        expect(playerGridLabel(' Wong Maximus Zavier ', 'sgp', null, '2097')).toBe('Wong Maximus Zavier (SGP) [2097]');
        expect(playerGridLabel('Hurkacz Hubert', 'POL', '3 BYE', '69')).toBe('Hurkacz Hubert (POL) (3 BYE) [69]');
        expect(playerGridLabel('Player', '0', '0.0', '0')).toBe('Player');
        expect(playerGridLabel('Player')).toBe('Player');
    });
    it('keeps compound surname prefixes when shortening names', () => {
        for (const [name, expected] of [['Wong Maximus Zavier', 'Wong'], ['De Minaur Alex', 'De Minaur'], ['De La Nava Daniel', 'De La Nava'], ['Van de Zandschulp Botic', 'Van de'], ['Bar Biryukov Petr', 'Bar Biryukov'], ['', '']]) {
            expect(compactPlayerGridLabel(name)).toBe(expected);
        }
    });
    it('does not repeat countries, seedings or ranks already included by older archives', () => {
        for (const [name, iso, seed, rank, expected] of [
            ['Auer Stefani [11] (AUT)', 'AUT', '11', '1334', 'Auer Stefani (AUT) (11) [1334]'],
            ['Glushkova Andreya (BGR)', 'BGR', '', '', 'Glushkova Andreya (BGR)'],
            ['Gabriel Anais [12] (CHE)', 'CHE', '12', '1378', 'Gabriel Anais (CHE) (12) [1378]'],
            ['Wirges Angelina [2] (DEU)', 'DEU', '2', '1039', 'Wirges Angelina (DEU) (2) [1039]'],
            ['Feldmane Daniela Darja [10] (LVA) (LVA) (10) [1303]', 'LVA', '10', '1303', 'Feldmane Daniela Darja (LVA) (10) [1303]'],
            ['Player ( sgp ) [ Q ]', 'SGP', 'Q', '42', 'Player (SGP) (Q) [42]'],
            ['Hurkacz Hubert (POL) (3 BYE) [69]', 'POL', '3 BYE', '69', 'Hurkacz Hubert (POL) (3 BYE) [69]'],
        ]) {
            expect(playerGridLabel(name, iso, seed, rank)).withContext(name).toBe(expected);
            expect(playerGridLabel(expected, iso, seed, rank)).withContext('reformatted ' + name).toBe(expected);
        }
    });
    it('preserves birth years and unconfirmed name qualifiers instead of stripping arbitrary brackets', () => {
        expect(playerGridLabel('Yazdani Mahsa (2008) (IRN)', 'IRN')).toBe('Yazdani Mahsa (2008) (IRN)');
        expect(playerGridLabel('Player (AUT) (2008)', 'AUT')).toBe('Player (2008) (AUT)');
        expect(playerGridLabel('Player (2008) (AUT)', 'AUT', null, '2008')).toBe('Player (2008) (AUT) [2008]');
        expect(playerGridLabel('Player [Q] (AUT)', 'AUT')).toBe('Player [Q] (AUT)');
        expect(playerGridLabel('Player (AUT)')).toBe('Player (AUT)');
        expect(playerGridLabel('Player (USA)', 'CAN')).toBe('Player (USA) (CAN)');
    });
    it('shares existing flag aliases and handles absent countries', () => {
        expect(playerGridFlagCode(' uk ')).toBe('GB');
        expect(playerGridFlagCode('SG')).toBe('SG');
        for (const code of ['', 'WD', 'WLD', 'XX', 'XW', '-']) expect(playerGridFlagCode(code)).toBe('UN');
    });
});
