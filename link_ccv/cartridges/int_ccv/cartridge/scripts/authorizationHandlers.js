var HookMgr = require('dw/system/HookMgr');
var OrderMgr = require('dw/order/OrderMgr');
var Site = require('dw/system/Site');
var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv');

/**
 * Handler for orders with CCV payment status = failed
 * @param {dw.order.Order} order order being processed
 * @param {Object} authResult authorization result object
 */
function handleFailed(order, authResult) {
    ccvLogger.info(`Failed transaction in order ${order.orderNo}. Failing order.`);

    failOrderWithHook({
        order,
        noteTitle: 'CCV payment failed',
        noteMsg: 'transaction status: failed',
        authResult
    });
}

/**
 * Handler for orders with CCV payment status = manualintervention
 * @param {dw.order.Order} order order being processed
 * @param {Object} authResult authorization result object
 */
function handleManualIntervention(order, authResult) {
    order.custom.ccvManualIntervention = true; // eslint-disable-line no-param-reassign

    ccvLogger.warn(`Manual intevention required for orderNo: ${order.orderNo}. CCV reference: ${authResult.ccvTransactionReference}`);
}

/**
 * Handler for orders with CCV payment status = success but there is a mismatch in price or currency
 * @param {dw.order.Order} order order being processed
 * @param {Object} authResult authorization result object
 */
function handlePriceOrCurrencyMismatch(order, authResult) {
    var msg = `Payment amount or currency mismatch:
    (${authResult.transactionStatusResponse.amount} ${authResult.transactionStatusResponse.currency}) (${order.totalGrossPrice} ${order.currencyCode.toLowerCase()}).`;

    if (Site.current.getCustomPreferenceValue('ccvAutoRefundEnabled')) {
        try {
            var { refundCCVPayment } = require('*/cartridge/scripts/services/CCVPaymentHelpers');

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
        noteMsg: msg,
        authResult
    });

    ccvLogger.fatal(`${msg} Failing order ${order.orderNo}`);
}

/**
 * Handler for orders with CCV payment status = success
 * @param {dw.order.Order} order order being processed
 * @param {Object} authResult authorization result object
 */
function handleSuccess(order, authResult) {
    var orderTotal = order.totalGrossPrice;
    var paymentInstrument = order.paymentInstruments[0];
    var { transactionStatusResponse } = authResult;

    if (paymentInstrument.paymentTransaction.amount.valueOrNull === 0
        || paymentInstrument.paymentTransaction.amount.valueOrNull === null) {
        paymentInstrument.paymentTransaction.setAmount(orderTotal);
    }

    // create a new CCV card payment instrument for the customer if there is a vaultAccessToken in the response
    if (transactionStatusResponse.details && transactionStatusResponse.details.vaultAccessToken
        && Site.current.getCustomPreferenceValue('ccvStoreCardsInVaultEnabled')) {
        createCardPaymentInstrument(order, transactionStatusResponse);
    }

    OrderMgr.placeOrder(order);

    HookMgr.callHook('ccv.order.update.afterOrderAuthorized', 'afterOrderAuthorized', {
        order,
        authResult
    });

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
function failOrderWithHook({ order, noteTitle, noteMsg, authResult }) {
    OrderMgr.failOrder(order, true);
    order.addNote(noteTitle, noteMsg);

    HookMgr.callHook('ccv.order.update.afterOrderFailed', 'afterOrderFailed', { order, authResult });
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

module.exports = {
    handleFailed,
    handleManualIntervention,
    handlePriceOrCurrencyMismatch,
    handleSuccess,
    failOrderWithHook
};
