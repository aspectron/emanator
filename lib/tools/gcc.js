const { spawn,  } = require('child_process');
const path = require('path');
const Tool = require('../tool');
//const utils = require('../utils');

class GCC extends Tool {
    constructor(core, options) {
        super(core);
        this.options = options || { };
    }

    // async $(op, ...args) {
	// 	if(this.core.options.nonpm || this.core.flags.nonpm)
    //         return Promise.resolve();
    //     if(this.core.flags['dry-run']) {
    //         this.log('(dry run) skipping npm install');
    //         return Promise.resolve();
    //     }

    //     return this.utils.spawn(this.NPM,[op, ...args], 
    //         Object.assign({ cwd : this.core.PACKAGE, stdio : 'inherit' }, this.options ));
    // }

}

exports.Resolver = (core) => {

	return async (options) => {

        try {
            let version = await core.utils.exec('gcc',['--version']);
            core.log(version.split('\n').shift().trim());
        } catch(ex) {
            console.log('error running GCC');
            console.log(ex);
            process.exit(1);
        }
    

        return new Promise(async (resolve, reject) => {
			resolve(new GCC(core, options));
		})
	}
}
