const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const colors = require('colors');
const Module = require('../module');


const CACHE = { }

class Git extends Module {

	constructor(E, options) {
		super(E);
		this.folder = options.folder;
		this.utils = E.utils;
		this.args = this.E.utils.args();
	}

	clone(url, folder, options = { }) {
		const { E } = this;
		let { target, branch } = options;
		// console.log("url",url,"folder",folder);
		return new Promise(async (resolve,reject) => {
// console.log(`git ${url} ${folder}`);
			mkdirp.sync(folder);

			let repo = path.basename(url).replace(/\.git$/ig,'');
			target = target || repo;
			let dest = path.join(folder,target);

			if(this.args[`${repo}-branch`])
				branch = this.args[`${repo}-branch`];

			branch = branch || 'master';
			// console.log("GIT dest:",dest);

			if(this.args['no-ssh'] || this.args['--http'] || this.args['--https']) {
				let { base, address, organization, project } = this.utils.match(url,/(?<base>(git@|\w+@|https:\/\/)(?<address>[\w-]+\.\w+)[:\/])(?<organization>[\w]+)\/(?<project>[\w]+)(\.git)?/);
				if(base && address && organization && project) {
					url = `https://${address}/${organization}/${project}`;
				}
			}

			// console.log("GIT repo:",repo);
			// console.log("GIT target:",target);
		    if(!fs.existsSync(dest)) {
				let args = ['clone','-b',branch,url];
				// console.log('git clone:',args);
				// if(branch)
				// 	args.push('-b',branch);
				// args.push(url);
		    	if(target != repo)
		    		args.push(target);
		    // console.log('cloning...');
			// console.log("GIT args:",args);

		        await E.utils.spawn('git',args, {
		            cwd : folder, stdio : 'inherit', //resetTTY : true
		        })
		    }
		    else {
				// console.log('doing git update; cwd:',dest);
		        await E.utils.spawn('git',['fsck'], {
		            cwd : dest, stdio : 'inherit', //resetTTY : true
		        })
		        await E.utils.spawn('git',['reset','--hard'], {
		            cwd : dest, stdio : 'inherit', //resetTTY : true
		        })
		        await E.utils.spawn('git',['fetch'], {
		            cwd : dest, stdio : 'inherit', //resetTTY : true
		        })
		        await E.utils.spawn('git',['checkout',branch], {
		            cwd : dest, stdio : 'inherit', //resetTTY : true
		        })
		        await E.utils.spawn('git',['pull'], {
		            cwd : dest, stdio : 'inherit', //resetTTY : true
		        })
		    }

		    colors.enabled = true;

		    resolve();
		})
	}
}


exports.Resolver = (E) => {
	return async (version) => {
		return new Promise((resolve, reject) => {
			resolve(new Git(E, { }));
		})
	}
}
