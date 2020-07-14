const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const Module = require('../module');

let GOEXISTS = false;
const CACHE = { }
class Go extends Module {

	constructor(E, options) {
		this.E = E;
		this.folder = options.folder;

		let binExtension = E.PLATFORM == 'windows' ? '.exe' : '';

		if(GOEXISTS)
			this.BIN = 'go';
		else
			this.BIN = path.join(this.folder,`bin/go${binExtension}`);

		this.GOPATH = path.join(E.RELEASE,'go');
		this.SRC = path.join(E.RELEASE,'go/src');
		this.SRCGITHUB = path.join(E.RELEASE,'go/src/github.com');
		[this.GOPATH,this.SRC,this.SRCGITHUB].forEach(f => mkdirp.sync(f));
	}

	get(cwd) {
		console.log(`go get ${cwd}`);
		return this.E.utils.spawn(this.BIN,['get'], { cwd, stdio : 'inherit' });
	}

	build(cwd) {
		console.log(`go build ${cwd}`);
		return this.E.utils.spawn(this.BIN,['build'], { cwd, stdio : 'inherit' });
	}

	// getProjectVersion(vfile) {
	// 	let text = fs.readFileSync(vfile).toString();
	// }
}

const VERSION = async (E) => {
	try {
		let buffer = '';
		await E.utils .spawn('go',['version'], { stdio : 'pipe', stdout : (data) => {
			buffer += data.toString();
		}});
		let { version } = E.utils.match(buffer,/go\sversion\s(?<version>[\w\.]+)/);
		return version;
	} catch(ex) {
		console.log(`GO unable to detect version...`.magenta.bold);
		console.trace(ex);
		console.log(`GO attempting to continue...`.yellow.bold);
		return null;
	}
}

const FACTORY = (E, o) => {
	return new Promise(async (resolve,reject) => {
		let goArchiveExtension = E.PLATFORM == 'windows' ? 'zip' : 'tar.gz'

		let { folder, version, target } = o;

		let V = await VERSION(E);
		if(V) {
			E.log(`${V} detected`.bold,version?(`using this instead of requested`.magenta.bold,(version||'').bold):'');
			GOEXISTS = V;
			resolve();
			return;
		}

		let url = `https://dl.google.com/go/${version}.${E.PLATFORM}-amd64.${goArchiveExtension}`;
		let file = path.join(folder,`${version}.${goArchiveExtension}`);
		mkdirp.sync(folder);
		console.log(`fetching: ${file}`)
		await E.utils.download(url,file);
		await E.utils.unzip(file,folder);
		fs.renameSync(path.join(folder,'go'),path.join(folder,version));

		resolve();
	})
}


exports.Resolver = (E) => {
	return async (version) => {
		return new Promise(async (resolve, reject) => {
			E.log(`selecting go version`,`${version}`.bold);
			if(CACHE[version])
				return resolve(CACHE[version]);

			let folder = E.TOOLS;
			mkdirp(folder);
			let target = path.join(folder,version);
			if(!fs.existsSync(target))
				await FACTORY(E, { folder, target, version });

			resolve(new Go(E, { folder : target }));
		})
	}
}