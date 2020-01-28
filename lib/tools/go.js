const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');

let GOEXISTS = false;
const CACHE = { }
class Go {

	constructor(core, options) {
		this.core = core;
		this.folder = options.folder;

		let binExtension = core.PLATFORM == 'windows' ? '.exe' : '';

		if(GOEXISTS)
			this.BIN = 'go';
		else
			this.BIN = path.join(this.folder,`bin/go${binExtension}`);

		this.GOPATH = path.join(core.RELEASE,'go');
		this.SRC = path.join(core.RELEASE,'go/src');
		this.SRCGITHUB = path.join(core.RELEASE,'go/src/github.com');
		[this.GOPATH,this.SRC,this.SRCGITHUB].forEach(f => mkdirp.sync(f));
	}

	get(cwd) {
		console.log(`go get ${cwd}`);
		return this.core.utils.spawn(this.BIN,['get'], { cwd, stdio : 'inherit' });
	}

	build(cwd) {
		console.log(`go build ${cwd}`);
		return this.core.utils.spawn(this.BIN,['build'], { cwd, stdio : 'inherit' });
	}

	// getProjectVersion(vfile) {
	// 	let text = fs.readFileSync(vfile).toString();
	// }
}

const VERSION = async (core) => {
	try {
		let buffer = '';
		await core.utils.spawn('go',['version'], { stdio : 'pipe', stdout : (data) => {
			buffer += data.toString();
		}});
		let { version } = core.utils.match(buffer,/go\sversion\s(?<version>[\w\.]+)/);
		return version;
	} catch(ex) {
		console.log(`GO unable to detect version...`.magenta.bold);
		console.trace(ex);
		console.log(`GO attempting to continue...`.yellow.bold);
		return null;
	}
}

const FACTORY = (core, o) => {
	return new Promise(async (resolve,reject) => {
		let goArchiveExtension = core.PLATFORM == 'windows' ? 'zip' : 'tar.gz'

		let { folder, version, target } = o;

		let V = await VERSION(core);
		if(V) {
			core.log(`${V} detected`.bold,version?(`using this instead of requested`.magenta.bold,(version||'').bold):'');
			GOEXISTS = V;
			resolve();
			return;
		}

		let url = `https://dl.google.com/go/${version}.${core.PLATFORM}-amd64.${goArchiveExtension}`;
		let file = path.join(folder,`${version}.${goArchiveExtension}`);
		mkdirp.sync(folder);
		console.log(`fetching: ${file}`)
		await core.utils.download(url,file);
		await core.utils.unzip(file,folder);
		fs.renameSync(path.join(folder,'go'),path.join(folder,version));

		resolve();
	})
}


exports.Resolver = (core) => {
	return async (version) => {
		return new Promise(async (resolve, reject) => {
			core.log(`selecting go version`,`${version}`.bold);
			if(CACHE[version])
				return resolve(CACHE[version]);

			let folder = core.TOOLS;
			mkdirp(folder);
			let target = path.join(folder,version);
			if(!fs.existsSync(target))
				await FACTORY(core, { folder, target, version });

			resolve(new Go(core, { folder : target }));
		})
	}
}