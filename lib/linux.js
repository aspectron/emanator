const Core = require('./core');
const gutil = require('gulp-util');

class Linux extends Core {

	constructor(appFolder, gulp, options) {
		super(appFolder, gulp, options);

		this.tasks.platform = [
		]
	}

}

module.exports = Linux;