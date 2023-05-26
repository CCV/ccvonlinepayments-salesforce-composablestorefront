var ExtensibleObject = require('../object/ExtensibleObject');

module.exports = class SitePreferences extends ExtensibleObject {
    constructor() {
        super();
        this.sourceCodeURLParameterName = null;
    }
    getSourceCodeURLParameterName() {}
};
