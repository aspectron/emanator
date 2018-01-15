"use strict";

const gutil = require('gulp-util');
const path = require('path');
const minifyHTML = require('gulp-htmlmin');
const cleanCSS = require('gulp-clean-css');
const mkdirp = require('mkdirp');
const fs = require('fs');
const fse = require('fs-extra');
const isRoot = require('is-root');
const semver = require('semver')
const crypto = require('crypto');
const _ = require('underscore');
const NWJC = require('./nwjc');
const Util = require('./util');

const PLATFORM = { win32 : 'windows', darwin : 'darwin', linux : 'linux' }[process.platform];

function dpc(t,fn) { if(typeof(t) == 'function') setImmediate(t); else setTimeout(fn,t); }

class Core {

	constructor(appFolder, gulp, options) {

		if(!options.git && !options.upload)
			throw new Error("missing options.git (git) URL for repository source")

		this.ident = options.ident;
		this.identUCFC = options.ident.charAt(0).toUpperCase()+options.ident.slice(1);
		this.title = options.title;
		this.identUC = options.ident.toUpperCase();
		this.gulp = gulp;
		this.options = options;
		this.appFolder = appFolder;
		if(!this.appFolder)
			throw new Error("Missing appFolder in Emanator options");
		this.util = new Util(this);


		this.packageTOOLS = JSON.parse(fs.readFileSync(path.join(this.appFolder,'package.json')));
		if(!this.packageTOOLS['gulp-config'])
		  throw new Error("package.json must contain 'gulp-config' property");
		this.packageJSON = null;

		this.NWJS_VERSION = 'v'+this.packageTOOLS['gulp-config']['nwjs-version'];
		this.NWJS_SUFFIX = { windows : 'win', darwin : 'osx' }[PLATFORM];
		this.NPM = { windows : 'npm.cmd', darwin : 'npm'}[PLATFORM];
		this.NODE_VERSION = 'v'+this.packageTOOLS['gulp-config']['node-version'];

		if(this.NODE_VERSION != process.version) {
		  console.log("Please upgrade node to:".magenta.bold,NODE_VERSION.bold,"or make appropriate changes in".magenta.bold,"package.json".bold);
		  process.exit(1);
		}

		if(PLATFORM == "windows" && !fs.existsSync("C:/Program Files (x86)/Inno Setup 5/compil32.exe")) {
			console.log("Unable to find Inno Setup binaries...".red.bold);
			process.exit(1);
		}

		// folders

		this.RELEASE = path.join(appFolder, '../release/');
		this.ROOT = path.join(this.RELEASE,this.ident+'/');
		this.DEPS = path.join(this.RELEASE,'deps');
		this.SETUP = path.join(this.RELEASE,'setup');
		this.BUILD = path.join(this.ROOT,'build');
		this.TEMP = path.join(this.ROOT,'temp');
		this.PACKAGE = path.join(this.BUILD,'package.nw');
		this.REPO = path.join(this.ROOT,'repo');
		this.DMG = path.join(this.ROOT,"DMG");
		this.targetDMG = null;

		this.NWJC = new NWJC(this); //{ ROOT : this.PACKAGE, DEPS : this.DEPS, NWJS_VERSION : this.NWJS_VERSION, NWJS_SUFFIX : this.NWJS_SUFFIX });

		 if(PLATFORM == "darwin" && !isRoot()) {
		   console.log("\n\nMust run as root!\n\nuseage: sudo gulp\n".red.bold);
		   process.exit(1);
		 }


		var args_ = process.argv.join(' ');
		this.flags = { }
		_.each(['init','clean','force','release','rc','verbose','debug','nonwjc','fast','nopackage'], (v) => {
			this.flags[v] = ~args_.indexOf('--'+v) ? true : false;
		})


		this.suffix = '-beta';
		if(this.flags.release)
			this.suffix = '';

		//this.stack = [ ]

		this.tasks = { 
			root : [
				'clean',
				'init',
				'clone',
				'npm-install',
				'npm-update',
				'nwjs-sdk-download',
				'nwjs-download',
				'nwjs-sdk-unzip',
				'nwjs-unzip',
				'package-read',
				'package-write',
				'unlink-nwjs-app',
				'nwjs-copy',
				'nwjs-cleanup',
				'node-modules',
				'origin'
			],
			application : [ ]
		}

		this.plugins = {
			cleanCSS, minifyHTML
		}
	}


