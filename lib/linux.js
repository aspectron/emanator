const Core = require('./core');
const gutil = require('gulp-util');
const path = require('path');
const fse = require('fs-extra');

class Linux extends Core {

	constructor(appFolder, gulp, options) {
		super(appFolder, gulp, options);

		this.tasks.platform = [
			'linux_binaries',
			'archive'
		]
	}

	linux_binaries(callback) {
		if(!this.type.NWJS)
			return callback();
		
		fse.move(
			path.join(this.BUILD,'nw'), 
			path.join(this.BUILD,this.ident), 
			{ overwrite : true }, 
			callback
		);

	}


}

module.exports = Linux;