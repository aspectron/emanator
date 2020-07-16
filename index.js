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
let Utils = require('./lib/utils');

class Emanator extends Platform {
	constructor(...args) {
		let options = args.pop() || {};
		let appFolder = args.pop() || process.cwd();
	
		super(appFolder, options);
	}
}

Emanator.Utils = Utils;
Emanator.utils = new Utils({});

module.exports = Emanator;