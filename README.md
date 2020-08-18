# EMANATOR

---


## Command Line Flags


- `--clean` - Erase temporary folders and cache before starting the build process
- `--serve` - Starts HTTP server serving current folder as static files. When `--serve` is specified, you can use `--port=8080` to bind the server to a specific port (default `8080`) and `--address=*` to bind the server to all interfaces.


### Windows-specific Flags
- `--innosetup`
- `--nopackage` 
- `--sign`


### EMANATE Scripts


## Emanator Interface

```
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

## Variables

### `flags`
### `argv`

## Functions

### `download()`
### `extract()`
### `spawn()`
### `exec()`
### `copy()`
### `move()`
### `remove()`
### `emptyDir()`
### `mkdirp()`
### `ensureDir()`
### `addToPath()`

## Available Nodejs modules
### ``
### ``
### ``
### ``
### ``
### ``
### ``
### ``
### ``
### ``
### ``
### ``

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


