const Core = require('./core');
const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const ejs = require('ejs');
const _ = require('underscore');
const gutil = require('gulp-util');


class Windows extends Core {

	constructor(appFolder, gulp, options) {
		super(appFolder, gulp, options);

		if(!options.guid && !options.upload)
			throw new Error("Emanator::Windows::ctor() - Missing GUID in options");

		this.tasks.platform = [
			'resources',
			'setup'
		]

		if(options.pfx)
			this.tasks.platform.push('pfx');

		this.RH = path.join(__dirname,'../bin/rh.exe');
	}


	resources(callback) {

		if(this.flags.nopackage)
			return callback();

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

				fse.move(path.join(BUILD,'nw.exe'), path.join(TEMP,'nw.exe'), { overwrite : true }, (err) => {
					if(err)
						return callback(err);

					let rc = fs.readFileSync(path.join(__dirname,'../templates/','template.rc'),'utf8');
					rc = ejs.render(rc, { 
						group : this.options.group,
						ident : this.options.ident,
						identUCFC : this.identUCFC,
						title : this.options.title,
						author : this.options.author,
						url : this.options.url,
						suffix: this.suffix,
						options: this.options,
						//RESOURCES :  path.join(this.appFolder,'resources'),
					});
					fs.writeFileSync(path.join(this.TEMP,this.ident+'.rc'), rc);
					
					this.util.spawn(this.RH,(`-open ${this.ident}.rc -action compile -save ${this.ident}.res -log CON`).split(' '), { cwd : TEMP, stdio : 'inherit' }, (err, code) => {
						if(!err && code)
							err = 'resource hacker (stage 0) failure; code: '+code;


						this.util.spawn(this.RH,(`-open nw.exe -resource ${this.ident}.res -action addoverwrite -mask VERSIONINFO,,1033 -save ${this.ident}.exe -log CON`).split(' '), { cwd : TEMP, stdio : 'inherit' }, (err, code) => {
							if(!err && code)
								err = 'resource hacker (stage 1) failure; code: '+code;

							if(err) {
								console.log(err);
								process.exit(1);
							}

							let rhs = 
`[FILENAMES]
Exe=    <%- ident %>.exe
SaveAs= <%- ident %>.exe
Log=CONSOLE
[COMMANDS]
-addoverwrite "<%- path.join(RESOURCES,ident+'.ico') %>", ICONGROUP,IDR_MAINFRAME,
`

							rhs = ejs.render(rhs, { path, ident : this.ident, RESOURCES : path.join(this.appFolder,'resources') });
							fs.writeFileSync(path.join(TEMP,'replace-icon.rhs'), rhs)
							this.util.spawn(this.RH,"-script replace-icon.rhs".split(' '), { cwd : TEMP, stdio : 'inherit' }, (err, code) => {
								if(!err && code)
									err = 'resource hacker (stage 2) failure; code: '+code;

								if(err) {
									console.log(err);
									process.exit(1);
								}

								fse.move(path.join(TEMP,this.ident+'.exe'),path.join(BUILD,this.ident+'.exe'), { overwrite : true }, (err) => {
									if(err)
										return callback(err);

									callback();            
								})
							})
						})
					})
				})
			})
		})
	}


	setup(callback) {

		if(this.flags.nopackage)
			return callback();

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
			RESOURCES :  path.join(this.appFolder,'resources'),
			USE_RAR : false
		});
		fs.writeFileSync(path.join(this.TEMP,this.ident+'-impl.iss'), iss);
		gutil.log("Running Inno Setup...");
		this.util.spawn('C:/Program Files (x86)/Inno Setup 5/compil32.exe',['/cc', path.join(this.TEMP,this.ident+'-impl.iss')], { cwd : this.ROOT, stdio : 'inherit' }, (err, code) => {
			err && console.log(err);
			if(code)
				return callback('Error running Inno Setup - code: '+code);

			var file = path.join(this.SETUP,`${this.ident}-windows-${this.packageJSON.version}${this.suffix}.exe`);
			var stats = fs.lstatSync(file);
			this.setupFileSize_ = stats.size;
			gutil.log('Inno Setup:'.cyan.bold,file.toString().bold,'-',(stats.size.toFileSize()+'').magenta.bold);

			callback();    
		})
	}

	pfx(callback) {

		if(this.flags.nopackage)
			return callback();

		gutil.log("Running Inno Setup...");
		var file = path.join(this.SETUP,`${this.ident}-windows-${this.packageJSON.version}${this.suffix}.exe`);
		this.util.spawn(path.join(this.appFolder,"resources/signtool.exe"),['sign','/f', path.join(this.appFolder,'resources',this.ident+'.pfx'), file], { cwd : this.ROOT, stdio : 'inherit' }, (err, code) => {
			err && console.log(err);
			if(code)
				return callback('Error signing setup executable - code: '+code);

			var stats = fs.lstatSync(file);
			var sizeDiff = stats.size - this.setupFileSize_;
			gutil.log('Signed Setup:'.cyan.bold,file.toString().bold,'-',(stats.size.toFileSize()+'').magenta.bold,'- Signature Size:',(sizeDiff.toFileSize()).magenta.bold);

			callback();    
		})
	}
}

module.exports = Windows;
