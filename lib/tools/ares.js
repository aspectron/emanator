const { spawn } = require('child_process');
const path = require('path');
const Tool = require('../tool');

class ARES extends Tool {
    constructor(core, options) {
        super(core);
        this.options = options || { };

        let ares_ = this.core.utils.whereis('ares').shift();
        if(!ares_) {
            console.log('ares not found; please make sure ares executables are in the PATH environment variable...');
            process.exit(1);
        }

        this.core.log('Using ares at',ares_);
    }

    $(type, ...args) {
        return this.utils.spawn('cmd.exe',['/C',`ares-${type}.cmd`, ...args], { cwd : this.options.root || this.core.BUILD, stdio : 'inherit' });
    }

    package(...args) { return this.$('package', ...args); }
    install(...args) { return this.$('install', ...args); }
    launch(...args) { return this.$('launch', ...args); }
    inspect(...args) { return this.$('inspect', ...args); }
}

exports.Resolver = (core) => {
	return async (options) => {
		return new Promise(async (resolve, reject) => {
			resolve(new ARES(core, options));
		})
	}
}
