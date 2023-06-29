const path = require('path');
const fs = require('fs');
const { mkdirp } = require('mkdirp');
const Module = require('../module');

let CARGO_EXISTS = false;
const CACHE = { }
class Cargo extends Module {

	constructor(E, options) {
		super(E);
		this.folder = options.folder;

		let binExtension = E.PLATFORM == 'windows' ? '.exe' : '';

		//if(CARGO_EXISTS)
			this.BIN = 'cargo';
		//else
		//	this.BIN = path.join(this.folder,`bin/go${binExtension}`);

		this.RUSTPATH = path.join(E.RELEASE,'rust');
		this.SRC = path.join(E.RELEASE,'rust/src');
		this.SRCGITHUB = path.join(E.RELEASE,'rust/src/github.com');
		[this.RUSTPATH, this.SRC, this.SRCGITHUB].forEach(f => mkdirp.sync(f));
	}

	get(cwd) {
		console.log(`cargo get ${cwd}`);
		return this.E.utils.spawn(this.BIN, ['get'], { cwd, stdio : 'inherit' });
	}

	build(cwd, args={}) {
        let params = ['build'];
        if(args.release)
            params.push("--release");

        Object.entries(args).forEach(([k, v])=>{
            if(k=='release')
                return
            if(k.length == 1){
                k = `-${k}`;
            }else{
                k = `--${k}`;
            }
            if(v === true){
                params.push(k)
                return
            }
            if(Array.isArray(v)){
                v.forEach(_v=>{
                    params.push(k);
                    params.push(_v);
                })
                return
            }
            params.push(k)
            params.push(v);

        })

		console.log(`cargo build ${cwd}`, params);
		return this.E.utils.spawn(this.BIN, params, { cwd, stdio : 'inherit' });
	}

    buildRelease(cwd, args={}){
        args.release = true;
        return this.build(cwd, args)
    }
}

const VERSION = async (E) => {
	try {
		let buffer = '';
		await E.utils.spawn('cargo', ['version'], { stdio : 'pipe', stdout : (data) => {
			buffer += data.toString();
		}});
		let { version } = E.utils.match(buffer, /cargo\s(?<version>[\w\.]+)/);
        return version;
	} catch(ex) {
		console.log(`cargo unable to detect version...`.magenta.bold);
		console.trace(ex);
		console.log(`cargo attempting to continue...`.yellow.bold);
		return null;
	}
}

const FACTORY = (E, o) => {
	return new Promise(async (resolve,reject) => {
		//let goArchiveExtension = E.PLATFORM == 'windows' ? 'zip' : 'tar.gz'

		let { folder, version, target } = o;

		let V = await VERSION(E);
		if(V) {
            if(V != version)
			    E.log(`cargo ${V} detected`.bold, version? `using this instead of requested ${version||''}`:'');
			CARGO_EXISTS = V;
			resolve();
			return;
		}

        /*
		let url = `https://dl.google.com/go/${version}.${E.PLATFORM}-amd64.${goArchiveExtension}`;
		let file = path.join(folder,`${version}.${goArchiveExtension}`);
		mkdirp.sync(folder);
		console.log(`fetching: ${file}`)
		await E.utils.download(url,file);
		await E.utils.unzip(file,folder);
		fs.renameSync(path.join(folder,'go'),path.join(folder,version));
        */
		reject(`\n\nPlease install Cargo#${version}\n\n`);
	})
}


exports.Resolver = (E) => {
	return async (version) => {
		return new Promise(async (resolve, reject) => {
			E.log(`selecting cargo version`,`${version}`.bold);
			if(CACHE[version])
				return resolve(CACHE[version]);

			let folder = E.TOOLS;
			mkdirp(folder);
			let target = path.join(folder,version);
			if(!fs.existsSync(target))
				await FACTORY(E, { folder, target, version });

			resolve(new Cargo(E, { folder : target }));
		})
	}
}