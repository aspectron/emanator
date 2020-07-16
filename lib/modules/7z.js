const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');

const CACHE = { }
class _7z {

	constructor(core, options) {
		this.core = core;

		let binExtension = core.PLATFORM == 'windows' ? '.exe' : '';
	}

	async exec7zArchive(srcFolder, destFile, level) {
		if(fs.existsSync(destFile))
			fs.unlinkSync(destFile);
		let silent = false;
		let args = [];
		args.push('a');
		if(level !== 'undefined') {
			level = parseInt(level);
			if(isNaN(level))
				throw new Error(`7z compression level must be 1 to 9`);
			args.push(`-mx${level}`);
		}
		if(silent)
			args.push(`-bb0`);
		args.push(destFile);
		args.push('*');

		await spawn(_7z,args,{ cwd : srcFolder, stdio : 'inherit' });
		process.stdout.write('\n');
	}

	async createSFX(opts) {

		const { script, elevate, title, folder, wait, args } = opts;

		folder = folder || (title || 'emanator' ).replace(/[^a-zA-Z0-9]+/,'-');

		let elevateExec = '';
		if(elevate)
			elevateExec = 'elevate.exe -c -w';
		let params = `/C ${elevateExec}node.exe ${script}`;

		args.forEach((arg) => {
			params += ` ${arg.replace(/"/,'\\"')}`;
		})

		let instr = [];
		instr.push(';!@Install@!UTF-8!');
		title && instr.push(`Title="${title}"`);
		wait && instr.push(`Wait="${wait ? 'Yes' : 'No'}"`);
		instr.push(`ExecuteFile="cmd.exe"`);
		instr.push(`ExecuteParameters="${params}"`)
		instr.push(`Path="C:\\${folder}.tmp"`);
		instr.push(';!@InstallEnd@!');

		console.log(`Mering ${title} SFX...`);
		let sfx = fs.readFileSync(path.join(BIN,'7zSD.sfx'));
		let payload = fs.readFileSync(ARCHIVE);

		let fd = fs.openSync(dest,'w+');
		fs.appendFileSync(fd,sfx);
		fs.appendFileSync(fd,instr);
		fs.appendFileSync(fd,payload);
		fs.closeSync(fd);
	}
}

exports.Resolver = (core) => {
	return async (version) => {
		return new Promise(async (resolve, reject) => {
			console.log(`selecting go version ${version}`.bold)
			if(CACHE[version])
				return resolve(CACHE[version]);

			let folder = core.TOOLS;
			mkdirp(folder);
			let target = path.join(folder,version);
			if(!fs.existsSync(target))
				await FACTORY(core, { folder, target, version });

			resolve(new Go(core, { folder : target }));
		})
	}
}