var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv');
var { CCV_CONSTANTS, checkCCVTransaction } = require('*/cartridge/scripts/services/CCVPaymentHelpers');
var authorizationHandlers = require('*/cartridge/scripts/authorizationHandlers.js');
/**
 * Authorizes an order with CCV payment, and updates order status accordingly.
 * Must be called in a transactional context.
 * @param {dw.order.Order} order order being processed
 * @param {string<storefront|job>} context context of execution
 * @returns {Object} authorization status object
 */
exports.authorizeCCV = function (order, context) {
    var ccvTransactionReference = order.custom.ccvTransactionReference;
    var transactionStatusResponse;

    if (!ccvTransactionReference) {
        ccvLogger.warn(`No CCV transaction reference found for order ${order.orderNo}`);
        return { missingReference: true };
    }

    try {
        transactionStatusResponse = checkCCVTransaction(ccvTransactionReference);
    } catch (error) {
        return { error };
    }

    var status = transactionStatusResponse.status;
    var paymentInstrument = order.paymentInstruments[0];

    paymentInstrument.paymentTransaction.custom.ccv_transaction_status = status;
    paymentInstrument.paymentTransaction.custom.ccv_failure_code = transactionStatusResponse.failureCode || null;

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
 */
exports.handleAuthorizationResult = function (authResult, order) {
    var { status, currencyMismatch, priceMismatch, isAuthorized, error } = authResult;

    if (authResult.missingReference) {
        authorizationHandlers.failOrderWithHook({
            order,
            noteTitle: 'CCV payment failed',
            noteMsg: 'No ccvTransactionReference found in order.',
            authResult
        });
        return;
    }

    if (error) {
        throw new Error(`Error checking transaction status in order ${order.orderNo}: ${error}`);
    }

    if (status === CCV_CONSTANTS.STATUS.FAILED) {
        authorizationHandlers.handleFailed(order, authResult);
        return;
    }

    if (status === CCV_CONSTANTS.STATUS.MANUAL_INTERVENTION) {
        authorizationHandlers.handleManualIntervention(order, order.custom.ccvTransactionReference, authResult);
        return;
    }

    // paymentAmount or currency mismatch between SFCC and CCV
    if (status === CCV_CONSTANTS.STATUS.SUCCESS && (priceMismatch || currencyMismatch)) {
        authorizationHandlers.handlePriceOrCurrencyMismatch(order, authResult);
        return;
    }

    if (isAuthorized) {
        authorizationHandlers.handleSuccess(order, authResult);
        return;
    }
};
