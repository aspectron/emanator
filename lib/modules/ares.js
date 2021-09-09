const { spawn } = require('child_process');
const path = require('path');
const Module = require('../module');

class ARES extends Module {
    constructor(E, options) {
        super(E);
        this.options = options || { };

        let ares_ = E.utils.whereis('ares').shift();
        if(!ares_) {
            console.log('ares not found; please make sure ares executables are in the PATH environment variable...'.red);
            process.exit(1);
        }
        
        E.log('Using ares at',ares_);
    }

    async $(type, ...args) {
        await this.E.utils.spawn('cmd.exe',['/C',`ares-${type}.cmd`, ...args], { cwd : this.options.root || this.core.BUILD, stdio : 'inherit' });
    }
    async package(...args) { return this.$('package', ...args); }
    async install(...args) { return this.$('install', ...args); }
    async launch(...args) { return this.$('launch', ...args); }
    async inspect(...args) { return this.$('inspect', ...args); }
}

exports.Resolver = (E) => {
	return async (options) => {
		return new Promise(async (resolve, reject) => {
			resolve(new ARES(E, options));
		})
	}
}
