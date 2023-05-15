var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv');
var OrderMgr = require('dw/order/OrderMgr');
var Site = require('dw/system/Site');
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
        return { missingReference: true };
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
    authContext = authResult.context;

    var { status, transactionStatusResponse, currencyMismatch, priceMismatch, isAuthorized, error } = authResult;

    if (authResult.missingReference) {
        failOrderWithHook({
            order,
            noteTitle: 'CCV payment failed',
            noteMsg: 'No ccvTransactionReference found in order.'
        });
        return;
    }

    if (error) {
        throw new Error(`Error checking transaction status in order ${order.orderNo}: ${error}`)
    }

    if (status === CCV_CONSTANTS.STATUS.FAILED) {
        handleFailed(order);
        return;
    }

    if (status === CCV_CONSTANTS.STATUS.MANUAL_INTERVENTION) {
        handleManualIntervention(order, order.custom.ccvTransactionReference);
        return;
    }

    // paymentAmount or currency mismatch between SFCC and CCV
    if (status === CCV_CONSTANTS.STATUS.SUCCESS && (priceMismatch || currencyMismatch)) {
        handlePriceOrCurrencyMismatch(order, transactionStatusResponse);
        return;
    }

    if (isAuthorized) {
        // create a new CCV card payment instrument for the customer if there is a vaultAccessToken in the response
        if (transactionStatusResponse.details && transactionStatusResponse.details.vaultAccessToken
            && Site.current.getCustomPreferenceValue('ccvStoreCardsInVaultEnabled')) {
            createCardPaymentInstrument(order, transactionStatusResponse);
        }
        handleSuccess(order);
        HookMgr.callHook('ccv.order.update.afterOrderAuthorized', 'afterOrderAuthorized', {
            order,
            context: authContext
        });

        return;
    }
};

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

    OrderMgr.placeOrder(order);
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
    OrderMgr.failOrder(order, true);
    order.addNote(noteTitle, noteMsg);

    HookMgr.callHook('ccv.order.update.afterOrderFailed', 'afterOrderFailed', { order, context: authContext });
}

/**
 * Creates a payment instrument for the customer based on a vaultAccessToken from CCV
 * @param {dw.order.Order} order order
 * @param {Object} transactionStatusResponse response from check transaction status call
 */
function createCardPaymentInstrument(order, transactionStatusResponse) {
    var customerPaymentInstrument = order.customer.profile.wallet.createPaymentInstrument('CCV_CREDIT_CARD');
    customerPaymentInstrument.custom.ccvVaultAccessToken = transactionStatusResponse.details.vaultAccessToken;
    customerPaymentInstrument.custom.ccv_method_id = 'card';
    customerPaymentInstrument.setCreditCardNumber(transactionStatusResponse.details.maskedPan);
    var expiryDate = transactionStatusResponse.details.expiryDate;

    customerPaymentInstrument.setCreditCardType(transactionStatusResponse.details.brand);
    if (expiryDate && expiryDate.length === 4) {
        var expirationMonth = expiryDate.substring(0, 2);
        var expirationYear = expiryDate.substring(2, 4);
        customerPaymentInstrument.setCreditCardExpirationMonth(+expirationMonth);
        customerPaymentInstrument.setCreditCardExpirationYear(+`20${expirationYear}`);
    }
}
