var _super = require('../object/PersistentObject');

module.exports = class ExtensibleObject extends _super {
    constructor() {
        super();
        this.custom = {};
    }

    describe() {}
    getCustom() {
        return this.custom;
    }
};
