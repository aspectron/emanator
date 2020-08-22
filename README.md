# EMANATOR

---


## Command Line Flags


- `--clean` - Erase temporary folders and cache before starting the build process
- `--serve` - Starts HTTP server serving current folder as static files. When `--serve` is specified, you can use `--port=8080` to bind the server to a specific port (default `8080`) and `--address=*` to bind the server to all interfaces.


### Windows-specific Flags
- `--innosetup`
- `--nopackage` 
- `--sign`


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

|Function|Description|
|---|---|
|`exec(command[, options][, callback])`|Imported from Nodejs `child_process` module.|
|`execSync(command[, options])`|Imported from Nodejs `child_process` module.|
|`execFile(file[, args][, options][, callback])`|Imported from Nodejs `child_process` module.|
|`_spawn(command[, args][, options])`|Imported from Nodejs `child_process` module.|
|`process`|Global Nodejs process object running Emanate script.|
|`fs`|Global `fs` object is a composite of the Nodejs `fs` module as well as `fs-extra` module.  In addition to integrated `fs` module functions, `fs-extra` brings in the following methods: https://github.com/jprichardson/node-fs-extra#methods|
|`os`|Nodejs `os` module|
|`path`|Nodejs `path` module|
|`mkdirp`|`mkdirp` module for recursive directory creation|
|`colors`|Emanator allows the use of ansi terminal colors via the `colors` module - https://github.com/Marak/colors.js|
|`setInterval`|Javascript native function `setInterval()`.|
|`clearInterval`|Javascript native function `clearInterval()`.|
|`setTimer`|Javascript native function `setTimer()`.|
|`clearTimer`|Javascript native function `clearTimer()`.|

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


# Emanator task pipeline

Emanator offers creation of multiple inter-dependent tasks that can be executed asynchronously if various integration stages are independent of one another.

### `task(name, options[, dependencies])


## Control functions

## `manifest_read_sync()`

## Constants

### `ident`
### `type`
### `PROJECT_VERSION`
### `NODE_VERSION`
### `PLATFORM`
### `ARCH`
### `PLATFORM_ARCH`
### `BINARY_EXT`
### `WINCMD_EXT`
### `PLATFORM_PATH_SEPARATOR`
### `DMG_APP_NAME`
### `DMG_APP_NAME_ESCAPED`
### `NODE_VERSION`
### `NWJS_VERSION`
### `BINARIES_ARCHIVE_EXTENSION`
### `NPM`

### `HOME`
### `NWJS_ARCHIVE_EXTENSION`
### `NODE_ARCHIVE_EXTENSION`
		

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
### ``
### `RELEASE`
### `TOOLS`
### `DEPS`
### `SETUP`
### `ROOT`
### `TEMP`
### `DMG`
### `REPO`
### ``
### ``
### ``
### ``
### ``

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


