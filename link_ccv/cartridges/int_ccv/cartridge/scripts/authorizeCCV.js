var Status = require('dw/system/Status');
var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv');
var OrderMgr = require('dw/order/OrderMgr');
var PaymentTransaction = require('dw/order/PaymentTransaction');
var Site = require('dw/system/Site');
var PaymentMgr = require('dw/order/PaymentMgr');
var { CCV_CONSTANTS, checkCCVTransaction, refundCCVPayment } = require('*/cartridge/scripts/services/CCVPaymentHelpers');
var HookMgr = require('dw/system/HookMgr');

var authContext;

/**
 * Authorizes an order with CCV payment, and updates order status accordingly.
 * Must be called in a transactional context.
 * @param {dw.order.Order} order order being processed
 * @param {dw.order.OrderPaymentInstrument|undefined} orderPaymentInstrument order payment instrument (optional)
 * @param {string<storefront|job>} context context of execution
 * @returns {Object} authorization status object
 */
exports.authorizeCCV = function (order, orderPaymentInstrument, context) {
    var ccvTransactionReference = order.custom.ccvTransactionReference;
    var transactionStatusResponse;

    if (!ccvTransactionReference) {
        ccvLogger.warn(`No CCV transaction reference found for order ${order.orderNo}`);
        return { error: 'No CCV transaction reference found' };
    }

    try {
        transactionStatusResponse = checkCCVTransaction(ccvTransactionReference);
    } catch (error) {
        return { error };
    }

    var status = transactionStatusResponse.status;
    var paymentInstrument = orderPaymentInstrument || order.paymentInstruments[0];

    paymentInstrument.paymentTransaction.custom.ccv_transaction_status = status;
    paymentInstrument.paymentTransaction.custom.ccv_failure_code = transactionStatusResponse.failureCode || null;

    if (!paymentInstrument.paymentTransaction.transactionID) {
        var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor();

        paymentInstrument.paymentTransaction.setTransactionID(ccvTransactionReference);
        paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
        paymentInstrument.paymentTransaction.type = transactionStatusResponse.type === CCV_CONSTANTS.TRANSACTION_TYPE.AUTHORISE // eslint-disable-line no-param-reassign
            ? PaymentTransaction.TYPE_AUTH
            : PaymentTransaction.TYPE_CAPTURE;
    }

    var currencyMismatch = transactionStatusResponse.currency !== order.currencyCode.toLowerCase();
    var priceMismatch = transactionStatusResponse.amount !== order.totalGrossPrice.value;

    return {
        status: status,
        currencyMismatch,
        priceMismatch,
        ccvTransactionReference,
        transactionStatusResponse,
        context,
        isAuthorized: status === CCV_CONSTANTS.STATUS.SUCCESS && !currencyMismatch && !priceMismatch
    };
};

/**
 *
 * @param {Object} authResult authorization result object
 * @param {dw.order.Order} order order
 * @returns {dw.system.Status} Status.OK if auth is successful, otherwise Status.ERROR
 */
exports.handleAuthorizationResult = function (authResult, order) {
    authContext = authResult.context;

    var { status, transactionStatusResponse, currencyMismatch, priceMismatch, isAuthorized, error } = authResult;

    if (error) {
        handleError(order);
        return new Status(Status.ERROR, `< CCV: error: ${error}>`);
    }

    if (status === CCV_CONSTANTS.STATUS.FAILED) {
        handleFailed(order);
        return new Status(Status.ERROR, `< CCV: status: failed; ccvFailureCode: ${transactionStatusResponse.failureCode} >`);
    }

    if (status === CCV_CONSTANTS.STATUS.MANUAL_INTERVENTION) {
        handleManualIntervention(order, order.custom.ccvTransactionReference);
        return new Status(Status.ERROR, `< CCV: status: ${status} >`);
    }

    // paymentAmount or currency mismatch between SFCC and CCV
    if (status === CCV_CONSTANTS.STATUS.SUCCESS && (priceMismatch || currencyMismatch)) {
        handlePriceOrCurrencyMismatch(order, transactionStatusResponse);
        return new Status(Status.ERROR, '< CCV: price or currency mismatch >');
    }

    if (isAuthorized) {
        handleSuccess(order);
        HookMgr.callHook('ccv.order.update.afterOrderAuthorized', 'afterOrderAuthorized', {
            order,
            context: authContext
        });

        return new Status(Status.OK);
    }

    return new Status(Status.ERROR, `< CCV: no action taken, status=${status}>`);
};

