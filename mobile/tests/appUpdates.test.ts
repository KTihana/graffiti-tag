import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNewerVersion, parseRelease } from '../src/services/appUpdates';
test('compares numeric versions and never suggests downgrading', () => {
  assert.equal(isNewerVersion('1.0.10', '1.0.3'), true);
  assert.equal(isNewerVersion('2.0.0', '1.9.9'), true);
  for (const value of ['1.0.3', '1.0.2', '1.0.4-beta', 'bad']) assert.equal(isNewerVersion(value, '1.0.3'), false);
});
test('only accepts published personal APKs from this repository', () => {
  const data = { tag_name: 'v1.0.4-personal', body: 'New changes', assets: [{ name: 'graffiti-tag-personal.apk', browser_download_url: 'https://github.com/KTihana/graffiti-tag/releases/download/v1.0.4-personal/graffiti-tag-personal.apk' }] };
  assert.equal(parseRelease(data).version, '1.0.4');
  for (const invalid of [null, { ...data, prerelease: true }, { ...data, draft: true }, { ...data, assets: [] }, { ...data, tag_name: 'v1.0.4' }, { ...data, assets: [{ name: 'graffiti-tag-personal.apk', browser_download_url: 'https://example.com/app.apk' }] }]) assert.throws(() => parseRelease(invalid));
});
