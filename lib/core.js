"use strict";

const os = require('os');
const gulp = require('gulp');
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
const JSC = require('./jsc');
const Utils = require('./utils');
//const Go = require('./go');
const Toposort = require('toposort-class');
const { finished } = require('stream');
const timestamp = require('time-stamp');
const BASCII = require('bascii');

const PLATFORM = { win32 : 'windows', darwin : 'darwin', linux : 'linux' }[os.platform()];
const _ARCH_ = os.arch();
const ARCH = (_ARCH_ == 'arm') ? _ARCH_+process.config.variables.arm_version : _ARCH_;

function dpc(t,fn) { if(typeof(t) == 'function') setImmediate(t); else setTimeout(fn,t); }
global.dpc = dpc;

class Core {

	constructor(appFolder, options) {

		this.bascii = new BASCII('cybermedium');
		if(options.banner)
			this.print(options.banner);

		if(!options.git && !options.upload)
			throw new Error("missing options.git (git) URL for repository source")
		this.type = { }
		this.type[options.type] = true;
		this.PROJECT_VERSION = options.version;
		this.NODE_VERSION = process.versions.node;

		this.PLATFORM = PLATFORM;
		this.ARCH = ARCH;
		this.PLATFORM_ARCH = `${PLATFORM}-${ARCH}`;
		this.PLATFORM_BINARY_EXTENSION = PLATFORM == 'windows' ? '.exe' : '';
		this.ident = options.ident;
		this.identUCFC = options.ident.charAt(0).toUpperCase()+options.ident.slice(1);
		this.DMG_APP_NAME = options.DMG_APP_NAME || this.identUCFC;
		this.DMG_APP_NAME_ESCAPED = this.DMG_APP_NAME.replace(/\s/g,`\\ `)
		this.title = options.title;
		this.name = options.ident;
		this.identUC = options.ident.toUpperCase();
		//this.gulp = gulp;
		this.options = options;
		this.appFolder = appFolder;
		if(!this.appFolder)
			throw new Error("Missing appFolder in Emanator options");
		this.utils = new Utils(this);
		this.JSC = new JSC(this);

		if(options.nwjs) {
			this.NWJS_VERSION = 'v'+options.nwjs.version;
			this.NWJS_VERSION_NO_V = options.nwjs.version;
		}


		[
			'download', 'unzip', 'spawn', 
			'copy', 'move', 'remove', 'mkdirp', 'emptyDir', 'ensureDir',
		].forEach((fn) => { 
			this[fn] = this.utils[fn].bind(this.utils); 
		})

		this.tools = { }
		fs.readdirSync(path.join(__dirname,'tools')).forEach((t) => {
			t = t.replace(/\.js$/ig,'');
			this.tools[t] = require(`./tools/${t}`).Resolver(this);//{ go : Go.Resolver(this) }
		})


		this.packageJSON = null;

		this.NWJS_SUFFIX = { windows : 'win', darwin : 'osx', linux : 'linux' }[PLATFORM];
		this.BINARIES_ARCHIVE_EXTENSION = { windows : 'zip', darwin : 'zip', 'linux' : 'tar.gz' }[PLATFORM];
		this.NPM = { windows : 'npm.cmd', darwin : 'npm', 'linux' : 'npm' }[PLATFORM];

		if(!options.nosetup && PLATFORM == "windows" && !fs.existsSync("C:/Program Files (x86)/Inno Setup 5/compil32.exe")) {
			console.log("Unable to find Inno Setup binaries...".red.bold);
			process.exit(1);
		}

		// flags

		var args_ = process.argv.join(' ');
		this.flags = { }
		_.each(['init','reset','clean','force','release','rc','verbose','dbg','nonpm','nonwjc','fast','nopackage','local-binaries'], (v) => {
			this.flags[v] = (~args_.indexOf('--'+v) || ~args_.indexOf('---'+v)) ? true : false;
		})

		let args = process.argv.slice(2);

		// folders
		this.RELEASE = path.join(os.homedir(),'emanator');
		this.TOOLS = path.join(this.RELEASE,'tools');
		this.DEPS = path.join(this.RELEASE,'deps');
		this.SETUP = path.join(this.RELEASE,'setup');
		this.ROOT = path.join(this.RELEASE,this.ident+'/');
		this.BUILD = path.join(this.ROOT,'build');
		this.TEMP = path.join(this.ROOT,'temp');
		this.REPO = path.join(this.ROOT,'repo');
		this.DMG = path.join(this.ROOT,"DMG");
		if(this.flags['local-binaries'])
			this.BIN = path.join(this.appFolder,'bin',this.PLATFORM_ARCH);
		else
			this.BIN = path.join(this.ROOT,'build','bin',this.PLATFORM_ARCH);
		this.targetDMG = null;

		if(this.type.NWJS)
			this.PACKAGE = path.join(this.BUILD,'package.nw');
		else
			this.PACKAGE = this.BUILD;

		this.log(`working in`,this.ROOT.bold);
		this.log(`destination is`,this.SETUP.bold);

		 if(PLATFORM == "darwin" && !isRoot()) {
		   console.log("\n\nMust run as root!\n\nuseage: sudo emanate\n".red.bold);
		   process.exit(1);
		 }

		let branchIdx = args.indexOf('--branch');
		if(branchIdx > -1) {
			this.gitBranch = args[branchIdx+1];
		}

		this.flags.debug = this.flags.dbg;
		this.suffix = '';

		this.tasks = { 
			root : [
				// 'clean',
				'init',
				'clone',
				'manifest-read',
				'manifest-write',
				'npm-install',
//				{'package-write' : 'package-json'},
//				{ 'npm-install' : 'package-write' },
				'npm-update',
				'nwjs-sdk-download',
				'nwjs-ffmpeg-download',
				'nwjs-download',
				'nwjs-sdk-unzip',
				'nwjs-ffmpeg-unzip',
				'nwjs-unzip',
				'unlink-nwjs-app',
				'nwjs-copy',
				'nwjs-ffmpeg-copy',
				'nwjs-cleanup',
				'node-modules',
				'node-binary',
				'origin'
			],
			application : [ ]
		}

		this.tasks.root = this.tasks.root.filter((task) => {
			if(_.isObject(task))
				return true;
			if(!this.type.NWJS && task.match(/nwjs/ig))
				return false;
			return true;
		})

		this.plugins = {
			cleanCSS, minifyHTML
		}

//		this.clean
	}

