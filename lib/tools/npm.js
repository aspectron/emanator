const { spawn } = require('child_process');
const path = require('path');
const Tool = require('../tool');

class NPM extends Tool {
    constructor(core, options) {
        super(core);
        this.options = options || { };

        this.NPM = 'npm'+(process.platform == 'win32' ? '.cmd' : '');
    }

    async $(op, ...args) {
		if(this.core.options.nonpm || this.core.flags.nonpm)
            return Promise.resolve();
        if(this.core.flags['dry-run']) {
            this.log('(dry run) skipping npm install');
            return Promise.resolve();
        }

        let options = args.pop() || { };
        if(!options.cwd)
            throw new Error(`Missing 'cwd' in npm $ options`);
        return this.utils.spawn(this.NPM,[op, ...args], options);
            
//            Object.assign({ cwd : this.core.PACKAGE, stdio : 'inherit' }, this.options ));
    }

    async install(...args) { return this.$('install',...args); }
    async update(...args) { return this.$('update',...args); }
    async run(...args) { return this.$('run',...args); }
}

exports.Resolver = (core) => {
	return async (options) => {
		return new Promise(async (resolve, reject) => {
			resolve(new NPM(core, options));
		})
	}
}
