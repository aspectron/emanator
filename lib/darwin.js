const Core = require('./core');
const gutil = require('gulp-util');

class Darwin extends Core {
	constructor(appFolder, gulp, options) {
		super(appFolder, gulp, options);

		this.tasks.platform = [
			'nwjs-unzip-symlink',
			'nwjs-post-cleanup',
			'dmg-unmount',
			'dmg-init',
			'dmg-create',
			'dmg-attach',
			'dmg-configure',
			'dmg-nwjs-plists',
			'dmg-sync',
			'dmg-detach',
			'dmg-package',
			'setup'
		]
	}


	nwjs_unzip_symlink(callback) {
		if(PLATFORM != "darwin") {
			console.log("PLATFORM:"+PLATFORM+": Skipping nwjs-unzip-symlink...");
			return callback();
		}
		let folder = path.join(BUILD, 'nwjs.app');
		console.log(`Symlink Fixing ${folder}...`)
		try {
			var versions = path.join(folder,'/Contents/Versions');
			var list = fs.readdirSync(versions);
			_.each(list, (v) => {
				var frameworkPath = path.join(versions, v, 'nwjs Framework.framework');
				var dest = path.join(frameworkPath, 'Versions/A/');

				fs.unlinkSync(frameworkPath+"/Helpers");
				fs.unlinkSync(frameworkPath+"/nwjs Framework");
				fs.unlinkSync(frameworkPath+"/Resources");
				fs.unlinkSync(frameworkPath+"/XPCServices");

				fs.symlinkSync("Versions/A/Helpers", frameworkPath+"/Helpers", 'dir');
				fs.symlinkSync("Versions/A/Resources", frameworkPath+"/Resources", 'dir');
				fs.symlinkSync("Versions/A/XPCServices", frameworkPath+"/XPCServices", 'dir');
				fs.symlinkSync("Versions/A/nwjs Framework", frameworkPath+"/nwjs Framework");

			})
		} catch(ex) {
			console.log(("\nError: "+ex).red.bold);
			ex.stack && console.log(ex.stack);
			console.log((`\nIt looks like ${folder} is corrupt...\nPlease run "gulp --force" to re-download...\n`).red.bold);
			process.exit(1);
		}

		return callback();
	}

	nwjs_post_cleanup(callback) {
		console.log("Fixing NWJS attributes...");
		var attr = 751;
		var nwjsPath = path.join(BUILD,'nwjs.app/Contents/MacOS/nwjs');

		fs.chmodSync(nwjsPath, attr);
		var versions = path.join(BUILD,'nwjs.app/Contents/Versions');
		var list = fs.readdirSync(versions);
		_.each(list, (v) => {
			var target = path.join(versions,v,'nwjs Helper.app/Contents/MacOS/nwjs Helper');
			//console.log("target:", target, fs.existsSync(target))
			if(fs.existsSync(target))
				fs.chmodSync(target, attr);
		})

		callback();
	}

	dmg_unmount(callback) {
		gutil.log((`Unmounting previous ${this.Ident} volume in case it was mounted...`).green);
		this.util.spawn('hdiutil',(`detach /Volumes/${this.identUCFC}`).split(" "), { cwd : this.ROOT, stdio : 'inherit' }, (err, code) => {
			callback();
		})
	}


	dmg_init(callback) {

		gutil.log("Resetting DMG folder.".green);
		fse.emptyDir(DMG, (err) => {
			if(err)
				return callback(err);

			gutil.log("Cleaning up old DMG files (if any)...".green);
			_.each([
				path.join(this.ROOT,this.ident+".dmg"),
				path.join(this.ROOT,targetDMG)
				], (target) => {
					if(fs.existsSync(target)) {
						gutil.log("Removing old target:",target);
						fs.unlinkSync(target);
					}
				})

			gutil.log("Copying NWJS to DMG folder...".green);
			fse.copy(path.join(BUILD,'nwjs.app'), path.join(this.ROOT,"DMG/"+this.identUCFC+".app"), (err) => {
				if(err)
					return callback(err);

				var NWJS_APP_RESOURCES = path.join(DMG, this.identUCFC, ".app/Contents/Resources");
				gutil.log((`Copying ${this.identUC} App to NWJS App Resource Folder...`).green);
				// mkdirp.sync(path.join(RELEASE,'DMG/XXX.app'));
				fse.copy(path.join(BUILD,'package.nw'), path.join(NWJS_APP_RESOURCES,"app.nw"), (err) => {
				  	if(err)
				  		return callback(err);

				  	gutil.log("Setting up OSX icns...");
				  	fse.copySync(path.join(this.appFolder,"resources/"+this.ident+"-icon.icns"),path.join(NWJS_APP_RESOURCES,"app.icns"));
				  	fse.copySync(path.join(this.appFolder,"resources/"+this.ident+"-icon.icns"),path.join(NWJS_APP_RESOURCES,"document.icns"));

				  	gutil.log("Setting up background...");
				  	mkdirp.sync(path.join(DMG, '.background'));
				  	fse.copySync(path.join(this.appFolder,"resources/"+this.ident+"-dmg.png"),path.join(DMG,'.background/'+this.ident+'.png'));

				  	gutil.log("Symlink for /Applications...");
				  	fs.symlinkSync("/Applications",path.join(this.ROOT,"DMG/Applications"),'dir');

				  	callback();
				})
			})
		})
	}


