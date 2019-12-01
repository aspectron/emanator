const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const colors = require('colors');

const CACHE = { }
class Git {

	constructor(core, options) {
		this.core = core;
		this.folder = options.folder;

		// let binExtension = core.PLATFORM == 'windows' ? '.exe' : '';

		// this.BIN = path.join(this.folder,`bin/go${binExtension}`);

		// this.GOPATH = path.join(core.RELEASE,'go');
		// this.SRC = path.join(core.RELEASE,'go/src');
		// this.SRCGITHUB = path.join(core.RELEASE,'go/src/github.com');
		// [this.GOPATH,this.SRC,this.SRCGITHUB].forEach(f => mkdirp(f));
	}


	clone(repoURL, folder) {

		return new Promise(async (resolve,reject) => {
			// console.log(`git clone ${repo} to ${folder}`);
			// return this.core.utils.spawn('git',['clone',repo], { cwd : folder, stdio : 'inherit' });
		    // console.log(process.stdout);

			mkdirp(folder);

			let repo = path.basename(repoURL).replace(/\.git$/ig,'');
			let dest = path.join(folder,repo);

		    if(!fs.existsSync(dest)) {
		        await this.core.utils.spawn('git',['clone',repoURL], {
		            cwd : folder, stdio : 'inherit', resetTTY : true
		        })
		    }
		    else {
		        await this.core.utils.spawn('git',['fsck'], {
		            cwd : dest, stdio : 'inherit', resetTTY : true
		        })
		        await this.core.utils.spawn('git',['pull'], {
		            cwd : dest, stdio : 'inherit', resetTTY : true
		        })
		    }

		    colors.enabled = true;

		    // console.log(process.stdout);
		    // process.exit(1);

		    resolve();
		})

	}

}

/*
const getCompiler = (core, o) => {
	return new Promise(async (resolve,reject) => {
		// download
		// unpack
console.log("getCompiler args:",o);

		let goArchiveExtension = core.PLATFORM == 'windows' ? 'zip' : 'tar.gz'

		let { folder, version, target } = o;
		let url = `https://dl.google.com/go/${version}.${core.PLATFORM}-amd64.${goArchiveExtension}`;
		let file = path.join(folder,`${version}.${goArchiveExtension}`);
		console.log(`fetching: ${file}`)
		await core.util.download(url,file);
		await core.util.unzip(file,folder);
		fs.renameSync(path.join(folder,'go'),path.join(folder,version));

		resolve();
	})
}*/


exports.Resolver = (core) => {
	return async (version) => {
		return new Promise(async (resolve, reject) => {

			resolve(new Git(core, { }));
		})
	}
}