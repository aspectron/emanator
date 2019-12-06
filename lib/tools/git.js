const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const colors = require('colors');

const CACHE = { }
class Git {

	constructor(core, options) {
		this.core = core;
		this.folder = options.folder;
	}

	clone(repoURL, folder) {

		return new Promise(async (resolve,reject) => {

			mkdirp.sync(folder);

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

		    resolve();
		})
	}
}


exports.Resolver = (core) => {
	return async (version) => {
		return new Promise(async (resolve, reject) => {
			resolve(new Git(core, { }));
		})
	}
}
