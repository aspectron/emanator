const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const bytenode = require('bytenode');

class Filter {
	constructor() {
		this.map = new Map();
	}

	copy(...args) {
		args.forEach((v) => {
			if(Array.isArray(v))
				return copy(...v);

			this.map.set(v, { copy : true });
		})
	}

	ignore(...args) {
		args.forEach((v) => {
			if(Array.isArray(v))
				return ignore(...v);

			this.map.set(v, { ignore : true });
		})
	}

	check_(file) {
		for (var [k, v] of this.map) {
			// console.log(key + ' = ' + value);
			// console.log("checking",typeof(k),k,v);

			if(typeof(k) == 'string') {
				if(~file.indexOf(k))
					return v;
			}
			else
			if(k.test(file))
				return v;		
		}

		return { }
	}
}


class JSC {

	constructor(core) {
		this.core = core;
		this.enable = core.options.JSC;

	}

	compile(source, target, fgen) {

		let filter = new Filter();
		if(fgen)
			fgen(filter);

		this.digestFolderRecursiveSync(source, target, filter);
	}

	compileMain(source, target) {

		let filter = new Filter();
		this.digestFileSync(source, target, filter);

		if(this.enable) {

		    var targetFile = target;
		    if(fs.existsSync(target)) {
		        if(fs.lstatSync(target).isDirectory()) {
		            targetFile = path.join(target,path.basename(source));
		        }
		    }

		    let filename = path.basename(source)+'c';
//			console.log("compiling".yellow.bold,targetFile, filename);

	    	console.log(`${"JSC:".bold} +-----:: ${"done...".green}`)
		    fs.writeFileSync(targetFile,`require("bytenode");require("./${filename}");`)
		}

	}

	digestFileSync(source, target, filter) {

	    var targetFile = target;
	    let file = path.basename(source);
	    //if target is a directory a new file with the same name will be created
	    if(fs.existsSync(target)) {
	        if(fs.lstatSync(target).isDirectory()) {
	            targetFile = path.join(target,file);
	        }
	    }

	    if(!this.enable) {
	    	console.log(`${"JSC:".bold} |  ----> ${targetFile.yellow}`)
	    	fs.writeFileSync(targetFile, fs.readFileSync(source));
	    	return;
	    }

	    let f = filter.check_(targetFile.replace(/\\/g,'/'));
	    if(f.ignore) {
	    	console.log(`${"JSC:".bold} |  ----> ${targetFile.magenta}`)
	    	//console.log("ignoring:".yellow.bold, targetFile);
	    	return;
	    }

	    if(f.copy) {
	    	console.log(`${"JSC:".bold} |  ----> ${targetFile.yellow}`)
	    	//console.log("copying [match]:".yellow.bold, targetFile);
			fs.writeFileSync(targetFile, fs.readFileSync(source));	    	
			return;
	    }

	    if(source.match(/(\.js)$/i)) {
	    	//console.log("compiling:".yellow.bold, targetFile);

	    	targetFile += 'c';
	    	console.log(`${"JSC:".bold} |  +-:   ${source.cyan}`)
	    	console.log(`${"JSC:".bold} |  +---> ${targetFile.green}`)

		    bytenode.compileFile({
		    	filename : source,
		    	output : targetFile,
		    	compileAsModule : true
		    })
		}
		else {
	    	console.log(`${"JSC:".bold} |  ----> ${targetFile.yellow}`)
	    	//console.log("copying [default]:".yellow.bold, targetFile);
	    	fs.writeFileSync(targetFile, fs.readFileSync(source));
	    }
	}

	digestFolderRecursiveSync(source, target, filter) {
	    var files = [];

	    //check if folder needs to be created or integrated
	    var targetFolder = path.join(target,path.basename(source));
	    if (!fs.existsSync(targetFolder)) {

	    	let f = filter.check_(targetFolder.replace(/\\/g,'/'));
	    	if(f.ignore) {
		    	console.log(`${"JSC:".bold} |  ----> ${targetFolder.magenta}`)
		    	return;
	    	}

	        fs.mkdirSync(targetFolder);
	        // mkdirp(targetFolder);
	    }

	    //copy
	    if(fs.lstatSync(source).isDirectory()) {
	        files = fs.readdirSync(source);
	        files.forEach((file) => {
	            var curSource = path.join(source,file);
	            if(fs.lstatSync(curSource).isDirectory()) {
	                this.digestFolderRecursiveSync(curSource,targetFolder,filter);
	            } else {
	                this.digestFileSync(curSource,targetFolder,filter);
	            }
	        });
	    }
	}
}

module.exports = JSC;