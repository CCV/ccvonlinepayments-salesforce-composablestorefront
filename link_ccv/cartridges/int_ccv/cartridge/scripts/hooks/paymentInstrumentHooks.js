'use strict';

var Status = require('dw/system/Status');
var Order = require('dw/order/Order');

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
    var ccvTransactionStatus = paymentInstrument.paymentTransaction && paymentInstrument.paymentTransaction.custom.ccv_transaction_status;

    if (!transactionReference || ccvTransactionStatus === 'failed') {
        if (order.status.value !== Order.ORDER_STATUS_FAILED) {
            var OrderMgr = require('dw/order/OrderMgr');
            OrderMgr.failOrder(order, true);
        }

        var ccvFailureCode = newPaymentInstrument.c_ccv_failure_code
        || (paymentInstrument.paymentTransaction && paymentInstrument.paymentTransaction.custom.ccv_failure_code);
        var ccvStatus = paymentInstrument.paymentTransaction && paymentInstrument.paymentTransaction.custom.ccv_transaction_status;

        order.addNote('Order failed',
        `Failed via order.payment_instrument.afterPATCH hook.
        CCV reference: ${transactionReference}
        CCV status: ${ccvStatus }
        CCV error: ${ccvFailureCode}
        `);
    }
};

exports.authorize = function (order, orderPaymentInstrument) {
    var { authorizeCCV, handleAuthorizationResult } = require('*/cartridge/scripts/authorizeCCV');

    try {
        var authResult = authorizeCCV(order, orderPaymentInstrument, 'storefront');
        var status = handleAuthorizationResult(authResult, order);
        return status;
    } catch (error) {
        var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv_auth');
        ccvLogger.error(`Error authorizing payment: ${error}`);
        return new Status(Status.ERROR);
    }
};

exports.authorizeCreditCard = function (order, orderPaymentInstrument) {
    var { authorizeCCV, handleAuthorizationResult } = require('*/cartridge/scripts/authorizeCCV');

    try {
        var authResult = authorizeCCV(order, orderPaymentInstrument, 'storefront');
        var status = handleAuthorizationResult(authResult, order);
        return status;
    } catch (error) {
        var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv_auth');
        ccvLogger.error(`Error authorizing payment: ${error}`);
        return new Status(Status.ERROR);
    }
};
