const _ = require('underscore');
const colors = require('colors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const child_process = require('child_process');
const through = require('through2');
const PluginError = require('plugin-error');
const gutil = require('gulp-util');

class NWJC {

	constructor(core) {
		this.core = core;

		this.deps = { }
		if(!core.ROOT)
			throw new Error("need ROOT definition!")

		this.ROOT = core.ROOT;
		this.DEPS = core.DEPS;
		this.REPO = core.REPO;
		gutil.log("NWJC Operating on:".cyan.bold, this.ROOT);

		this.NWJC = path.join(this.DEPS,`nwjs-sdk-${this.core.NWJS_VERSION}-${this.core.NWJS_SUFFIX}-x64/nwjc`)
		
		this.scripts = { }
	}

//	HTML(...args) {
	HTML() {
		// let cb_ = args.pop();
		// let options = args.shift() || {};
		// if(!destination)
		// 	throw new Error("NWJC::dest() requires desination target folder");

		let fn = (target, enc, callback) => {

			if (!target || !target.contents)
				return callback(null, target);

			if (target.isStream()) {
				this.emit('error', new PluginError('gulp-nwjc', 'Streaming not supported!'));
				return callback(null, target);
			}

			let text = target.contents ? target.contents.toString() : '';
			let file = target.history.slice().shift();
			let folder = path.dirname(file);


 			let src = target.history.slice().shift();
 			//let dest = path.join(destination,src.substring(target.base.length));
			let ext = path.extname(src).toLowerCase();

			if(ext != '.html')
				return callback();

			gutil.log("NWJC:".cyan.bold,('...'+file.substring(this.core.RELEASE.length)).yellow.bold);

			this.digestHTML_({ text, file, folder }, (err, parsed) => {
				//target.contents = new Buffer(text);

//				console.log("NWJC writing file".magenta.bold, dest);
// 				fs.writeFile(dest, target.contents, callback);
//console.log("TEXT:",text);
 				//fs.writeFile(dest, text, callback);

 				if(text != parsed && !this.deps[src])
 				 	this.deps[src] = parsed;

//				callback(null, target);
				callback();
			})
		}

		return through.obj(fn);
	}


	dest(destination) {
		// console.log("NWJC DEST:",destination);
		if(!destination)
			throw new Error("NWJC::dest() requires desination target folder");

		let fn = (target, enc, callback) => {

			if (!target || !target.contents)
				return callback(null, target);

			if (target.isStream()) {
				this.emit('error', new PluginError('gulp-nwjc', 'Streaming not supported!'));
				return callback(null, target);
			}
			// console.log("Processing file:",JSON.parse(JSON.stringify(target)));

 			let src = target.history.slice().shift();
 			let dest = path.join(destination,src.substring(target.base.length));
			let folder = path.dirname(dest);
			let ext = path.extname(dest).toLowerCase();

 			if(ext != '.js') {
				if(!fs.existsSync(folder)) {
					// gutil.log("...creating",folder.substring(this.core.RELEASE.length).yellow.bold);
					mkdirp.sync(folder);
				}

				if(ext == '.html' && this.deps[src]) {
 					fs.writeFile(dest, this.deps[src], callback);
				}
				else {
 					fs.writeFile(dest, target.contents, callback);
 				}
 			}
 			else {

				let text = target.contents.toString(); //fs.readFileSync(src, { encoding : 'utf8' });
				let hash = crypto.createHash('sha1').update(text).digest('hex');
				if(this.scripts[hash]) {
					// console.log(`file found: ${hash}`);
					let dep = this.scripts[hash];
					dep.included = true;
					dest = dest.replace('.js','.bin');

					if(!fs.existsSync(folder)) {
						gutil.log("...creating",folder.substring(this.core.RELEASE.length).yellow.bold);
						mkdirp.sync(folder);
					}

					this.NWJCompiler(src, dest, () => {
						callback(null, target);
					})
				}
				else {
					gutil.log("...skipping (No HTML ref):".red, src.substring(target.base.length).red.bold);
					callback();
				}
			}
		}

		return through.obj(fn);
	}

	finish() {
		_.each(this.scripts, (script, hash) => {
			if(script.included)
				return;
			gutil.log("NWJC: ".cyan.bold+"HTML reference not found:".red.bold+' '+script.file);
		})
	}


	digestHTML_(target, callback) {
		let lines = target.text.split('\n');
		let deps = [ ]
		lines = _.map(lines, (v) => {
			let match = v.match(/(script).*src=".+\.js"/ig);
			if(match) {
				let file = match[0].replace(/(script).*src="/ig,'').replace('.js"',".js");
				if(file.match(/^http/ig) || file.match(/^\/lib/ig)) { // |^\/js
					return v;
				}
				else {
					let padding = v.indexOf('<')+1;
					let { folder } = target;
					let o = { folder, file, v, padding };
					deps.push(o);
					return o;
				}
			}
			return v;
		})

		let js = [ ]

		_.each(deps, (o) => {
			let { file } = o;
			let absolute = file;
			if(file.match(/^\//)) {
				gutil.log('   ...'+file.cyan);
			 	absolute = path.join(this.REPO,file);
			}
			else
			 	absolute = path.join(o.folder,file);


			if(!fs.existsSync(absolute)) {
				let title = target.file.substring(this.core.RELEASE.length);
		
				if(this.lastFault != title)
					gutil.log(title.yellow.bold+' - unable to locate: '.red.bold);
				this.lastFault = title;

				gutil.log('\t\t'.magenta.bold+file.magenta.bold);
			}
			else {

				let bin = file.replace('.js','.bin');
				o.replace = Array(o.padding).join(' ') 
					+ `<script>nw.Window.get().evalNWBin(null,"${bin}");</script>`;


				let text = fs.readFileSync(absolute, { encoding : 'utf8' });
				let hash = crypto.createHash('sha1').update(text).digest('hex');
				if(!this.scripts[hash])
					this.scripts[hash] = o;
				else
					return;
			}
		})

		lines = lines.map((o) => {
			if(_.isString(o))
				return o;

			// if(o.replace) {
			// 	console.log("~~~~~ REPLACING ~~~>".magenta.bold,o.v,"\n~~~~~ TO ~~~~~>".magenta.bold,o.replace);
			// }

			return o.replace || o.v; // (o.error ? o.v : o.replace);
		});

		callback(null, lines.join('\n'));
	}

	NWJCompiler(src, dst, callback) {
		gutil.log('NWJC |  +-:   '+src.substring(this.core.RELEASE.length).cyan);
		gutil.log('NWJC |  +---> '+dst.substring(this.core.RELEASE.length).green);
		// console.log("NWJC: ",this.NWJC,[src,dst]);
		this.core.util.spawn(this.NWJC,[src,dst], (err, code) => {
			if(code)
				throw new PluginError('NWJC',`NWJC Failed with code ${code} while compiling: ${src} -> ${dst}`);
			callback(err);
		})
	}
}

module.exports = NWJC;