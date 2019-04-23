const fs = require('fs');
const path = require('path');
const bytenode = require('bytenode');

class JSC {

	constructor(core) {
		this.core = core;
		this.enable = core.options.JSC;
	}

	compile(source, target) {
		this.digestFolderRecursiveSync(source, target);
	}

	compileMain(source, target) {

		this.digestFileSync(source, target);

		if(this.enable) {

		    var targetFile = target;
		    if(fs.existsSync(target)) {
		        if(fs.lstatSync(target).isDirectory()) {
		            targetFile = path.join(target,path.basename(source));
		        }
		    }

		    let filename = path.basename(source)+'c';
console.log("compiling".yellow.bold,targetFile, filename);
		    fs.writeFileSync(targetFile,`require("bytenode");require("./${filename}");`)
		}

	}

	digestFileSync(source, target) {

	    var targetFile = target;

	    //if target is a directory a new file with the same name will be created
	    if(fs.existsSync(target)) {
	        if(fs.lstatSync(target).isDirectory()) {
	            targetFile = path.join(target,path.basename(source));
	        }
	    }


	    if(this.enable && source.match(/(\.js)$/i)) {

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
	    	fs.writeFileSync(targetFile, fs.readFileSync(source));
	    }
	}

	digestFolderRecursiveSync(source, target) {
	    var files = [];

	    //check if folder needs to be created or integrated
	    var targetFolder = path.join(target,path.basename(source));
	    if (!fs.existsSync(targetFolder)) {
	        fs.mkdirSync(targetFolder);
	    }

	    //copy
	    if(fs.lstatSync(source).isDirectory()) {
	        files = fs.readdirSync(source);
	        files.forEach((file) => {
	            var curSource = path.join(source,file);
	            if(fs.lstatSync(curSource).isDirectory()) {
	                this.digestFolderRecursiveSync(curSource,targetFolder);
	            } else {
	                this.digestFileSync(curSource,targetFolder);
	            }
	        });
	    }
	}
}

module.exports = JSC;