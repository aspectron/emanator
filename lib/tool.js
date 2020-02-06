
class Tool {
    constructor(core) {
        this.core = core;
        this.utils = core.utils;
    }

    log(...args) { return this.core.log(...args); }

}

module.exports = Tool;