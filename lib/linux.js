const Core = require('./core');
const path = require('path');
const fse = require('fs-extra');

class Linux extends Core {

	constructor(appFolder, options) {
		super(appFolder, options);

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