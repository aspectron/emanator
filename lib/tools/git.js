const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const colors = require('colors');

const CACHE = { }
class Git {

	constructor(core, options) {
		this.core = core;
		this.folder = options.folder;

		this.args = this.core.utils.args();
	}

	clone(url, folder, target) {
		// console.log("url",url,"folder",folder);
		return new Promise(async (resolve,reject) => {

			mkdirp.sync(folder);

			let repo = path.basename(url).replace(/\.git$/ig,'');
			target = target || repo;
			let dest = path.join(folder,target);
			mkdirp.sync(folder);
			// console.log("GIT dest:",dest);

			if(this.args['--no-ssh'] || this.args['--http'] || this.args['--https']) {
				let { base, address, organization, project } = this.utils.match(url,/(?<base>(git@|\w+@|https:\/\/)(?<address>[\w-]+\.\w+)[:\/])(?<organization>[\w]+)\/(?<project>[\w]+)(\.git)?/);
				if(base && address && organization && project) {
					url = `https://${address}/${organization}/${project}`;
				}
			}

			// console.log("GIT repo:",repo);
			// console.log("GIT target:",target);
		    if(!fs.existsSync(dest)) {
		    	let args = ['clone',url];
		    	if(target != repo)
		    		args.push(target);
		    // console.log('cloning...');
			// console.log("GIT args:",args);
		        await this.core.utils.spawn('git',args, {
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
