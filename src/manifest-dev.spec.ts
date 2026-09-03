import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);

interface ObrManifest {
    name: string;
    version: string;
    manifest_version: number;
    description: string;
    author: string;
    action: {
        title: string;
        icon: string;
        popover: string;
        width: number;
        height: number;
    };
    background_url: string;
    icon: string;
}

interface PkgManifest {
    devDependencies?: Record<string, string>;
    dependencies?: Record<string, string>;
}

function readJson(relativePath: string): unknown {
    const url = new URL(relativePath, root);
    return JSON.parse(fs.readFileSync(url, 'utf8')) as unknown;
}

function readText(relativePath: string): string {
    return fs.readFileSync(new URL(relativePath, root), 'utf8');
}

describe('dev manifest (public/manifest-dev.json)', () => {
    const prod = readJson('public/manifest.json') as ObrManifest;
    const dev = readJson('public/manifest-dev.json') as ObrManifest;

    it('should parse as valid JSON', () => {
        expect(dev).toBeTypeOf('object');
    });

    it('should have (DEV) in name and action title', () => {
        expect(dev.name).toContain('(DEV)');
        expect(dev.action?.title).toContain('(DEV)');
    });

    it('should pin a static dev version that sync:version never produces', () => {
        expect(dev.version).toBe('0.0.0-dev');
    });

    it('should keep an identical route structure to the prod manifest', () => {
        // Same entry points, resolved against the manifest origin (localhost in dev).
        expect(dev.manifest_version).toBe(prod.manifest_version);
        expect(dev.description).toBe(prod.description);
        expect(dev.author).toBe(prod.author);
        expect(dev.action?.icon).toBe(prod.action?.icon);
        expect(dev.action?.popover).toBe(prod.action?.popover);
        expect(dev.action?.width).toBe(prod.action?.width);
        expect(dev.action?.height).toBe(prod.action?.height);
        expect(dev.background_url).toBe(prod.background_url);
        expect(dev.icon).toBe(prod.icon);
    });

    it('should keep all asset paths under the shared base path', () => {
        for (const p of [dev.action?.icon, dev.action?.popover, dev.background_url, dev.icon]) {
            expect(p).toMatch(/^\/Owlbear5eTools\//);
        }
    });
});

describe('sync:version guard', () => {
    it('should never touch manifest-dev.json', () => {
        const script = readText('scripts/sync-version.mjs');
        expect(script).toContain('public/manifest.json');
        expect(script).not.toContain('manifest-dev');
    });
});

describe('vite dev-server config (vite.config.ts)', () => {
    const config = readText('vite.config.ts');

    it('should keep the prod base path untouched', () => {
        expect(config).toContain("base: '/Owlbear5eTools/'");
    });

    it('should enable the self-signed HTTPS plugin for serve only', () => {
        expect(config).toContain('plugin-basic-ssl');
        expect(config).toContain("command === 'serve'");
        // basicSsl() must only appear in the serve-gated branch, never unconditionally.
        expect(config).toMatch(/isServe \? \[basicSsl\(\)\]/);
    });

    it('should pin the dev server to a fixed HTTPS port', () => {
        expect(config).toContain('port: 5173');
        expect(config).toContain('strictPort: true');
    });

    it('should serve cross-origin (OBR fetches the manifest from the room page)', () => {
        expect(config).toContain('cors: true');
    });

    it('should declare the HTTPS plugin as a devDependency', () => {
        const pkg = readJson('package.json') as PkgManifest;
        expect(pkg.devDependencies?.['@vitejs/plugin-basic-ssl']).toBeDefined();
        expect(pkg.dependencies?.['@vitejs/plugin-basic-ssl']).toBeUndefined();
    });
});
