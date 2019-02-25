const child_process = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const request = require('request');
const progress = require('request-progress');
const colors = require('colors');
const AdmZip = require('adm-zip');
const gutil = require('gulp-util');
const _ = require('underscore');

class Util {

	constructor(core) {
		this.core = core;
	}

	getDirFiles(dir, testRegExp){
		var result = [];
		var files = fs.readdirSync(dir);
		_.each(files, function(file) {
			var filePath = path.join(dir, file);
			var stat = fs.statSync(filePath);

			if(!stat.isDirectory()){
				if(!testRegExp || testRegExp.test(filePath)){
					result[result.length] = {filePath:filePath, name:file, parentDirName:dir.split(path.sep).pop(), stat:stat};
				}
				return
			}

			result = result.concat(getDirFiles(filePath, testRegExp));
		})

		return result;
	}

	download(url, file, callback) {

		const { DEPS } = this.core;
		let target = path.join(DEPS,file);

		if(this.core.flags.force && fs.existsSync(target))
			fs.unlinkSync(target);

		if(fs.existsSync(target)) {
			gutil.log(`File found at ${target.bold}`);
			gutil.log(`Skipping download...`);
			return callback();
		}

		let  MAX = 60, MIN = 0, value = 0;
		console.log("Fetching: "+url);
		console.log("");

		progress(request(url), {
			throttle : 250,
			delay : 1000
		})
		.on('progress', function (state) {
			if(state.percent > 0.99)
				state.percent = 1;

			if(!state.percent)
				state.percent = 0;

			let value = Math.ceil(state.percent * 60);
			//      console.log("value", value, state, state.percent)
			console.log('\x1B[1A\x1B[K|' +
				(new Array(value + 1)).join('█') + '' +
				(new Array(MAX - value + 1)).join('-') + '|  ' + (state.percent*100).toFixed(1) + '%  '
				+ state.size.transferred.toFileSize().split(' ').shift()+'/'
				+ state.size.total.toFileSize()+'  '
				+ (state.speed || 0).toFileSize()+'/s'
			);
		})
		.on('error', function (err) {
			console.log("error");
			err && console.log(err.toString());
			callback(err);
		})
		.pipe(fs.createWriteStream(target))
		.on('finish', function(err) {
			err && console.log(err.toString());
			callback();
		});
	}

	spawn(...args) {
		if(this.core.flags.verbose && _.isArray(args[1]))
			console.log("running:".bold,args[0],args[1]);

		let callback = args.pop();
		let proc = child_process.spawn.apply(child_process, args);
		let done = false;

		proc.on('close', (code) => {
			colors.enable = true;
			//process.stdout.write('\x1Bc');
			!done && callback(null, code);
			done = true;
		})

		proc.on('error', (err) => {
			!done && callback(err);
			done = true;
		})
	}


	unzip(file, callback) {
		const { DEPS } = this.core;

		if(this.core.flags.fast) {
			console.log(`FAST MODE: Skipping unzip for ${file}...`);
			return callback();
		}
		gutil.log(`Unzipping ${file.bold}...`)
		try {
			let archive = new AdmZip(path.join(DEPS,file));
			archive.extractAllTo(DEPS, true);
			console.log(`Unzipping ${file.bold} success`)
		} catch(ex) {
			console.log(("\nError: "+ex).red.bold);
			ex.stack && console.log(ex.stack);
			console.log((`\nIt looks like ${file} is corrupt...\nPlease run "gulp --force" to re-download...\n`).red.bold);
			process.exit(1);
		}

		return callback();
	}


	getConfig(name, defaults = null) {
	    function merge(dst, src) {
	        _.each(src, (v, k) => {
	            if(_.isArray(v)) { dst[k] = [ ]; merge(dst[k], v); }
	            else if(_.isObject(v)) { if(!dst[k] || _.isString(dst[k]) || !_.isObject(dst[k])) dst[k] = { };  merge(dst[k], v); }
	            else { if(_.isArray(src)) dst.push(v); else dst[k] = v; }
	        })
	    }

	    let filename = name+'.conf';
	    let host_filename = name+'.'+os.hostname()+'.conf';
	    let local_filename = name+'.local.conf';

	    let data = [ ];

	    fs.existsSync(filename) && data.push(fs.readFileSync(filename) || null);
	    fs.existsSync(host_filename) && data.push(fs.readFileSync(host_filename) || null);
	    fs.existsSync(local_filename) && data.push(fs.readFileSync(local_filename) || null);

	    if(!data[0] && !data[1]) {
	        console.error("Unable to read config file: ".bold+(filename+'').red.bold);
	        return defaults;
	    }

	    let o = defaults || { }
	    _.each(data, (conf) => {
	        if(!conf || !conf.toString('utf-8').length)
	            return;
	        let layer = eval('('+conf.toString('utf-8')+')');
	        merge(o, layer);
	    })

	    return o;
	}	
}

if(!Number.prototype.toFileSize) {
	Object.defineProperty(Number.prototype, 'toFileSize', {
		value: function(a, asNumber) {
			var b,c,d;
			var r = (
				a=a?[1e3,'k','B']:[1024,'K','iB'],
				b=Math,
				c=b.log,
				d=c(this)/c(a[0])|0,this/b.pow(a[0],d)
			).toFixed(2)

			if(!asNumber) {
				r += ' '+(d?(a[1]+'MGTPEZY')[--d]+a[2]:'Bytes');
			}
			return r;
		},
		writable:false,
		enumerable:false
	});
}

module.exports = Util;