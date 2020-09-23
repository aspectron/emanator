const Core = require('./core');
const path = require('path');
const fs = require("fs");
const fse = require("fs-extra");
const _ = require("underscore");
const mkdirp = require('mkdirp');

class Darwin extends Core {
	constructor(appFolder, options) {
		super(appFolder, options);
		this.tasks.platform = [];

		this.APP_DIR = path.join(this.ROOT, "APP");

		if(this.flags['dmg']) {
			this.options.DMG = true;
			if(!fs.existsSync(this.folders.DMG))
				mkdirp.sync(this.folders.DMG);
		}

		if(this.options.DMG && !this.type.NWJS)
			throw new Error(`You can not generate a DMG image with non-NWJS build type`);


		if(this.options.DMG) {
			this.APP_DIR = this.DMG;
			this.tasks.platform = this.tasks.platform.concat([
				'dmg-unmount',
				'dmg-create',
				'dmg-attach',
				'dmg-configure',
				'dmg-nwjs-plists',
				'dmg-sync',
				'dmg-detach',
				'dmg-package'
			])
		}

		if(this.type.NWJS)
			this.tasks.platform.push('app-init');

//		if(!this.type.NODE && !options.DMG){
		if(this.flags.archive || options.archive) {

			this.tasks.platform.push('archive');
		}

//		this.log("Darwin:tasks", this.tasks.platform)

	}

	registerFirewallRule(){
		//
	}

	manifest_read(...args){
		let promise = super.manifest_read(...args)
		this.targetDMG = `${this.ident}-v${this.PROJECT_VERSION}-${this.PLATFORM_ARCH}.dmg`;
		return promise;
	}

	dmg_unmount(callback) { 
		//return callback();
		this.log((`Unmounting previous ${this.Ident} volume in case it was mounted...`).green);
		this.spawn('hdiutil',[`detach`,`/Volumes/${this.DMG_APP_NAME}`], {cwd:this.ROOT, stdio : 'inherit' })
		.then((code)=>{
			// if(!code)
			// 	return callback();
			console.error("dmg_unmount:code", code);
			return callback();
		}, (err)=>{
			console.error("dmg_unmount:err", err)
		}).catch(e=>{
			console.error("dmg_unmount:error", e)
		})
	}


	app_init(callback) {
		console.trace("HERE");

		return new Promise(async (resolve,reject) => {
			this.log("Resetting APP_DIR folder.".green);
			fse.emptyDirSync(this.APP_DIR);
			

			this.log("Copying NWJS to APP_DIR folder...".green);
			this.APP_NAME = this.DMG_APP_NAME+".app";
			await this.copy(
				path.join(this.BUILD, 'nwjs.app'),
				path.join(this.APP_DIR, this.APP_NAME)
			)

			var NWJS_APP_RESOURCES = path.join(this.APP_DIR, this.APP_NAME, "/Contents/Resources");
			this.log((`Copying ${this.identUC} App to NWJS App Resource Folder...`).green);
			
			let appNW = path.join(NWJS_APP_RESOURCES, "app.nw");
			let fileList = (this.manifest.files||[]);
			fileList =  [...(this.manifest.files||[]), "package.json", "bin"];
			if(fs.existsSync(path.join(this.BUILD, "node_modules")))
				fileList.push("node_modules")

			let files = fileList.map(f=>{
		        return this.copy(path.join(this.BUILD, f), path.join(appNW, f));
		    })
		    this.log(`copying ${files.length} items...`);
			await Promise.all(files);
			
			if(this.manifest.aux_dmg_files && typeof this.manifest.aux_dmg_files == 'function')
			 	await this.manifest.aux_dmg_files(appNW);

			if(this.type.NODE) {
				await this.copy(process.argv[0],path.join(appNW,path.basename(process.argv[0])));
			}

		  	this.log("Setting up OSX icns...");
		  	let resourceFolder = this.options.resources || 'resources/setup'
		  	await this.copy(path.join(this.appFolder, resourceFolder, this.name+"-icon.icns"),path.join(NWJS_APP_RESOURCES,"app.icns"));
		  	await this.copy(path.join(this.appFolder, resourceFolder, this.name+"-icon.icns"),path.join(NWJS_APP_RESOURCES,"document.icns"));

		  	if(this.options.DMG){
			  	this.log("Setting up background...");
			  	fse.ensureDirSync(path.join(this.APP_DIR, '.background'));
			  	await this.copy(path.join(this.appFolder, resourceFolder , this.name+"-dmg.png"),path.join(this.APP_DIR,'.background/'+this.name+'-dmg.png'));

			  	this.log("Symlink for /Applications...");
			  	fse.ensureSymlinkSync("/Applications", path.join(this.APP_DIR, "/Applications"), 'dir');
			}
		  	resolve();
		})
	}

