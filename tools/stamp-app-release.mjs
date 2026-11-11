import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const meta = /[ \t]*<meta\s+name=["']bonzobyte-release["']\s+content=["'][a-f0-9]{64}["']\s*\/?>\r?\n?/gi;
const application = 'bonzobyte-frontend';

/** Stamp only a completed frontend build. Tennis data/archive changes are intentionally excluded. */
export function stampAppRelease(directory) {
    const root = fs.realpathSync(directory);
    const file = name => {
        const target = path.join(root, name), info = fs.lstatSync(target);
        if (!info.isFile() || info.isSymbolicLink() || !fs.realpathSync(target).startsWith(root + path.sep)) throw Error('Expected regular build file: ' + name);
        return target;
    };
    const indexPath = file('index.html'), original = fs.readFileSync(indexPath, 'utf8');
    const index = original.replace(meta, '');
    if (!/<\/head>/i.test(index) || !/<app-root(?:\s|>)/i.test(index)) throw Error('Expected completed BonzoByte index.');
    const code = fs.readdirSync(root).filter(name => /\.(?:js|css)$/.test(name)).sort();
    if (!code.some(name => /^main(?:[.-].*)?\.js$/.test(name))) throw Error('Completed main bundle is missing.');
    const inputs = [...code];
    const translations = path.join(root, 'assets/i18n');
    if (fs.existsSync(translations)) {
        if (fs.lstatSync(translations).isSymbolicLink()) throw Error('Unexpected translation directory link.');
        inputs.push(...fs.readdirSync(translations).filter(name => name.endsWith('.json')).sort().map(name => 'assets/i18n/' + name));
    }
    const digest = createHash('sha256').update('bonzobyte-frontend-release-v1\0').update(index);
    for (const name of inputs) digest.update('\0' + name + '\0').update(fs.readFileSync(file(name)));
    const release = digest.digest('hex');
    const manifestPath = path.join(root, 'app-version.json');
    if (fs.existsSync(manifestPath)) {
        const old = JSON.parse(fs.readFileSync(file('app-version.json'), 'utf8'));
        if (old.application !== application || old.schemaVersion !== 1) throw Error('Refusing to replace an unrelated manifest.');
    }
    const manifest = { schemaVersion: 1, application, release };
    function replace(target, contents) {
        const temporary = target + '.tmp-' + randomUUID();
        try { fs.writeFileSync(temporary, contents, { flag: 'wx' }); fs.renameSync(temporary, target); }
        finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    }
    replace(indexPath, index.replace(/<\/head>/i, `<meta name="bonzobyte-release" content="${release}">\n</head>`));
    replace(manifestPath, JSON.stringify(manifest) + '\n');
    return { ...manifest, filesHashed: inputs.length, directory: root };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const output = path.resolve(process.argv[2] || 'dist/frontend/browser');
    const dist = path.join(project, 'dist') + path.sep;
    if (!output.startsWith(dist) || !fs.realpathSync(output).startsWith(fs.realpathSync(path.join(project, 'dist')) + path.sep))
        throw Error('Release stamping is restricted to this frontend project\'s dist folder.');
    console.log(JSON.stringify(stampAppRelease(output)));
}
