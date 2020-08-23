# EMANATOR

Deploy your HTML5 web or desktop applications with ease.  Emanator can help you create custom project integration processes to deploy HTML5 web applications as well as standalone desktop applications using NWJS. 

In addition to being an exceptionally useful tool for day-to-day utilities, emanator offers following application build targets:

- Windows
  - Portable `ZIP` archive (Nodejs)
  - Portable `ZIP` archive (NWJS)
  - [InnoSetup 6](https://jrsoftware.org/isdl.php) EXE installer (NWJS)

- Linux
  - Portable `ZIP` archive (Nodejs)
  - Portable `ZIP` archive (NWJS)

- Mac OS
  - Portable `ZIP` archive (Nodejs)
  - Portable `ZIP` archive (NWJS)
  - DMG disk image installer

Some of the key features of the Emanator include:

- Task-driven approach to create sequential or parallel execution pipelines.
- Async-oriented environment
- Instant access to modules included with the Emanator (see below), while also being able to use local *node_modules* included within your project (if any)
- Convenient shell access as well as utility functions allowing you to download, extract, compress and perform variety of other operations usually needed in build processes.

---

## Installation

Emanator requires minimum Nodejs 14. You can install emanator as follows:

`npm install -g emanator`

## Command Line Flags

- `--version` - Prints currently installed version of the emanator.
- `--clean` - Erase temporary folders and cache before starting the build process
- `--serve` - Starts HTTP server serving current folder as static files. When `--serve` is specified, you can use `--port=8080` to bind the server to a specific port (default `8080`) and `--host=*` (or `--host=0.0.0.0`) to bind the server to all interfaces.

### Windows-specific Flags
- `--innosetup` - build InnoSetup installer
- `--nopackage` - skip archival process if forced in the Emanator constructor options
- `--sign` - sign the InnoSetup installer with your PFK

## EMANATE Scripts

Emanate script should be located in the root of your project with the file named `EMANATE` or `.emanate`.

Before invoking the Emanate script, Emanator preloads various modules and invokes the script inside of an `async` function.  This wrapping provides instant access to various preloaded modules as well as removes the requirement to define custom async wrapper (typically done in async Nodejs applications). 

### Prerequisites

Documentation on this site assumes that you are running under unix-compatible OS (i.e have acces to bash shell). If you are running Windows, it is recommended to install [MSys2](https://www.msys2.org/), [Git for Windows](https://git-scm.com/download/win) or similar suites.

### A barebone EMANATE script


```js
const E = new Emanator();
const version = E.flags.version || 'v14.8.8`;
const folder = `node-${version}-${E.PLATFORM_ARCH}`;
const file = `${folder}.${E.NODE_ARCHIVE_EXTENSION}`;
await E.download(`https://nodejs.org/dist/${version}/${file}`, E.TEMP);
await E.decompress(path.join(E.TEMP,file), E.HOME);
await E.spawn([`${path.join(E.HOME,folder,'bin',E.BINARY('node')}`,``],{ cwd });
```



## Emanator node_module handling

When running Emanate scripts, Emanator adds a local `node_modules` folder as the first entry in the `require()` search path.  Subsequently, before performing a standard require() module search/resolution, modules will be searched for in a local `node_modules`.

## Globals

### `flags`

`flags` is a javascript object generated from command line arguments as follows:
- presence of a simple flag with `--` prefix such as `--some-option` will be treated as a boolean
- presence of an assignment such as `--version=1.5` will be available as a string
Example: `emanate --optimize --version=1.5` will yield the following *flags* object:
```js
{
    "optimize" : true,
    "version" : "1.5"
}
```

### `argv`

`argv` is an array of command-line arguments supplied to the Emanator when running emanate scripts.  For example: running `emanate build package` will yield *argv* as `['build','package']`

### Native Nodejs Modules and Functions

- `exec(command[, options][, callback])`
- `execSync(command[, options])`
- `execFile(file[, args][, options][, callback])`
- `_spawn(command[, args][, options])` (alias for native `child_process.spawn()`)
- `process`
- `os`
- `path`
- `setInterval`
- `clearInterval`
- `setTimer`
- `clearTimer`

### Extended Nodejs Modules

- `fs` - Global `fs` object is a composite of the Nodejs `fs` module as well as `fs-extra` module.  In addition to integrated `fs` module functions, `fs-extra` brings in the following methods: https://github.com/jprichardson/node-fs-extra#methods
- `mkdirp` - `mkdirp` module for recursive directory create
- `colors` - Emanator allows the use of ansi terminal colors via the `colors` module - https://github.com/Marak/colors.js


## Emanator Interface

```js
const E = new Emanator(__dirname, {
	type : 'NWJS',
	guid : 'c5072045-6d98-44d8-9aa5-e9be6c79bd01',
	group : 'MyWindowsStartMenuGroup',
	ident : 'my-app',
	title : 'My App',
	banner : 'my app',
	git : 'git@github.com:my-org/my-app',
	author : "My Inc.",
	url : "http://my-site.com",
	archive : true,
	production: true,
	nwjs : { version : '0.46.2', ffmpeg : true },
	resources : 'resources/setup',
	skipDirCreation:true,
	manifest:manifest=>{
		return manifest;
	}
});
```
 
### Option Object

|Property|Description|
|---|---|
|`type`|should contain one of the following reserved project types: `NODE`, `NWJS`, `UTIL`, `DOC`; if used for utility purposes, can contain any user-defined type.|
|`guid`|should contain a project GUID that will be used to identify the applicaton on Windows.  For example: `c5012045-6a98-44d8-9a85-e9be6379bd01`|
|`group`|Windows *Start Menu* folder in which your application will reside|
|`ident`|Application identifier `my-app`
|`title`|'My App'|
|`banner`|'my app'|
|`git`|'git@github.com:my-org/my-app'|
|`author`|"My Inc."|
|`url`|http://my-site.com,
|`archive`||
|`production`||
|`nwjs`| should contain required NWJS installer version. For example: ` nwjs : { version : '0.46.2', ffmpeg : true }`. If `ffmpeg` property is set to `true` Emanator will download and overwrite ffmpeg shared libraries included as a part of NWJS **with GPL-licensed ffmpeg libraries**.|
|`resources`|should point to resource folder containing resources needed by Installers (images, icons etc)|
|`manifest`|can be set to a custom function receiving and returning the project manifest data. The function has the following signature: `(manifest) => { return manifest; }`. This function is useful to modify project manifest (for example, include extra node module dependencies) during the build process.|


# Emanator task pipeline

Emanator offers creation of multiple inter-dependent tasks that can be executed asynchronously if various integration stages are independent of one another.

### `task(name, options[, dependencies])




## Control functions

## `manifest_read_sync()`

Read the project manifest file (`package.json`) synchronously, making the contents accessible as an object under `E.pkg` property. This is useful when contents of the `package.json` are required before execution of a pipeline.

## Constants
|Constant|Description|
|---|---|
|`ident`|Project identifier (used in archive file and folder names)|
|`type`|Project type. Currently used `NODE`,`NWJS`,`UTIL`|
|`PROJECT_VERSION`|Version of the project used to initialize the Emanator object.|
|`PLATFORM`|Target platform identifier: `windows`, `linux`, `darwin`|
|`ARCH`|Target architexture identifier: `x64`, `arm7`|
|`PLATFORM_ARCH`||
|`BINARY_EXT`|Set to `'.exe'` on Windows, otherwise an empty string `''` |
|`WINCMD_EXT`|Set to `'.cmd'` on Windows, otherwise an empty string `''`|
|`PLATFORM_PATH_SEPARATOR`|Platform-specific path delimiter (`/` on Unix-compatible OS, '\' on Windows)|
|`DMG_APP_NAME`||
|`DMG_APP_NAME_ESCAPED`||
|`NODE_VERSION`|Currently running Node version|
|`NWJS_VERSION`|Project-configured NWJS version|
|`NPM`|npm script location|
|`HOME`|Absolute path to the current user home folder|
|`NWJS_ARCHIVE_EXTENSION`|OS-specific archive extension used in NWJS releases|
|`NODE_ARCHIVE_EXTENSION`|OS-specific archive extension used in Nodejs releases|
		

## Variables

### `flags`
### `argv`

## Functions

### `BINARY(filename)`

Return Value:

- Unix: returns `filename` unchanged
- Windows: appends `.exe` to the filename

### `download(url, folder)`

Downloads a file at the destination URL to a folder.  Downloaded filename is derived from the URL.

### `extract(from,to)`

Extracts archive to the destination folder based on file extension.
#### TAR files:
Uses `tar` to extract. (Requires unix compatibility layer on Windows)

#### ZIP files:
- Windows: uses [AdmZip](https://www.npmjs.com/package/adm-zip) (no progress)
- Unix: uses `unzip`

### `spawn(command[, args][, options])`
- command <string> The command to run.
- args <string[]> List of string arguments.
- options <Object>
- Returns: Promise (child process termination)

Spawns a child process. Returns a promise that will be resolved upon the child process termination. 

This function is an async wrapper of the native Nodejs Child Process `spawn()` function with following differences:
- `options` object can contain `stdout` property referencing a function that will receive process stdout output.


- First element of the `arguments` parameter must be the porocess filename.

Options:
- `stdout` : 

Example:
```
await E.spawn(['node','-v'])
```

### `exec()`
### `copy()`
### `move()`
### `remove()`
### `emptyDir()`
### `mkdirp()`
### `ensureDir()`
### `addToPath()`

## Folders

|Property|Description|
|---|---|
|`RELEASE`||
|`TOOLS`||
|`DEPS`||
|`SETUP`||
|`ROOT`||
|`TEMP`||
|`DMG`||
|`REPO`||

## Nodejs Integration Pipeline
- `init`
- `manifest-read`
- `create-folders`
- `manifest-write`
- `npm-install`
- `npm-update`
- `node-modules`
- `node-binary`
- `origin`

## NWJS Integration Pipeline
- `init`
- `manifest-read`
- `create-folders`
- `manifest-write`
- `npm-install`
- `npm-update`
- `nwjs-sdk-download`
- `nwjs-ffmpeg-download`
- `nwjs-download`
- `nwjs-sdk-unzip`
- `nwjs-ffmpeg-unzip`
- `nwjs-unzip`
- `unlink-nwjs-app`
- `nwjs-copy`
- `nwjs-ffmpeg-copy`
- `nwjs-cleanup`
- `node-modules`
- `node-binary`
- `origin`

## Modules
### `7z`
Provides interface to the 7z archiver, provides functions for compression and decompression using 7z
### `ares`
### `docker`
### `gcc`
### `git`
### `go`
### `npm`
### `nwjc`
### `nwjs`


## Utility functions
### `log`
### `getDirFiles`
### `zipFolder`
### `getConfig`
### `asyncMap`
### `fileHash`
### `whereis`
### `glob`
### `iterateFolder`
### `replicateFile`
### `matchFiles`


## Platform targets
### Linux
### Windows
### Mac OS


