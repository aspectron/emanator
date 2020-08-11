const { spawn } = require('child_process');
const path = require('path');
const Module = require('../module');

class Docker extends Module {
    constructor(E, options) {
        super(E);
        this.options = options || { };

    }

    async build(options) {
        const { E } = this;

        E.manifest_read();
        // console.log("APP FOLDER:",E.appFolder);

        const cwd = options.cwd || E.appFolder;

        const name = E.manifest.name;//.split('-').pop();
        const relay = ['no-cache'];
        const args = ['-s','docker','build'].concat(relay.map(k=>E.flags[k]?`--${k}`:null)).filter(v=>v);
        args.push('-t',`${name}:latest`);
        if(options.dockerfile)
            args.push('-f',options.dockerfile);
        args.push('.');
        //console.log(args);
        const ts0 = Date.now();
        await E.utils.spawn('sudo', args, { cwd, stdio: 'inherit' });
        await E.utils.spawn('sudo',['docker','tag',`${name}:latest`,`${name}:${E.manifest.version}`], { cwd, stdio: 'inherit' });
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
