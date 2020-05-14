const { spawn } = require('child_process');
const path = require('path');
const Tool = require('../tool');

class NPM extends Tool {
    constructor(core, options) {
        super(core);
        this.options = options || { };
    }

    async $(op, ...args) {
		if(this.core.options.nonpm || this.core.flags.nonpm)
            return Promise.resolve();
        if(this.core.flags['dry-run']) {
            this.log('(dry run) skipping npm install');
            return Promise.resolve();
        }

        return this.utils.spawn(this.NPM,[op, ...args], 
            Object.assign({ cwd : this.core.PACKAGE, stdio : 'inherit' }, this.options ));
    }

    async install(...args) { return this.$('install',...args); }
    async update(...args) { return this.$('update',...args); }
}

exports.Resolver = (core) => {
	return async (options) => {
		return new Promise(async (resolve, reject) => {
			resolve(new NPM(core, options));
		})
	}
}
