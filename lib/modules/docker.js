const { spawn } = require('child_process');
const path = require('path');
const Module = require('../module');

class Docker extends Module {
    constructor(E, options) {
        super(E);
        this.options = options || { };

    }

    async build() {
        const { E } = this;

        E.manifest_read();

        const name = E.manifest.name;
        const relay = ['no-cache'];
        const args = ['-s','docker','build'].concat(relay.map(k=>E.flags[k]?`--${k}`:null)).filter(v=>v);
        args.push('-t',`${name}:latest`,'.');
        const ts0 = Date.now();
        await E.utils.spawn('sudo', args, { cwd : __dirname, stdio: 'inherit' });
        await E.utils.spawn('sudo',['docker','tag',`${name}:latest`,`${name}:${E.manifest.version}`], { cwd : __dirname, stdio: 'inherit' });
        console.log('Docker build complete at',new Date());
        const ts1 = Date.now();
        console.log('Docker build took'.brightBlue,`${((ts1-ts0)/1000/60).toFixed(1)}`.brightWhite,'minutes'.brightBlue)
    
    }

}

exports.Resolver = (E) => {
	return async (options) => {
		return new Promise(async (resolve, reject) => {
			resolve(new Docker(E, options));
		})
	}
}
