const Core = require('./core');
const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const ejs = require('ejs');
const _ = require('underscore');
const gutil = require('gulp-util');


class Windows extends Core {

	constructor(appFolder, options) {
		super(appFolder, options);

		// if(!options.guid && !options.upload)
		// 	throw new Error("Emanator::Windows::ctor() - Missing GUID in options");

		this.tasks.platform = [
			'resources',
			'setup',
			'archive'
		]

		if(options.pfx)
			this.tasks.platform.push('pfx');

		this.RH = path.join(__dirname,'..','bin',this.PLATFORM_ARCH,'rh.exe');


		const INNO_SETUP_COMPIL32 = 'C:/Program Files (x86)/Inno Setup 6/compil32.exe'
		if(!fs.existsSync(INNO_SETUP_COMPIL32)) {
			this.log(`fatal: unable to locate: ${INNO_SETUP_COMPIL32}`.brightRed);
			this.log(`please download innosetup 6 at:`.brightWhite);
			this.log(`https://jrsoftware.org/isdl.php`.cyan);
			process.exit(0);
		}
	}


	resources(callback) {

		if(!this.type.NWJS)
			return callback();

		if(this.flags.nopackage)
			return callback();

		let stdio = (this.flags.debug) ? 'inherit' : 'ignore';

		const { TEMP, BUILD } = this;
		fse.emptyDir(TEMP, (err) => {
			if(err)
				return callback(err);

			fse.copy(path.join(__dirname,"../resources"),TEMP, { overwrite : true }, (err) => {
				if(err)
					return callback(err);

				_.each(['manifest.bin','google-app.bin'], (file) => {
					if(!fs.existsSync(path.join(TEMP,file)))
						throw new Error(`Missing ${path.join(TEMP,file)}`);
				})

				fse.copy(path.join(BUILD,'nw.exe'), path.join(TEMP,'nw.exe'), { overwrite : true }, async (err) => {
					if(err)
						return callback(err);

					const MANIFEST_NAME = this.manifest.name;
					const RESOURCE_TARGET = MANIFEST_NAME;

					let rc = fs.readFileSync(path.join(__dirname,'../templates/','template.rc'),'utf8');
					rc = ejs.render(rc, { 
						group : this.options.group,
						//ident : this.options.ident,
						name : RESOURCE_TARGET,
						//name : this.name,
						//identUCFC : this.identUCFC,
						title : this.options.title,
						author : this.options.author,
						url : this.options.url,
						suffix: this.suffix,
						options: this.options,
						fw : this.options.fw,
						autostart : this.options?.innosetup?.autostart || false,
						//RESOURCES :  path.join(this.appFolder,'resources'),
					});
					fs.writeFileSync(path.join(this.TEMP,RESOURCE_TARGET+'.rc'), rc);
					
					let code = await this.utils.spawn(this.RH,(`-open ${RESOURCE_TARGET}.rc -action compile -save ${RESOURCE_TARGET}.res -log CON`).split(' '), { cwd : TEMP, stdio });
					if(code) {
						console.log(`resource hacker (stage 0) failure; code: ${code}`);
						process.exit(1);
					}

					code = await this.utils.spawn(this.RH,(`-open nw.exe -resource ${RESOURCE_TARGET}.res -action addoverwrite -mask VERSIONINFO,,1033 -save ${RESOURCE_TARGET}.exe -log CON`).split(' '), { cwd : TEMP, stdio });
					if(code) {
						console.log(`resource hacker (stage 1) failure; code: ${code}`);
						process.exit(1);
					}

					let rhs = 
`[FILENAMES]
Exe=    <%- name %>.exe
SaveAs= <%- name %>.exe
Log=CONSOLE
[COMMANDS]
-addoverwrite "<%- path.join(RESOURCES,name+'.ico') %>", ICONGROUP,IDR_MAINFRAME,
`

					let resourceFolder = this.options.resources || 'resources/setup'; // && this.options.resources.folder ? this.options.resources.folder : 'resources';
					rhs = ejs.render(rhs, { path, name : RESOURCE_TARGET, RESOURCES : path.join(this.appFolder,resourceFolder) });
					fs.writeFileSync(path.join(TEMP,'replace-icon.rhs'), rhs)
					code = await this.utils.spawn(this.RH,"-script replace-icon.rhs".split(' '), { cwd : TEMP, stdio });
					if(code) {
						console.log(`resource hacker (stage 2) failure; code: ${code}`);
						process.exit(1);
					}

					fse.move(path.join(TEMP,RESOURCE_TARGET+'.exe'),path.join(BUILD,RESOURCE_TARGET+'.exe'), { overwrite : true }, (err) => {
					//fse.move(path.join(TEMP,this.name+'.exe'),path.join(BUILD,this.name+'.exe'), { overwrite : true }, (err) => {
						if(err)
							return callback(err);

						callback();            
					})
				})
			})
		})
	}


