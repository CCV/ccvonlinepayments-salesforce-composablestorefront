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
        || paymentInstrument.custom.ccv_transaction_status === 'failed') {
        var OrderMgr = require('dw/order/OrderMgr');
        OrderMgr.failOrder(order, true);
    }
};

exports.authorize = function (order, orderPaymentInstrument) {
    try {
        return authorizeCCV(order, orderPaymentInstrument);
    } catch (error) {
        var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv_auth');
        ccvLogger.error(`Error authorizing payment: ${error}`);
        return new Status(Status.ERROR);
    }
};

exports.authorizeCreditCard = function (order, orderPaymentInstrument) {
    try {
        return authorizeCCV(order, orderPaymentInstrument);
    } catch (error) {
        var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv_auth');
        ccvLogger.error(`Error authorizing payment: ${error}`);
        return new Status(Status.ERROR);
    }
};

/**
 * Authorizes a CCV redirect payment
 * @param {*} order order to be authorized
 * @param {*} orderPaymentInstrument ccv payment instrument
 * @returns {dw.system.Status} status
 */
function authorizeCCV(order, orderPaymentInstrument) {
    var PaymentMgr = require('dw/order/PaymentMgr');
    var Money = require('dw/value/Money');
    var { checkCCVTransaction, CCV_CONSTANTS } = require('~/cartridge/scripts/services/CCVPaymentHelpers');

    var transactionReference = order.custom.ccvTransactionReference;

    if (!transactionReference) return new Status(Status.ERROR, '< CCV: no transaction reference in order >');

    var paymentProcessor = PaymentMgr.getPaymentMethod(orderPaymentInstrument.getPaymentMethod()).getPaymentProcessor();

    var transactionStatus = checkCCVTransaction(transactionReference);

    orderPaymentInstrument.paymentTransaction.setTransactionID(transactionReference);
    orderPaymentInstrument.custom.ccv_transaction_status = transactionStatus.status; // eslint-disable-line no-param-reassign
    orderPaymentInstrument.custom.ccv_failure_code = transactionStatus.failureCode || null; // eslint-disable-line no-param-reassign

    orderPaymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor; // eslint-disable-line no-param-reassign
    orderPaymentInstrument.paymentTransaction.type = transactionStatus.type === CCV_CONSTANTS.TRANSACTION_TYPE.AUTHORISE // eslint-disable-line no-param-reassign
        ? dw.order.PaymentTransaction.TYPE_AUTH
        : dw.order.PaymentTransaction.TYPE_CAPTURE;

    var transactionAmount = new Money(transactionStatus.amount, transactionStatus.currency.toUpperCase());

    if (transactionStatus.status === 'success'
        && transactionAmount.value === order.totalGrossPrice.value
        && transactionStatus.currency === order.currencyCode.toLowerCase()) {
        orderPaymentInstrument.paymentTransaction.setAmount(transactionAmount);

        return new Status(Status.OK);
    }

    return new Status(Status.ERROR);
}
