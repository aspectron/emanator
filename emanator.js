//
//	____ _  _ ____ _  _ ____ ___ ____ ____ 
//	|___ |\/| |__| |\ | |__|  |  |  | |__/ 
//	|___ |  | |  | | \| |  |  |  |__| |  \ 
//                                        
//
//	Copyright(c) 2017-2018 ASPECTRON Inc.
//	All Rights Reserved.
//	
//	Proprietary, for internal use only.
//

const PLATFORM = { win32 : 'windows', darwin : 'darwin', linux : 'linux' }[process.platform];

let Platform = require('./lib/'+PLATFORM);
let Util = require('./lib/util');

class Emanator extends Platform {
	constructor(appFolder, gulp, options) {
		super(appFolder, gulp, options);
	}
}

Emanator.Util = Util;

module.exports = Emanator;