	setup(callback) {
		return new Promise(async (resolve, reject) => {

			if(this.flags.nopackage)// || !this.options.innosetup)
				return resolve();

			if(!this.options.guid)
		 		return reject("Emanator::Windows::setup() - Missing GUID in options");

			if(!this.options.innosetup && !this.flags.inno && !this.flags.innosetup && !(this.targets||[]).includes('inno'))
				return;

			// let fw = {
			// 	this.firewallList
			// }


			this.setupFileSize_ = 0;

			let iss = fs.readFileSync(path.join(__dirname,'../templates/','template.iss'),'utf8');
			iss = ejs.render(iss, {
				guid : this.options.guid,
				path, 
				package : this.packageJSON, 
				group : this.options.group,
				ident : this.options.ident,
				identUCFC : this.identUCFC,
				title : this.options.title,
				author : this.options.author,
				url : this.options.url,
				suffix: this.suffix,
				options: this.options,
				firewallRules : this.firewallRules,
				RESOURCES :  path.join(this.appFolder,this.options.resources||'resources/setup'),
				USE_RAR : false,
				PLATFORM_ARCH : this.PLATFORM_ARCH,
				_,
				E : this
			});
			fs.writeFileSync(path.join(this.TEMP,this.ident+'-impl.iss'), iss);
			gutil.log("Running Inno Setup...");
			let code = await this.utils.spawn('C:/Program Files (x86)/Inno Setup 6/compil32.exe',['/cc', path.join(this.TEMP,this.ident+'-impl.iss')], { cwd : this.ROOT, stdio : 'inherit' });
			if(code)
				return reject('Error running Inno Setup - code: '+code);

			var file = path.join(this.SETUP,`${this.ident}-v${this.packageJSON.version}-${this.PLATFORM_ARCH}.exe`);
			var stats = fs.lstatSync(file);
			this.setupFileSize_ = stats.size;
			gutil.log('Inno Setup:'.cyan.bold,file.toString().bold,'-',(stats.size.toFileSize()+'').magenta.bold);

			let hash = await this.utils.fileHash(file, 'sha1');
			let hashFile = target+'.sha1sum';
			fs.writeFileSync(hashFile, hash);

			resolve();    
		})
	}

	async pfx() {
		return new Promise(async (resolve,reject) => {
			if(this.flags.nopackage || !this.options.sign)
				return resolve();

			gutil.log("Running Inno Setup...");
			var file = path.join(this.SETUP,`${this.ident}-windows-${this.packageJSON.version}${this.suffix}.exe`);
			let code = await this.utils.spawn(path.join(this.appFolder,"resources/signtool.exe"),['sign','/f', path.join(this.appFolder,'resources',this.ident+'.pfx'), file], { cwd : this.ROOT, stdio : 'inherit' });
			if(code)
				return reject('Error signing setup executable - code: '+code);

			var stats = fs.lstatSync(file);
			var sizeDiff = stats.size - this.setupFileSize_;
			gutil.log('Signed Setup:'.cyan.bold,file.toString().bold,'-',(stats.size.toFileSize()+'').magenta.bold,'- Signature Size:',(sizeDiff.toFileSize()).magenta.bold);

			resolve();    
		})
	}
}

module.exports = Windows;