	run() {

		this.sealing = true;

		this.tasks.platform.unshift(this.lastUserTask || 'done');

		let tasks = [].concat(this.tasks.root, this.tasks.application, this.tasks.platform);
		this.flags.debug && console.log(tasks);

		let prev = null;
		_.each(tasks, (v) => {
			if(typeof(v) == 'string') {

				if(v == this.lastUserTask || v == 'done') {
					prev = v;
					return;
				}

				if(prev)
					this.task(v, [prev]);
				else
					this.task(v);

				prev = v;
			}
			else
			if(_.isObject(v)) {
				_.each(v, (value, key) => {
					this.task(key,value);

				})
			}

		})

		this.task('default',this.tasks.platform);
	}

	task(ident, deps, fn) {

		if(!this.sealing)
			this.lastUserTask = ident;

		if(!fn)
			fn = this[ident.replace(/-/g,'_')];

		if(!fn && ident != 'default')
			fn = cb => cb();

		let args = deps ? [deps] : [];
		if(fn)
			args.push(fn.bind(this));
		else if(!fn && ident != 'default') {
			console.log("WARNING! No handler for ".red,(ident+'').bold);
		}


		if(this.flags.debug)
			console.log("--->",ident,...args);

		this.gulp.task(ident, ...args);
	}

	clean(callback) {

		if(this.flags.clean) {
			fse.emptyDir(this.RELEASE, (err) => {
				if(err) {
					console.log(err);
					return callback(err);
				}
				this.options.init = true;
				callback();
			})
		}
		else
			callback();
	}

	init(callback) {
		_.each([this.RELEASE,this.ROOT,this.SETUP,this.PACKAGE,this.DEPS,this.BUILD,this.TEMP], function(folder) {
			mkdirp.sync(folder);  
		})
		callback();
	}

	clone(callback) {

		if(fs.existsSync(this.REPO)) {
			gutil.log("Git repository is present...\nChecking integrity...");
			this.util.spawn('git',['fsck'], { cwd : this.REPO, stdio : 'inherit' }, (err, code) => {
				//console.log("git fsck:: ", err, code);
				if(!err && code)
					err = 'git error code: '+code;
				if(err) {
					gutil.log(err);
					process.exit(code);
				}

				this.util.spawn('git',['pull'], { cwd : this.REPO, stdio : 'inherit' }, (err, code) => {
					if(!err && code)
						err = 'git error code: '+code;
					if(err) {
						console.log("try after: ssh-add ~/.ssh/id_rsa");
						console.log("Git Error".red.bold, err);
					}

					return callback();
				})
			})
		}
		else {
			this.util.spawn('git',['clone',this.options.git,'repo'], { cwd : this.ROOT, stdio : 'inherit' }, (err, code) => {
				if(!err && code)
					err = 'git error code: '+code;
				if(err)
					console.log(err);
				return callback();
			})
		}
	}

	npm_install(callback) {
		this.util.spawn(this.NPM,['install'], { cwd : this.REPO, stdio : 'inherit' }, function(err, code) {
			callback();
		})
	}


	npm_update(callback) {
		this.util.spawn(this.NPM,['update'], { cwd : this.REPO, stdio : 'inherit' }, function(err, code) {
			callback();
		})
	}

	nwjs_sdk_download(callback) {
		let file = `nwjs-sdk-${this.NWJS_VERSION}-${this.NWJS_SUFFIX}-x64.zip`
		let url = `https://dl.nwjs.io/${this.NWJS_VERSION}/${file}`;
		this.util.download(url,file,callback);
	}

	nwjs_download(callback) {
		let file = `nwjs-${this.NWJS_VERSION}-${this.NWJS_SUFFIX}-x64.zip`
		let url = `https://dl.nwjs.io/${this.NWJS_VERSION}/${file}`;
		this.util.download(url,file,callback);
	}

	nwjs_sdk_unzip(callback) {
		if(this.flags.fast)
			return callback();

		let file = `nwjs-sdk-${this.NWJS_VERSION}-${this.NWJS_SUFFIX}-x64.zip`;
		this.util.unzip(file, function(err){
			if(err)
				return callback(err);

			if(PLATFORM == "darwin") {
				gutil.log("Fixing NWJC attributes...");
				var attr = 751;
				var nwjcPath = path.join(this.DEPS, `nwjs-sdk-${this.NWJS_VERSION}-${this.NWJS_SUFFIX}-x64/nwjc`);
				fs.chmodSync(nwjcPath, attr);
			}

			callback();
		});
	}

