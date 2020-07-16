const { spawn } = require('child_process');
const path = require('path');
const Module = require('../module');

class NPM extends Module {
    constructor(E, options) {
        super(E);
        this.options = options || { };

        this.NPM = 'npm'+(process.platform == 'win32' ? '.cmd' : '');
    }

    async $(op, ...args) {
        const { E } = this;
		if(E.options.nonpm || E.flags.nonpm)
            return Promise.resolve();
        if(E.flags['dry-run']) {
            this.log('(dry run) skipping npm install');
            return Promise.resolve();
        }

        let options = args.pop() || { };
        if(!options.cwd)
            throw new Error(`Missing 'cwd' in npm $ options`);

        if(this.options.production && op == 'install' && !args.includes('--production'))
            args.unshift('--production');
        return this.utils.spawn(this.NPM,[op, ...args], options);
            
//            Object.assign({ cwd : this.core.PACKAGE, stdio : 'inherit' }, this.options ));
    }

    async install(...args) { return this.$('install',...args); }
    async update(...args) { return this.$('update',...args); }
    async run(...args) { return this.$('run',...args); }
    async link(...args) { return this.$('link',...args); }
}

exports.Resolver = (E) => {
	return async (options) => {
		return new Promise(async (resolve, reject) => {
			resolve(new NPM(E, options));
		})
	}
}
