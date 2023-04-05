'use strict';
var Status = require('dw/system/Status');
var CacheMgr = require('dw/system/CacheMgr');
var Site = require('dw/system/Site');
/**
 * Adds CCV payment method options to the SFCC payment methods
 * @param {dw.order.Basket} basket customer basket
 * @param {Object} paymentMethodResultResponse payment method response to be modified
 * @returns {dw.system.Status} status
 */
exports.modifyGETResponse_v2 = function (basket, paymentMethodResultResponse) {
    var collections = require('*/cartridge/scripts/util/collections');

    var cache = CacheMgr.getCache('ccvPaymentMethodsCache');
    var paymentMethodsMap = cache.get(`${Site.current.ID}_methods`, fetchCCVPaymentMethods);

    collections.map(paymentMethodResultResponse.applicablePaymentMethods, (method) => {
        var ccvMethodId = method.c_ccvMethodId;
        if (!ccvMethodId) {
            return;
        }
        var options = paymentMethodsMap[ccvMethodId] && paymentMethodsMap[ccvMethodId].options;
        if (options) {
            method.c_ccvOptions = paymentMethodsMap[ccvMethodId].options; // eslint-disable-line no-param-reassign
        }
    });
    return new Status(Status.OK);
};

/**
 * Fetches payment methods data from CCV
 * @returns {Object} mapped object of CCV payment methods
 */
function fetchCCVPaymentMethods() {
    var { getCCVPaymentMethods } = require('~/cartridge/scripts/services/CCVPaymentHelpers');
    var ccvPaymentMethods = getCCVPaymentMethods();
    var paymentMethodsMap = {};

    ccvPaymentMethods.toArray().forEach(methodData => {
        paymentMethodsMap[methodData.method] = methodData;
    });

    return paymentMethodsMap;
}
