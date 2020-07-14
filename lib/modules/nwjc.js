const { spawn } = require('child_process');
const path = require('path');
const Module = require('../module');

class NWJC extends Module {
    constructor(E, options) {
        super(core);
        this.options = options || { };
    }


}

exports.Resolver = (E) => {
	return async (options) => {
		return new Promise(async (resolve, reject) => {
			resolve(new NWJC(E, options));
		})
	}
}
