const Core = require('./core');
const gutil = require('gulp-util');
const path = require('path');
const fs = require('fs');

class Linux extends Core {

	constructor(appFolder, gulp, options) {
		super(appFolder, gulp, options);

		this.tasks.platform = [
			'archive'
		]
	}


	archive(callback) {

		// exec(`zip`)
//		this.util.spawn('tar',[archiveFileName+'tgz', '-cvfz' ]

		let archive = this.options.archive || this.ident;

		let archiveFile = `../../setup/${archive}@${this.packageJSON.version}.zip`;
		this.util.spawn('zip',['-r', archiveFile, './'], {
			cwd : this.BUILD,
			stdio : 'inherit' 
		}, (err, code) => {

			let target = path.join(this.BUILD,archiveFile);
			let stat = fs.statSync(target);

			if(!stat || !stat.size) {

				console.log(`${archive}@${this.packageJSON.version}.zip is done (can not get stat)`)
			}
			else {
				console.log(`${archive}@${this.packageJSON.version}.zip - ${stat.size.toFileSize()} - Ok`)
			}

			callback();
		});
	}
}

module.exports = Linux;