	dmg_create(callback) {

		gutil.log("Creating DMG volume...".green);
		this.util.spawn('hdiutil',(`create -volname ${this.identUCFC} -srcfolder ./DMG -ov -fs HFS+ -format UDRW ${this.ident}.dmg`).split(" "),
	  //   if(v == "$FSARGS")
	  //     return '"-c c=64,a=16,e=16"';
	  //   return v;
	  // }),
		  { cwd : this.ROOT, stdio : 'inherit' }, (err, code) => {
		  	err && console.log(err);
		  	if(code)
		  		return callback('Error running hdutil - code: '+code);

		  	callback();
		  })  
	}

	dmg_attach(callback) {

		gutil.log((`Mouting ${this.identUCFC}.dmg...`).green)
		this.util.spawn('hdiutil',(`attach -readwrite -noverify -noautoopen ${this.ident}.dmg`).split(" "), { cwd : this.ROOT, stdio : 'inherit' }, (err, code) => {
			err && console.log(err);
			if(code)
				return callback('Error running hdutil - code: '+code);

			callback();
		})
	}


	// http://stackoverflow.com/questions/96882/how-do-i-create-a-nice-looking-dmg-for-mac-os-x-using-command-line-tools
	dmg_configure(callback) {

		var width = 485;
		var height = 330;
		var offsetX = 400;
		var offsetY = 100;
		var iconSize = 72;
		var iconY = 158; // Math.round(150 - iconSize / 2);
		var iconOffset = 100;

		var script = 
		`
		   tell application "Finder"
			 tell disk "${this.identUCFC}"
				   open
				   set current view of container window to icon view
				   set toolbar visible of container window to false
				   set statusbar visible of container window to false
				   set the bounds of container window to {${offsetX}, ${offsetY}, ${offsetX+width}, ${offsetY+height}}
				   set theViewOptions to the icon view options of container window
				   set arrangement of theViewOptions to not arranged
				   set icon size of theViewOptions to ${iconSize}
				   set background picture of theViewOptions to file ".background:${this.ident}.png"
				   set position of item "${this.identUCFC}" of container window to {${iconOffset}, ${iconY}}
				   set position of item "Applications" of container window to {${width-iconOffset}, ${iconY}}
				   update without registering applications
				   delay 5
				   close
			 end tell
		   end tell  
		`;

		// make new alias file at container window to POSIX file "/Applications" with properties {name:"Applications"}

		gutil.log("Applying AppleScript configuration...".green);
		fs.writeFileSync(path.join(DEPS,'osa'), script);

	  	this.util.spawn('osascript',"osa".split(" "), { cwd : DEPS, stdio : 'inherit' }, (err, code) => {
			err && console.log(err);
			if(code)
			  return callback('Error running osascript - code: '+code);

			// TODO - DO WE NEED "chomd -Rf go-w /Volume/XXX" ???
			// console.log("Changing volume permissions to go-w ...".blue);
			// spawn('chmod','-Rf go-w /Volumes/XXX/XXX.app'.split(' '), function(err, code) {
			//   err && console.log(err);
			//   if(code)
			//     return callback('Error running chmod - code: '+code);

			gutil.log("Changing volume permissions to a+rw ...".blue);
			this.util.spawn('chmod',(`-R a+rw /Volumes/${this.identUCFC}/${this.identUCFC}.app`).split(' '), (err, code) => {

				err && console.log(err);
				if(code)
				  return callback('Error running chmod - code: '+code);

				//       var folders = [
				//         'XXX.app',
				//         'XXX.app/Contents/MacOS/nwjs',
				//         'XXX.app/Contents/Frameworks/nwjs\ Helper.app/Contents/MacOS/nwjs\ Helper',
				//         'XXX.app/Contents/Frameworks/nwjs\ Helper\ NP.app/Contents/MacOS/nwjs\ Helper\ NP',
				//         'XXX.app/Contents/Frameworks/nwjs\ Helper\ EH.app/Contents/MacOS/nwjs\ Helper\ EH',
				//         'XXX.app/Contents/Frameworks/nwjs\ Framework.framework/nwjs\ Framework',
						
				//       ]
				// chmod +x ./input/myapp/XXX.app

				gutil.log("Fixing NWJS attributes on target volume...".blue);
				var attr = 777; //751;
				var targets = [ ]
				var nwjsPath = `/Volumes/${this.identUCFC}/${this.identUCFC}.app/Contents/MacOS/nwjs`;
				targets.push(nwjsPath);
				//fs.chmodSync(nwjsPath, attr);
				var versions = `/Volumes/${this.identUCFC}/${this.identUCFC}.app/Contents/Versions`;
				var versionFolders = fs.readdirSync(versions);
				gutil.log("Versions:",versionFolders.join('; '));

				var versionTargets = [
				  'nwjs Helper.app/Contents/MacOS/nwjs Helper',
				  'nwjs Framework.framework/Helpers/crashpad_handler'
				]
				_.each(versionFolders, (v) => {
					_.each(versionTargets, (t) => {
						var target = path.join(versions,v,t);
					//console.log("target:", target, fs.existsSync(target))
						if(fs.existsSync(target))
							targets.push(target);
						  //fs.chmodSync(target, attr);
						else
						  	gutil.log(("Warning - Unable to locate target: "+target.toString()).red.bold);
					})
				})

				digest();

				function digest() {
					var target = targets.shift();
					if(!target)
						return finish();

					gutil.log("changing attributes to a+rx on:".green,target.yellow.bold);
					this.util.spawn('chmod',['a+rx',target.toString()], (err, code) => {
						err && console.log(err);
						if(code)
							return callback('Error running sync - code: '+code);
						if(err)
							return callback(err);

						dpc(digest);
					})
				}

				function finish() {
				  callback();
				}
			})
		})  
	}

