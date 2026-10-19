import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = path.join(root, 'android');
const home = homedir();
const env = { ...process.env };
const defaultJava = '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
const defaultSdk = path.join(home, 'Library', 'Android', 'sdk');

if (!env.JAVA_HOME && process.platform === 'darwin') env.JAVA_HOME = defaultJava;
if (!env.ANDROID_HOME) env.ANDROID_HOME = defaultSdk;
if (!env.ANDROID_SDK_ROOT) env.ANDROID_SDK_ROOT = env.ANDROID_HOME;

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const webProject = path.resolve(root, '..', 'mobile');
run(process.execPath, [path.join(webProject, 'scripts', 'build-personal-web.mjs')], webProject);
run(process.execPath, ['scripts/copy-web.mjs']);
run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['cap', 'sync', 'android']);
run(process.execPath, ['scripts/copy-launcher-icon.mjs']);

const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
run(gradle, ['assembleDebug'], androidDir);

const builtApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const outputDir = path.join(root, 'artifacts');
const outputApk = path.join(outputDir, 'graffiti-tag-personal-debug.apk');
await mkdir(outputDir, { recursive: true });
await copyFile(builtApk, outputApk);
const digest = createHash('sha256').update(await readFile(outputApk)).digest('hex');
console.log(`Debug APK ready: ${path.relative(root, outputApk)}`);
console.log(`SHA-256: ${digest}`);
