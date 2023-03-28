'use strict';

var Status = require('dw/system/Status');

/**
 * Hook fired after PATCH orders/_*_/payment_instruments/_*_
 * @param {Object} order - the database object
 * @param {Object} paymentInstrument - the document
 * @param {Object} newPaymentInstrument - new payment attributes from ocapi request
 */
exports.afterPATCH = function (order, paymentInstrument, newPaymentInstrument) {
    if (newPaymentInstrument.c_ccvTransactionReference) {
        order.custom.ccvTransactionReference = newPaymentInstrument.c_ccvTransactionReference; // eslint-disable-line no-param-reassign
    }

    var transactionReference = order.custom.ccvTransactionReference;

    // todo: store in vault
    if (!transactionReference
        || (paymentInstrument.custom.ccv_transaction_status === 'failed'
        && order.status.value !== dw.order.Order.ORDER_STATUS_FAILED)) {
        var OrderMgr = require('dw/order/OrderMgr');
        OrderMgr.failOrder(order, true);
    }
};

exports.authorize = function (order, orderPaymentInstrument) {
    var { authorizeCCV } = require('*/cartridge/scripts/authorizeCCV');

    try {
        return authorizeCCV(order, orderPaymentInstrument);
    } catch (error) {
        var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv_auth');
        ccvLogger.error(`Error authorizing payment: ${error}`);
        return new Status(Status.ERROR);
    }
};

exports.authorizeCreditCard = function (order, orderPaymentInstrument) {
    var { authorizeCCV } = require('*/cartridge/scripts/authorizeCCV');

    try {
        return authorizeCCV(order, orderPaymentInstrument);
    } catch (error) {
        var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv_auth');
        ccvLogger.error(`Error authorizing payment: ${error}`);
        return new Status(Status.ERROR);
    }
};
