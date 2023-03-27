'use strict';

var Status = require('dw/system/Status');
var { checkCCVTransaction } = require('~/cartridge/scripts/services/CCVPaymentHelpers');

/**
 *  Custom Object Modify Get Hook
 * @param {Object} basket - the database object
 * @param {Object} paymentInstrument - the document
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
    return authorizeCCV(order, orderPaymentInstrument);
};

exports.authorizeCreditCard = function (order, orderPaymentInstrument) {
    return authorizeCCV(order, orderPaymentInstrument);
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

    var transactionReference = order.custom.ccvTransactionReference;

    if (!transactionReference) return new Status(Status.ERROR);

    var transactionStatus = checkCCVTransaction(transactionReference);
    orderPaymentInstrument.paymentTransaction.setTransactionID(transactionReference);
    // todo: transaction status on paymentTransaction isntead of instrument
    orderPaymentInstrument.custom.ccv_transaction_status = transactionStatus.status; // eslint-disable-line no-param-reassign
    orderPaymentInstrument.custom.ccv_failure_code = transactionStatus.failureCode || null; // eslint-disable-line no-param-reassign

    var paymentProcessor = PaymentMgr.getPaymentMethod(orderPaymentInstrument.getPaymentMethod()).getPaymentProcessor();
    orderPaymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor; // eslint-disable-line no-param-reassign

    var transactionAmount = new Money(transactionStatus.amount, transactionStatus.currency.toUpperCase());

    if (transactionStatus.status === 'success'
        && transactionAmount.value === order.totalGrossPrice.value
        && transactionStatus.currency === order.currencyCode.toLowerCase()) {

        orderPaymentInstrument.paymentTransaction.setAmount(transactionAmount);
        return new Status(Status.OK);
    }

    return new Status(Status.ERROR);
}
