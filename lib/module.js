
class Module {
    constructor(E) {
        this.E = E;
//        this.utils = E.utils;
        Object.entries(E.folders||{}).forEach(([k,v]) => { this[k] = v; });
    }

    log(...args) { return this.E.log(...args); }

}

module.exports = Module;