	createArchiveName(archive){
		archive = this.resolveStrings(archive, {
		 	'EXTENSION' : 'tar.gz'
		});

		if(!archive.match(/\.tar\.gz$/))
			archive += '.tar.gz';
		return archive;
	}

	createArchive(){
		let opt = {cwd:this.APP_DIR, stdio:'inherit'}
		return this.spawn("tar", ['cjf', this.ARCHIVE, "./"], opt);
		/*return this.utils.zipFolder(
			this.APP_DIR,
			this.ARCHIVE,
			this.ARCHIVE_LEVEL
		);*/
	}


	dmg_create(callback) {
		return new Promise(async (resolve, reject) => {
			this.DMG_FILE = path.join(this.SETUP, `${this.DMG_APP_NAME}.dmg`);
			let args = [
				'create','-volname', this.DMG_APP_NAME ,'-srcfolder','./DMG','-ov',
				'-fs','HFS+','-format','UDRW', this.DMG_FILE
			]
			this.log("Creating DMG volume...".green);
			this.log("CMD: hdiutil "+args.join(" "))

			this.spawn('hdiutil', args,
				//   if(v == "$FSARGS")
				//     return '"-c c=64,a=16,e=16"';
				//   return v;
				// }),
				{cwd: this.ROOT, stdio: 'inherit'}
			)
			.then((code)=>{
				if(code){
					console.log('Error running hdutil - code: '+code);
					reject(code);
				}
				else
					resolve();
			}, (err)=>{
				console.log(err);
				reject(err);
			})
		})
	}

	dmg_attach(callback) {
		return new Promise(async (resolve, reject) => {
			this.log((`Mouting ${this.DMG_APP_NAME}.dmg...`).green)
			this.spawn(
				'hdiutil', 
				['attach', '-readwrite', '-noverify', '-noautoopen', this.DMG_FILE],
				{cwd:this.ROOT, stdio:'inherit', env:process.env})
			.then((code)=>{
				if(code){
					console.log('Error running hdutil - code: '+code);
					reject(code);
				}
				else
					resolve();
			}, (err)=>{
				console.log(err);
				reject(err);
			})
		})
	}


	// http://stackoverflow.com/questions/96882/how-do-i-create-a-nice-looking-dmg-for-mac-os-x-using-command-line-tools
	dmg_configure(callback) {
		return new Promise((resolve, reject)=>{
		var captionBarHeight = 48;
		var width = 485;
		var height = 330+captionBarHeight;
		var offsetX = 400;
		var offsetY = 100;
		var iconSize = 72;
		var iconY = 158; // Math.round(150 - iconSize / 2);
		var iconOffset = 100;

		var script = 
		`
		   tell application "Finder"
			 tell disk "${this.DMG_APP_NAME}"
				   open
				   set current view of container window to icon view
				   set toolbar visible of container window to false
				   set statusbar visible of container window to false
				   set the bounds of container window to {${offsetX}, ${offsetY}, ${offsetX+width}, ${offsetY+height}}
				   set theViewOptions to the icon view options of container window
				   set arrangement of theViewOptions to not arranged
				   set icon size of theViewOptions to ${iconSize}
				   set background picture of theViewOptions to file ".background:${this.name}-dmg.png"
				   set position of item "${this.DMG_APP_NAME}.app" of container window to {${iconOffset}, ${iconY}}
				   set position of item "Applications" of container window to {${width-iconOffset}, ${iconY}}
				   update without registering applications
				   delay 5
				   close
			 end tell
		   end tell  
		`;

		// make new alias file at container window to POSIX file "/Applications" with properties {name:"Applications"}

		this.log("Applying AppleScript configuration...".green);
		fs.writeFileSync(path.join(this.DEPS,'osa'), script);

	  	this.spawn('osascript',"osa".split(" "), { cwd : this.DEPS, stdio : 'inherit' })
	  	.then(async(_code)=>{
			if(_code)
		  		return reject('Error running osascript - code: '+_code);

			// TODO - DO WE NEED "chomd -Rf go-w /Volume/XXX" ???
			// console.log("Changing volume permissions to go-w ...".blue);
			// spawn('chmod','-Rf go-w /Volumes/XXX/XXX.app'.split(' '), function(err, code) {
			//   err && console.log(err);
			//   if(code)
			//     return callback('Error running chmod - code: '+code);

			this.log("Changing volume permissions to a+rw ...".blue);
			let code = await this.spawn('chmod',[`-R`,`a+rw`,`/Volumes/${this.DMG_APP_NAME}/${this.DMG_APP_NAME}.app`]);
			if(code)
				return callback('Error running chmod - code: '+code);

			resolve();
		}, err=>{
			console.log("osascript:error", err)
			reject(err);
		});
	  	});
	}