	dmg_nwjc_plists(callback) {

  		var text =
`CFBundleDisplayName = "${this.identUCFC}";
CFBundleGetInfoString = "${this.identUCFC} ${packageJSON.version}, Copyright ${(new Date()).getFullYear()} ${this.options.author}, The Chromium Authors, NW.js contributors, Node.js. All rights reserved.";
CFBundleName = "${this.identUCFC}";
NSContactsUsageDescription = "Details from your contacts can help you fill out forms more quickly in ${this.identUCFC}.";
NSHumanReadableCopyright = "Copyright ${(new Date()).getFullYear()} ${this.options.author}, The Chromium Authors, NW.js contributors, Node.js. All rights reserved.";
`  

		var resourceFolder = path.join(`/Volumes/${this.identUCFC}/${this.identUCFC}.app/Contents/Resources`);
		var resources = fs.readdirSync(resourceFolder);

		process.stdout.write("processing InfoPlist strings: ".green);
		_.each(resources, (item) => {
			if(item.match(/\.lproj$/ig)) {
				process.stdout.write(item.split('.').shift()+' ');
				var target = path.join(resourceFolder,item,'InfoPlist.strings');
				if(!fs.existsSync(target)) {
					gutil.log("\nUnable to locate:".red.bold,target.toString().magenta.bold);
					return;
				}

				fs.writeFileSync(target,text);
			}
		})

		process.stdout.write('\n');
		callback();
	}

	dmg_sync(callback) {
		this.util.spawn('sync', { cwd : this.ROOT, stdio : 'inherit' }, (err, code) => {
			err && console.log(err);
			if(code)
				return callback('Error running sync - code: '+code);

			this.util.spawn('sync', { cwd : this.ROOT, stdio : 'inherit' }, (err, code) => {
				err && console.log(err);
				if(code)
					return callback('Error running sync - code: '+code);

				callback();
			})
		})
	}


	dmg_detach(callback) {
		gutil.log("Detaching DMG...".green);
		this.util.spawn('hdiutil',(`detach /Volumes/${this.identUCFC}`).split(" "), { cwd : this.ROOT, stdio : 'inherit' }, (err, code) => {
			err && console.log(err);
			if(code)
				return callback('Error running hdutil - code: '+code);

			this.util.spawn('sync', { cwd : this.ROOT, stdio : 'inherit' }, (err, code) => {
				err && console.log(err);
				if(code)
					return callback('Error running sync - code: '+code);

				setTimeout(() => {
					callback();        
				}, 2000);
			})
		})
	}


	dmg_package(callback) {
		gutil.log((`Converting and Compressing ${this.ident}.dmg to `).green+targetDMG.green.bold+"...".green);
		this.util.spawn('hdiutil',(`convert ${this.ident}.dmg -format UDZO -imagekey zlib-level=9 -o ${this.targetDMG}`).split(" "), { cwd : this.ROOT, stdio : 'inherit' }, (err, code) => {
			err && console.log(err);
			if(code)
				return callback('Error running hdutil - code: '+code);

			gutil.log("...keeping old dmg for experiments".red.bold);
			//fs.unlinkSync(path.join(RELEASE,this.ident+".dmg"));

			callback();
		})
	}

}

module.exports = Darwin;