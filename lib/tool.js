
class Tool {
    constructor(core) {
        this.core = core;
        this.utils = core.utils;

        Object.entries(core.folders).forEach(([k,v]) => { this[k] = v; })
    }

    log(...args) { return this.core.log(...args); }

}

module.exports = Tool;