	nwjs_unzip(callback) {
		if(this.flags.fast)
			return callback();

		let file = `nwjs-${this.NWJS_VERSION}-${this.NWJS_SUFFIX}-x64.zip`;
		this.util.unzip(file, callback);
	}


	package_read(callback) {
		this.packageJSON = JSON.parse(fs.readFileSync(path.join(this.REPO,'package.json')));
		this.targetDMG = 'setup/'+this.ident+'-darwin-'+this.packageJSON.version+this.suffix+'.dmg';

		callback();
	}

	package_write(callback) {
		this.packageJSON["release-type"] = this.flags.release ? "release": "beta";
		fs.writeFileSync(path.join(this.PACKAGE, "package.json"), JSON.stringify(this.packageJSON));

		callback();
	}

	unlink_nwjs_app(callback) {
		let appFile = path.join(this.BUILD, 'nwjs.app');
		if(!fs.existsSync(appFile)){
			callback()
		} else {
			fse.remove(appFile, function(){
				callback()
			});
		}
	}

	nwjs_copy(callback) {
		let folder = path.join(this.DEPS,`nwjs-${this.NWJS_VERSION}-${this.NWJS_SUFFIX}-x64`);
		return this.gulp.src(path.join(folder,"/**"))
			.pipe(this.gulp.dest(this.BUILD));
	}

	nwjs_cleanup(callback) {
		fs.unlinkSync(path.join(this.BUILD,'credits.html'));
		callback();
	}

	node_modules() {
	    return this.gulp.src(path.join(this.REPO,'/node_modules/**'))
	    .pipe(this.gulp.dest(path.join(this.PACKAGE,'/node_modules/')));
	}

	// ---

    upload() {
        _.extend(this, this.util.getConfig('upload'));
        
        let maxVer = '0.0.0';
        var list = fs.readdirSync(this.SETUP);
        var latestFile = null;
        _.each(list, (f) => {
        	console.log(f);
            if(f.indexOf(this.ident) != 0)
                return;

            if(/-darwin-/.test(f) == false && /-windows-/.test(f) == false)
                return;

            let parts = f.replace(this.ident+"-darwin-", "").replace(this.ident+"-windows-", "").split('.');
            parts.pop();// extension
            let version = parts.join('.');

            if(semver.gt(version, maxVer)) {
                maxVer = version;
                latestFile = f;
            }
        })

        if(latestFile) {

            this.createHash_(latestFile, (err, hash) => {
                if(err)
                    return console.log("CreateHash:Error", err);

                var hashFileName = this.createHashFile_(latestFile, hash);
                console.log(hashFileName, "- hash: "+hash.green.bold)

                this.uploadFiles_(hashFileName, latestFile);
            })
        }
        else {
            console.log("Unable to locate setup file! aborting...");
        }
    }

    createHash_(file, callback){
        var sha1 = crypto.createHash("sha1");
        sha1.setEncoding('hex');
        let input = fs.createReadStream(path.join(this.SETUP, file));
        input.on('end', function() {
            sha1.end();
            var hash = sha1.read();
            callback(null, hash);
        });
        input.pipe(sha1);
    }

    createHashFile_(fileName, hash){
        var hashFileName = fileName.split(".");
        hashFileName.pop();
        hashFileName.push("sha1")
        hashFileName = hashFileName.join(".");

        fs.writeFileSync(path.join(this.SETUP, hashFileName), hash);
        return hashFileName;
    }

    uploadFiles_(hashFile, setupFile) {
        let args = [ ]
        if(this.scp.port)
            args.push('-P',this.scp.port);
        args.push(hashFile, setupFile);
        args.push(this.scp.dest);
        console.log(args);
        return;

        spawn('scp', args, { cwd : this.SETUP, stdio : 'inherit' }, function(err, code) {
            if(err) {
                console.log(err);
                process.exit(code);
            }else{
                console.log("Files uploded:\n"+[hashFile, setupFile].join(", ").greenBG.white)
            }
        })
    }


}


module.exports = Core;