	dmg_nwjc_plists(callback) {

  		var text =
`CFBundleDisplayName = "${this.DMG_APP_NAME}";
CFBundleGetInfoString = "${this.DMG_APP_NAME} ${packageJSON.version}, Copyright ${(new Date()).getFullYear()} ${this.options.author}, The Chromium Authors, NW.js contributors, Node.js. All rights reserved.";
CFBundleName = "${this.DMG_APP_NAME}";
NSContactsUsageDescription = "Details from your contacts can help you fill out forms more quickly in ${this.DMG_APP_NAME}.";
NSHumanReadableCopyright = "Copyright ${(new Date()).getFullYear()} ${this.options.author}, The Chromium Authors, NW.js contributors, Node.js. All rights reserved.";
`  

		var resourceFolder = path.join(`/Volumes/${this.DMG_APP_NAME}/${this.DMG_APP_NAME}.app/Contents/Resources`);
		var resources = fs.readdirSync(resourceFolder);

		process.stdout.write("processing InfoPlist strings: ".green);
		_.each(resources, (item) => {
			if(item.match(/\.lproj$/ig)) {
				process.stdout.write(item.split('.').shift()+' ');
				var target = path.join(resourceFolder,item,'InfoPlist.strings');
				if(!fs.existsSync(target)) {
					this.log("\nUnable to locate:".red.bold,target.toString().magenta.bold);
					return;
				}

				fs.writeFileSync(target,text);
			}
		})

		process.stdout.write('\n');
		callback();
	}

	dmg_sync(callback) {
		let opt = {cwd:this.ROOT, stdio:'inherit'};
		return new Promise((resolve, reject)=>{
			this.spawn('sync', opt).then(code=>{
				if(code){
					console.log('Error running sync:1  - code: '+code)
					return reject(code);
				}

				this.spawn('sync', opt).then(code=>{
					if(code){
						console.log('Error running sync:2 - code: '+code)
						return reject(code);
					}
					resolve();
				}, err=>{
					console.log("sync:error", err);
					reject(err);
				})
			}, err=>{
				console.log("sync:error", err);
				reject(err);
			})
		})
	}


	dmg_detach(callback) {
		this.log("Detaching DMG...".green);
		let opt = {cwd:this.ROOT, stdio:'inherit'};
		return new Promise((resolve, reject)=>{
			this.spawn('hdiutil',[`detach`,`/Volumes/${this.DMG_APP_NAME}`], opt).then(code=> {
				if(code){
					console.log('Error running hdutil - code: '+code);
					return reject(code);
				}

				this.spawn('sync', opt).then(code=> {
					if(code){
						console.log('Error running sync - code: '+code)
						return reject(code);
					}

					dpc(2000, () => {
						resolve();        
					});
				}, err=>{
					console.log("Detaching:sync:error", err);
					reject(err);
				})
			}, err=>{
				console.log("Detaching:error", err);
				reject(err);
			})
		})
	}


	async dmg_package(callback) {
		let targetDMG = path.join(this.SETUP, this.targetDMG);
		if(fs.existsSync(targetDMG))
			await this.remove(targetDMG);
		var args = ['convert', '-format', 'UDZO', '-imagekey', 'zlib-level=9','-o',`${targetDMG}`, `${this.DMG_APP_NAME}.dmg`];
		this.log((`Converting and Compressing ${this.DMG_APP_NAME}.dmg to `).green+this.targetDMG.green.bold+"...".green, args);
		return new Promise(async (resolve, reject)=>{
			this.spawn('hdiutil', args, {cwd:this.SETUP,stdio:'inherit'}).then( async(code)=>{
				if(code){
					console.log('Error running hdutil - code: '+code)
					return reject(code);
				}


				let hash = await this.utils.fileHash(targetDMG, 'sha1');
				let hashFile = targetDMG+'.sha1sum';
				fs.writeFileSync(hashFile, hash);
	
				if(0)
					this.log("...keeping old dmg for experiments".red.bold);
				else
					fs.unlinkSync(path.join(this.SETUP, this.DMG_APP_NAME+".dmg"));

				resolve();
			}, err=>{
				console.log("Detaching:error", err);
				reject(err);
			})
		})
	}

}

module.exports = Darwin;