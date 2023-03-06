'use strict';

var toCamel = function (string) {
    // eslint-disable-next-line no-useless-escape
    return string.replace(/(\-[a-z])/g, function ($1) { return $1.toUpperCase().replace('-', ''); });
};

/**
 *  Custom Object Modify Get Hook
 * @param {Object} customObject - the database object
 * @param {Object} doc - the document
 */
exports.modifyGETResponse = function (customObject, doc) {
    if (customObject.type === 'CustomApi') {
        var result = require('*/cartridge/scripts/apis/' + toCamel(customObject.custom.ID)).get(request.httpParameters);
        // TODO: return only necessary data - payUrl, status
        // eslint-disable-next-line no-param-reassign
        doc.c_result = result;
    }
};
