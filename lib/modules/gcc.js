const { spawn,  } = require('child_process');
const path = require('path');
const Module = require('../module');
const fs = require('fs');
const fse = require('fs-extra');
//const utils = require('../utils');

class GCC extends Module {
    constructor(E, options) {
        super(E);
        this.options = options || { };
    }
}

exports.Resolver = (E) => {
	return async (options) => {
        return new Promise(async (resolve, reject) => {

            try {

                if(E.PLATFORM == 'windows') {

                    GCC_VERSION = 'gcc-9.2.0-tdm64-1';
                    const GCC_FOLDER = path.join(E.TOOLS,GCC_VERSION);
                    E.addToPath(path.join(GCC_FOLDER,'bin'));
                    const GCC = path.join(GCC_FOLDER,'bin/gcc.exe');

                    try {
                        if(!fs.existsSync(GCC) || E.flags.clean || E.flags.reset || E.flags['reinit-gcc'])
                            throw { code : 'ENOENT', 'reason' : 'gcc binary missing' };
                        let gcc = (await E.exec(GCC,['--version'])).split('\n').shift();
                        E.log(gcc)
                        if(!/tdm64/.test(gcc))
                            throw { code : 'NOENT', reason : 'tdm compiler not detected' };
                    } catch(ex) {
                        if(ex.code == 'ENOENT') {
                            let urls = [];
                            if(/tdm64/i.test(GCC_VERSION)) {
                                urls.push(`https://github.com/jmeubank/tdm-gcc-src/releases/download/v9.2.0-tdm64-1/gcc-9.2.0-tdm64-1-core.zip`);
                                urls.push(`https://github.com/jmeubank/tdm-binutils-gdb/releases/download/v2.33.1-tdm64-1/binutils-2.33.1-tdm64-1.zip`);
                                urls.push(`https://github.com/jmeubank/mingw-w64/releases/download/v7-git20191109-gcc9-tdm64-1/mingw64runtime-v7-git20191109-gcc9-tdm64-1.zip`);
                                urls.push(`https://github.com/jmeubank/windows-default-manifest/releases/download/v6.4-x86_64_multi/windows-default-manifest-6.4-x86_64_multi.zip`);
                            }
                            else
                                throw `Unknown gcc compiler type ${GCC_VERSION}`;

                            if(fs.existsSync(GCC_FOLDER))
                                fse.emptyDirSync(GCC_FOLDER);

                            while(urls.length) {
                                let url = urls.shift();
                                let file = path.join(E.TEMP, path.basename(url));
                                await E.download(url, file);
                                await E.extract(file, GCC_FOLDER);
                            }
                        }
                        else
                            throw ex;
                    }
                } else {
                    const GCC = 'gcc';
                    let gcc = (await E.exec(GCC,['--version'])).split('\n').shift();
                    E.log(gcc);
                }

                resolve(new GCC(E, options));

            }
            catch(ex) {
                reject(ex);
            }

		})
	}
}
