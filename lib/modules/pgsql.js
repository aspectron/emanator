const fs = require('fs');
const path = require('path');
const Module = require('../module');

class PgSQL extends Module {
    constructor(E, options) {
        super(E);
        this.options = options || { };

    }

    exists(destination) {
        const pgsqlFolder = fs.readdirSync(destination).filter(f => f.match(/^postgresql/i)).shift();
        return !!pgsqlFolder;
    }

    async deploy(destination) {
        const { E } = this;

        if(!destination)
            destination = E.BIN;

        if(E.PLATFORM == 'linux')
            return Promise.resolve();

        if(E.flags.nodb || E.flags.nosql || E.flags.nopgsql)
            return Promise.resolve();

        const pgsql = {
            windows : { 
                url : 'http://sbp.enterprisedb.com/getfile.jsp?fileid=12454', 
                file : `postgresql-12.2-2-windows-x64-binaries.zip` 
            },
            darwin : { 
                url : 'https://sbp.enterprisedb.com/getfile.jsp?fileid=12475', 
                file : `postgresql-12.2-3-osx-binaries.zip` 
            }
        }[E.PLATFORM];
        // `postgresql-12.2-3-osx-binaries.zip`.match(/^\w+-(\d).(\d)-(\d)/)
        const [, major, minor, release_] = pgsql.file.match(/^\w+-(\d+).(\d+)-(\d+)/);
        const version = `${major}.${minor}.${release_}`;

        E.utils.resetTTY();

        const file = path.join(E.DEPS,pgsql.file);
        const basename = path.basename(pgsql.file).replace(/\.(zip|tar|tar.gz|tar.xz)$/,'');
        const archiveFolder = path.join(E.DEPS, basename);
        if(!fs.existsSync(file) || !fs.existsSync(path.join(archiveFolder,'pgsql'))) {
            await E.download(pgsql.url,file);
            await E.unzip(file, archiveFolder);
        }

        const targetBinFolder = path.join(destination,basename);
        if(fs.existsSync(targetBinFolder)) {
            E.log(`WARNING: previous pgSQL deployment found...`.brightRed,);
            E.log(`         cleaning up existing ${targetBinFolder}...`);
            await E.remove(targetBinFolder);
        }
        await E.mkdirp(targetBinFolder);

        E.log(`deploying ${basename}...`);
        let folders = ['bin','lib','share'];

        // --pgsql-full-distro adds 425 Mb to the final distribution :/
        if(E.flags['pgsql-full-distro'])
            folders.push('pgadmin 4', 'stackbuilder', 'symbols', 'include', 'doc');

        const jobs = folders.map((f) => {
            if(E.PLATFORM == 'windows') {
                return E.copy(path.join(archiveFolder,'pgsql',f), path.join(targetBinFolder,f));
            }
            else
                return E.spawn('cp', ['-R',path.join(archiveFolder,'pgsql',f),path.join(targetBinFolder,f)], { cwd : E.DEPS, stdio: 'inherit' });
        })
        await Promise.all(jobs);

        [ 'postgres', 'pg_ctl', 'psql', 'initdb' ].forEach((f) => {
            let name = `pgSQL ${f}`;
            let file = path.join(basename, 'bin', f+E.PLATFORM_BINARY_EXTENSION);
            E.registerFirewallRule({ name, file, binary : true });
        })

        E.log('...pgsql deployed to', targetBinFolder);
        // E.log('PgSQL deploy done');
    //})
    }

}

exports.Resolver = (E) => {
	return async (options) => {
		return new Promise(async (resolve, reject) => {
			resolve(new PgSQL(E, options));
		})
	}
}