/**
 * Handler for orders with CCV payment status = failed
 * @param {dw.order.Order} order order being processed
 */
function handleError(order) {
    ccvLogger.info(`No CCV transaction id in order ${order.orderNo}. Failing order.`);

    failOrderWithHook({
        order,
        noteTitle: 'CCV payment failed',
        noteMsg: 'No ccvTransactionReference found in order.'
    });
    // OrderMgr.failOrder(order);
    // order.addNote('CCV payment failed', 'No ccvTransactionReference found in order.');
}
/**
 * Handler for orders with CCV payment status = failed
 * @param {dw.order.Order} order order being processed
 * @param {string} context context where
 */
function handleFailed(order) {
    ccvLogger.info(`Failed transaction in order ${order.orderNo}. Failing order.`);

    failOrderWithHook({
        order,
        noteTitle: 'CCV payment failed',
        noteMsg: 'transaction status: failed'
    });
}

/**
 * Handler for orders with CCV payment status = manualintervention
 * @param {dw.order.Order} order order being processed
 * @param {string} ccvTransactionReference ccv transaction reference
 */
function handleManualIntervention(order, ccvTransactionReference) {
    order.custom.ccvManualIntervention = true; // eslint-disable-line no-param-reassign

    ccvLogger.warn(`Manual intevention required for orderNo: ${order.orderNo}. CCV reference: ${ccvTransactionReference}`);
}

/**
 * Handler for orders with CCV payment status = success but there is a mismatch in price or currency
 * @param {dw.order.Order} order order being processed
 * @param {Object} transactionStatusResponse response from ccv checkTransactionInfo call
 */
function handlePriceOrCurrencyMismatch(order, transactionStatusResponse) {
    var msg = `Payment amount or currency mismatch: (${transactionStatusResponse.amount} | ${order.totalGrossPrice}) (${transactionStatusResponse.currency} | ${order.currencyCode.toLowerCase()}).`;

    if (Site.current.getCustomPreferenceValue('ccvAutoRefundEnabled')) {
        try {
            var refundResult = refundCCVPayment({
                order: order,
                description: 'Price or currency mismatch - automatic refund/reversal'
            });
            if (refundResult) {
                order.addNote('CCV: Automatic refund initiated', 'reason: price/currency mismatch');
            }
        } catch (error) {
            order.addNote('CCV: Automatic refund failed', error);
        }
    }

    order.custom.ccvPriceOrCurrencyMismatch = true; // eslint-disable-line no-param-reassign

    failOrderWithHook({
        order,
        noteTitle: 'Order failed via CCV-handleAuthorizationResult',
        noteMsg: msg
    });

    // OrderMgr.failOrder(order);
    // order.addNote('Order failed via CCV-handleAuthorizationResult', msg);

    ccvLogger.fatal(`${msg} Failing order ${order.orderNo}`);
}

/**
 * Handler for orders with CCV payment status = success
 * @param {dw.order.Order} order order being processed
 */
function handleSuccess(order) {
    var orderTotal = order.totalGrossPrice;
    var paymentInstrument = order.paymentInstruments[0];

    if (paymentInstrument.paymentTransaction.amount.valueOrNull === 0
        || paymentInstrument.paymentTransaction.amount.valueOrNull === null) {
        paymentInstrument.paymentTransaction.setAmount(orderTotal);
    }

    ccvLogger.info(`Successful transaction: orderNo: ${order.orderNo}`);
}
/**
 * Fails the order and calls a hook
 * @param {Object} obj object
 * @param {dw.order.Order} obj.order order
 * @param {string} obj.noteTitle order note title
 * @param {string} obj.noteMsg order note message
 * @param {string} obj.context context where the hook was called - storefront or job
 * @param {Object} obj.details additional details
 *
 */
function failOrderWithHook({ order, noteTitle, noteMsg }) {
    OrderMgr.failOrder(order);
    order.addNote(noteTitle, noteMsg);

    HookMgr.callHook('ccv.order.update.afterOrderFailed', 'afterOrderFailed', { order, context: authContext });
}