	runTask(task_) {
		return new Promise((resolve,reject) => {
			let task = this.registry[task_];
			if(!task)
				return reject(`task '${task_}' not found`);
			let wrap = task.args.pop();
			wrap((err, result) => {
				return err ? reject(err) : resolve(result);
			})
		})
	}


	async run(list_) {

		if(list_) {

			let list = list_.slice();
			while(list.length) {
				let task_ = list.shift();
				await this.runTask(task_);
			}

			return;
		}

		dpc(()=>{
			this.log('');
			let padding = Object.keys(this.options).map(v => v.length).reduce((a,v) => Math.max(v,a));
			Object.keys(this.options).map(k => [k,this.options[k]]).forEach((o) => {
				let [k,v] = o;
				this.log(`${k}:`.padStart(padding,' '),(v+'').bold);
			})
			this.log('');

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
						this.task(key, [value]);

					})
				}
			})

			this.task('upload', [], this.upload.bind(this));
			this.task('default',this.tasks.platform);

			// console.log(Object.keys(this.registry));

			this.generateTasks_();
		})
	}

	async generateTasks_() {
		var self = this;

		let t = new Toposort();
		_.each(this.registry, (v,k) => {
			if(v.deps && v.deps.length)
				t.add(k,v.deps);
		})
		t = t.sort().reverse();
		let total = t.length;

		this.pendingTasks_ = t;
		let nameLength = t.map(t => t.length).reduce((a,v) => Math.max(v,a))+5;
		// console.log("nameLength".cyan.bold,nameLength);
		const digest = async (cb) => {
			let ident = t.shift();
//			console.log("DIGEST for".cyan.bold,ident.bold,"REMAINING:".yellow.bold,t);
			let task = self.registry[ident];
			if(!task) {
				return cb();
			}

			let ts0 = Date.now();
			let handler = (err) => {
				let tdelta = Date.now() - ts0;
				if(err) {
					console.log(`Error while processing`.red.bold,`${ident}`.bold);
					console.log(err);
					throw new Error('Aborting...');
				}
				digest(cb);
			}

			let descr = ident;
			if(ident == 'done')
				descr = 'user tasks done';
			else
			if(ident == 'default')
				descr = 'done';


			let progress = `...${((1.0-t.length/total)*100).toFixed(2)}% [${total-t.length}/${total}]`;
			gutil.log((descr+'...').padEnd(process.stdout.columns-11-progress.length)+progress.grey);//,'...'+t.join(' '));
			let fn = task.args.pop();
			let p = fn(handler);
		}

		digest(()=>{
			// console.log("all done...".yellow.bold)
		})
	}


	task(ident, deps, fn) {

		if(!this.sealing)
			this.lastUserTask = ident;

		if(!fn)
			fn = this[ident.replace(/-/g,'_')];
		if(!fn && ident != 'default')
			fn = cb => cb();

		let $args = deps ? [deps] : [];
		let wrap = async (...args) => {
			let cb = args.pop();
			if(!fn)
				return cb();
			let closure = (...cbargs)=>{
				//console.log(`${ident} finished...`.green.bold);
				return cb(...cbargs);
			}
			var called = false;
			let pclosure = (...cbargs)=>{
				//console.log(`${ident} P::finished...`.green.bold);
				if(called)
					return
				called = true;
				return cb(...cbargs);
			}

			args.push(closure);
			let p = fn.call(this, ...args);

			if(p && p._readableState) {
				// detect streams and trigger callback on their completion
				p.on("finish", ()=>{
					//console.error(`${ident} finished.`.red);
					pclosure();
				})
				/*
				p.on("close", (err)=>{
					//console.error(`${ident} closed.`.red, err);
					pclosure();
				})
				*/
				p.on("error", (err)=>{
					//console.error(`${ident} error.`.red, err);
					pclosure();
				})
				p.on("end", (err)=>{
					//console.error(`${ident} end.`.red, err);
					pclosure();
				})
				
				/*
				finished(p, (err) => {
					console.error(`${ident} finished.`.red);
				  if (err) {
				    console.error('################# Stream failed.'.red, err);
				  } else {
				    console.log(`${ident} Stream is done.`);
				    console.log(`${ident} has closure!`.magenta.bold)
					pclosure();
				  }
				});
				*/
			}
			else
			if(p && typeof(p.then) == 'function') {
				// block this task completion
				//console.log(`${ident} - await...`.red.bold,p);
				await p;
				//console.log(`...${ident} - done...`.green.bold);
				return cb()
			}
		}

		$args.push(wrap);

		if(!this.registry)
			this.registry = { }

		if(this.registry[ident])
			throw new Error(`error - duplicate task '${ident}'`);
		let d = deps ? deps.slice() : null;
		this.registry[ident] = { ident, deps : deps, args : $args.slice(), deps_ : d }
	}

	log(...args) {
		process.stdout.write('['+timestamp('HH:mm:ss').grey+'] ');
		console.log(...args);
	}

	clean() {

		if(this.flags.clean) {
			console.log('cleaning',this.ROOT);
			fse.emptyDirSync(this.ROOT);
		}
		else
		if(this.flags.reset) {
			console.log('cleaning',this.ROOT);
			fse.emptyDirSync(this.RELEASE);
		}
	}

	init(callback) {
		_.each([this.RELEASE,this.TOOLS,this.ROOT,this.SETUP,this.PACKAGE,this.DEPS,this.BUILD,this.TEMP], function(folder) {
			mkdirp.sync(folder);  
		})
		callback();
	}

	async clone() {
//		console.log(process.stdout);

		const stdout_ = (data) => { process.stdout.write(data); }
		const stderr_ = (data) => { process.stderr.write(data); }

		const stdio = ['inherit', stdout_, stderr_];

		if(fs.existsSync(this.REPO)) {
			gutil.log("Git repository is present...\nChecking integrity...");

			let code = await this.utils.spawn('git',['fsck'], { cwd : this.REPO, stdio : 'inherit', resetTTY : true });
			if(code) {
				console.log(`git error code: ${code}`);
				process.exit(code);
			}

			code = await this.utils.spawn('git',['pull'], { cwd : this.REPO, stdio : 'inherit', resetTTY : true });//, (err, code) => {
			if(code) {
				console.log(`git error code: ${code}`);
				process.exit(code);
			}

		}
		else {
			let args;
			if(this.gitBranch)
				args = ['clone','--single-branch','--branch',this.gitBranch,this.options.git,'repo'];
			else
				args = ['clone',this.options.git,'repo'];

			let code = await this.utils.spawn('git',args, { cwd : this.ROOT, stdio : 'inherit', resetTTY : true });//, (err, code) => {

			if(this.PLATFORM == 'darwin') {
				try {
					await this.utils.spawn(`chmod`,['a+rw','repo'], { cwd : this.ROOT, stdio : 'inherit' });
				} catch(ex) {
					console.log(ex);
					throw "Unable to run chmod on repo folder";
				}
			}
		}

	}

	manifest_read(callback) {

		let pathToPackageJSON = path.join(this.REPO,'package.json');
		if(fs.existsSync(pathToPackageJSON)) {
			this.manifest = this.packageJSON = JSON.parse(fs.readFileSync(pathToPackageJSON));
			// this.name = this.packageJSON.name;

			this.PROJECT_VERSION = this.PROJECT_VERSION || this.manifest.version;
		}
		else {

			// this.manifest = {
			// 	version : 
			// }
		}

		// else
		// 	this.name = this.options.name;
		//this.
//		this.projectName = this.pa
		// console.log("packageJSON:",this.packageJSON);
		// this.packageTOOLS = JSON.parse(fs.readFileSync(path.join(this.appFolder,'package.json')));
/*		if(!this.packageJSON['gulp-config'])
		  throw new Error("package.json must contain 'gulp-config' property");

		let config = this.packageJSON['gulp-config'][this.PLATFORM_ARCH] || this.packageJSON['gulp-config']['*'];
		if(config) {
			console.log(`WARN: package.json 'gulp-config' property does not have an entry for`.magenta.bold, `${this.PLATFORM_ARCH}`.bold);

			this.NWJS_VERSION = 'v'+config['nwjs-version'];
			this.NWJS_VERSION_NO_V = config['nwjs-version'];

			//this.NODE_VERSION = 'v'+this.packageJSON['gulp-config']['node-version'];
			this.targetDMG = 'setup/'+this.ident+'-darwin-'+this.packageJSON.version+this.suffix+'.dmg';
		}
*/
		// if('v'+this.NODE_VERSION != process.version) {
		//   console.log("Please change node to:".magenta.bold,this.NODE_VERSION.bold,"or make appropriate changes in".magenta.bold,"package.json".bold);
		//   process.exit(1);
		// }

		// TODO - MOVE NWJS INIT INTO A SEPARATE TASK
		// NWJC needs to have NWJS_VERSION;  TODO - move to separate task
		if(this.type.NWJS)
			this.NWJC = new NWJC(this); //{ ROOT : this.PACKAGE, DEPS : this.DEPS, NWJS_VERSION : this.NWJS_VERSION, NWJS_SUFFIX : this.NWJS_SUFFIX });

		callback();
	}


	manifest_write(callback) {

		if(!this.packageJSON)
			return callback();

		this.packageJSON["release-type"] = this.flags.release ? "release": "beta";

		Object.keys(this.packageJSON).forEach((k) => {
			let o = this.packageJSON[k][this.ident];
			if(o)
				this.packageJSON[k] = o;
		})

		if(this.JSC.enable) {
			this.packageJSON.dependencies['bytenode'] = "*"
		}

		fs.writeFileSync(path.join(this.PACKAGE, "package.json"), JSON.stringify(this.packageJSON,null,'\t'));
		fs.writeFileSync(path.join(this.REPO, "package.json"), JSON.stringify(this.packageJSON,null,'\t'));

		callback();
	}


	async npm_install() {
		if(this.options.nonpm)
			return;
		//return 
		return this.utils.spawn(this.NPM,['install'], { cwd : this.REPO, stdio : 'inherit' });
		//callback();
	}


	async npm_update() {
		if(this.options.nonpm)
			return;
		//return 
		return this.utils.spawn(this.NPM,['update'], { cwd : this.REPO, stdio : 'inherit' });
	}

	async nwjs_ffmpeg_download() {
		if(!this.options.ffmpeg)
			return;
		// https://github.com/iteufel/nwjs-ffmpeg-prebuilt/releases
		let file = `${this.NWJS_VERSION_NO_V}-${this.NWJS_SUFFIX}-x64.zip`
		let url = `https://github.com/iteufel/nwjs-ffmpeg-prebuilt/releases/download/${this.NWJS_VERSION_NO_V}/${file}`;
		return this.utils.download(url,path.join(this.DEPS,file));
	}

	async nwjs_ffmpeg_unzip() {
		if(!this.options.ffmpeg)
			return;
		if(this.flags.fast)
			return;

		let file = `${this.NWJS_VERSION_NO_V}-${this.NWJS_SUFFIX}-x64.zip`;
		return this.utils.unzip(path.join(this.DEPS,file), this.DEPS);//, callback);
	}

	nwjs_ffmpeg_copy(callback) {
		if(!this.options.ffmpeg)
			return callback();

		switch(process.platform) {
			case 'win32' : {
				return gulp.src(path.join(this.DEPS,"/ffmpeg*"))
					.pipe(gulp.dest(this.BUILD));
			} break;

			case 'linux':{
				return gulp.src(path.join(this.DEPS,"libffmpeg.so"))
					.pipe(gulp.dest(path.join(this.BUILD,"lib")));
			}
			case 'darwin': {
				return 
				var versions = path.join(this.BUILD,'nwjs.app/Contents/Versions');
				var list = fs.readdirSync(versions);
				this.utils.asyncMap(list, (v, next) => {
					fse.copy(
						path.join(this.DEPS, "libffmpeg.dylib"),
						path.join(versions, v, "nwjs Framework.framework", "libffmpeg.dylib"),
						{overwrite:true},
						next
					);
				}, callback);
			} break;
		}
	}

	async nwjs_sdk_download() {
		let file = `nwjs-sdk-${this.NWJS_VERSION}-${this.NWJS_SUFFIX}-x64.${this.BINARIES_ARCHIVE_EXTENSION}`
		let url = `https://dl.nwjs.io/${this.NWJS_VERSION}/${file}`;
		return this.utils.download(url,path.join(this.DEPS,file));
	}

	async nwjs_download() {
		let file = `nwjs-${this.NWJS_VERSION}-${this.NWJS_SUFFIX}-x64.${this.BINARIES_ARCHIVE_EXTENSION}`
		let url = `https://dl.nwjs.io/${this.NWJS_VERSION}/${file}`;
		return this.utils.download(url,path.join(this.DEPS,file));
	}

	async nwjs_sdk_unzip() {
		if(this.flags.fast)
			return;

		let file = `nwjs-sdk-${this.NWJS_VERSION}-${this.NWJS_SUFFIX}-x64.${this.BINARIES_ARCHIVE_EXTENSION}`;
		await this.utils.unzip(path.join(this.DEPS,file), this.DEPS);//, (err)=>{
			// if(err)
			// 	return callback(err);

		if(PLATFORM == "darwin") {
			let creditsHtml = path.join(this.BUILD, "chrome_credits.html");
			gutils.log("Fixing NWJC attributes...");
			var attr = 751;
			var nwjcPath = path.join(this.DEPS, `nwjs-sdk-${this.NWJS_VERSION}-${this.NWJS_SUFFIX}-x64/nwjc`);
			fs.chmodSync(nwjcPath, attr);
		}
//console.log("NWJS SDK DONE - DOING CALLBACK")
		// callback();
//console.log("NWJS SDK DONE - CALLBACK DONE")
//		});
	}

	async nwjs_unzip(callback) {
		if(this.flags.fast)
			return;

		let file = `nwjs-${this.NWJS_VERSION}-${this.NWJS_SUFFIX}-x64.${this.BINARIES_ARCHIVE_EXTENSION}`;
		return this.utils.unzip(path.join(this.DEPS,file),this.DEPS);
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
		return gulp.src(path.join(folder,"/**"))
			.pipe(gulp.dest(this.BUILD));
	}

	nwjs_cleanup(callback) {
		fse.move(path.join(this.BUILD,'credits.html'),path.join(this.BUILD,'chrome_credits.html'),{ overwrite : true },callback); 
	}

	node_modules(callback) {
		if(this.options.nonpm)
			return callback();
		
	    return gulp.src(path.join(this.REPO,'/node_modules/**'))
	    .pipe(gulp.dest(path.join(this.PACKAGE,'/node_modules/')));
	}

	node_binary(callback) {
		if(!this.options.standalone || !this.build.type.NODE)
			return callback();

    	let file = build.PLATFORM == 'windows' ? 'node.exe' : 'node';
    	fse.copy(process.argv[0], path.join(this.build.PACKAGE,file), callback);
	}

	polymer(callback) {
		if(this.options.nopolymer)
			return callback();
	}

	// ---

    upload() {
        _.extend(this, this.utils.getConfig('upload'));
        
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

    resolveStrings(t, custom = { }) {
		let strings = {
			'IDENT' : this.ident,
			'NAME' : this.ident,
			'TITLE' : this.title,
			//'NAME' : this.packageJSON.name,
			'VERSION' : this.PROJECT_VERSION,
			'NWJS-VERSION' : this.NWJS_VERSION_NO_V,
			'NWJS-SUFFIX' : this.NWJS_SUFFIX,
			'NWJS-PLATFORM' : this.NWJS_SUFFIX,
			'NODE-VERSION' : this.NODE_VERSION,
			'PLATFORM' : this.PLATFORM,
			'ARCH' : this.ARCH,
			'PLATFORM-ARCH' : this.PLATFORM_ARCH
		};

		Object.assign(strings,custom);

		Object.entries(strings).forEach(([k,v]) => {
			t = t.replace(new RegExp('\\$'+k,'ig'), v);
		})

		return t;
    }

	async archive() {
		return new Promise(async (resolve,reject) => {

			// exec(`zip`)
	//		this.util.spawn('tar',[archiveFileName+'tgz', '-cvfz' ]

			if(this.options.archive === undefined || this.options.archive === false)
				return resolve();

			console.log("Preparing to archive...");
			let archive = this.options.archive || this.ident;

			archive = this.resolveStrings(archive, {
			 	'EXTENSION' : 'zip'
			});

			if(!archive.match(/\.zip$/))
				archive += '.zip';

			this.ARCHIVE_FILENAME = archive;

			let target = path.join(this.SETUP,archive);
			if(fs.existsSync(target))
				fs.unlinkSync(target);

			this.ARCHIVE = target;
			let code = await this.utils.spawn('zip',['-qdgds','10m','-r', `${target}`, './'], {
				cwd : this.BUILD,
				stdio : 'pipe',
				stdout : (data) => { process.stdout.write(data.toString().replace(/\r|\n/g,'')); }
			});
			process.stdout.write('\n');
				//let target = path.join(this.BUILD,archiveFile);
			let stat = fs.statSync(target);

			if(!stat || !stat.size) {

				console.log(`${archive} is done - (please check target file - can not get file stat!)`)
			}
			else {
				console.log(`${target}`)
				console.log(`${archive} - ${stat.size.toFileSize()} - Ok`)
			}
		
			resolve();
		});
	}

	print(...args) {
		this.bascii.print(...args);
	}
}


module.exports = Core;
