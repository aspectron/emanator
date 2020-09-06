const { spawn } = require('child_process');
const path = require('path');
const Graph = require('./graph');


exports.Resolver = (E) => {
	return async (options) => {
		return new Promise(async (resolve, reject) => {
			resolve(new Graph(E, options));
		})
	}
}



///////////////////////



