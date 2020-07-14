const { spawn } = require('child_process');
const path = require('path');
const Module = require('../module');

class NWJS extends Module {
    constructor(E, options) {
        super(E);
        this.options = options || { };

		if(options.version) {
			this.NWJS_VERSION = 'v'+options.version;
			this.NWJS_VERSION_NO_V = options.version;
		}
		else {
			console.log(`Error: NWJS tool 'options.version' is missing`);
			process.exit(1);
		}

    }



	async ffmpeg_download() {
		if(!this.options?.ffmpeg)
			return;
		// https://github.com/iteufel/nwjs-ffmpeg-prebuilt/releases
		let file = `${this.NWJS_VERSION_NO_V}-${this.NWJS_SUFFIX}-x64.zip`
		let url = `https://github.com/iteufel/nwjs-ffmpeg-prebuilt/releases/download/${this.NWJS_VERSION_NO_V}/${file}`;
		return E.download(url,path.join(E.DEPS,file));
	}

	async ffmpeg_unzip() {
		if(!this.options.nwjs?.ffmpeg)
			return;
		if(this.flags.fast)
			return;

		let file = `${this.NWJS_VERSION_NO_V}-${this.NWJS_SUFFIX}-x64.zip`;
		return E.unzip(path.join(E.DEPS,file), E.DEPS);//, callback);
	}

	ffmpeg_copy(callback) {
		if(!this.options.nwjs?.ffmpeg)
			return callback();

		switch(process.platform) {
			case 'win32' : {
				return gulp.src(path.join(E.DEPS,"/ffmpeg*"))
					.pipe(gulp.dest(this.BUILD));
			} break;

			case 'linux':{
				return gulp.src(path.join(E.DEPS,"libffmpeg.so"))
					.pipe(gulp.dest(path.join(this.BUILD,"lib")));
			}
			case 'darwin': {
				var versions = path.join(this.BUILD,'nwjs.app/Contents/Frameworks/nwjs Framework.framework/Versions');
				var list = fs.readdirSync(versions);
				this.utils.asyncMap(list, (v, next) => {
					fse.copy(
						path.join(E.DEPS, "libffmpeg.dylib"),
						path.join(versions, v, "libffmpeg.dylib"),
						{overwrite:true},
						next
					);
				}, callback);
			} break;
		}
	}

	async download_sdk() {
		let file = `nwjs-sdk-${this.NWJS_VERSION}-${this.NWJS_SUFFIX}-x64.${E.BINARIES_ARCHIVE_EXTENSION}`
		let url = `https://dl.nwjs.io/${this.NWJS_VERSION}/${file}`;
		return E.download(url,path.join(E.DEPS,file));
	}

	async download_normal() {
		let file = `nwjs-${this.NWJS_VERSION}-${this.NWJS_SUFFIX}-x64.${E.BINARIES_ARCHIVE_EXTENSION}`
		let url = `https://dl.nwjs.io/${this.NWJS_VERSION}/${file}`;
		return this.utils.download(url,path.join(E.DEPS,file));
	}

	async unzip_sdk() {
		if(this.flags.fast)
			return;

		let file = `nwjs-sdk-${this.NWJS_VERSION}-${this.NWJS_SUFFIX}-x64.${E.BINARIES_ARCHIVE_EXTENSION}`;
		await this.utils.unzip(path.join(E.DEPS,file), E.DEPS);
	}

	async unzip_normal(callback) {
		if(this.flags.fast)
			return;

		let file = `nwjs-${this.NWJS_VERSION}-${this.NWJS_SUFFIX}-x64.${E.BINARIES_ARCHIVE_EXTENSION}`;
		return this.utils.unzip(path.join(E.DEPS,file),E.DEPS);
	}

	unlink_nwjs_app(callback) {
		let appFile = path.join(E.BUILD, 'nwjs.app');
		if(!fs.existsSync(appFile)){
			callback()
		} else {
			fse.remove(appFile, function(){
				callback()
			});
		}
	}

	copy(callback) {
		let folder = path.join(E.DEPS,`nwjs-${this.NWJS_VERSION}-${this.NWJS_SUFFIX}-x64`);
		if(!this.flags.release)
			folder = path.join(E.DEPS,`nwjs-sdk-${this.NWJS_VERSION}-${this.NWJS_SUFFIX}-x64`);
		if(PLATFORM == "darwin")
			return E.spawn('cp', ['-R', folder+"/.", E.BUILD], { cwd : E.BUILD, stdio: 'inherit' });

		return gulp.src(path.join(folder,"/**"))
			.pipe(gulp.dest(E.BUILD));
	}

	cleanup(callback) {
		fse.move(path.join(E.BUILD,'credits.html'),path.join(E.BUILD,'chrome_credits.html'),{ overwrite : true },callback); 
	}
    
}

exports.Resolver = (E) => {
	return async (options) => {
		return new Promise(async (resolve, reject) => {
			resolve(new NWJS(E, options));
		})
	}
}
