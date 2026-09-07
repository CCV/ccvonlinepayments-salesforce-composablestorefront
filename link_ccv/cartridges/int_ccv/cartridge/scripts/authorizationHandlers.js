var HookMgr = require('dw/system/HookMgr');
var OrderMgr = require('dw/order/OrderMgr');
var Site = require('dw/system/Site');
var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv');

/**
 * Writes the transaction details read from CCV onto the order and its payment instrument.
 * Must be called in a transactional context.
 *
 * @param {dw.order.Order} order order being processed
 * @param {Object} authResult authorization result object
 */
function applyTransactionDetails(order, authResult) {
    var details = authResult.transactionDetails;

    if (!details) {
        return;
    }

    var paymentInstrument = order.paymentInstruments[0];

    order.custom.ccvChildTransactionReference = details.ccvChildTransactionReference; // eslint-disable-line no-param-reassign
    paymentInstrument.custom.ccv_card_type = details.ccv_card_type;
    paymentInstrument.custom.ccv_landingpage_method = details.ccv_landingpage_method;
    paymentInstrument.paymentTransaction.custom.ccv_transaction_status = details.ccv_transaction_status;
    paymentInstrument.paymentTransaction.custom.ccv_failure_code = details.ccv_failure_code;
}

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
    var { CCV_CONSTANTS } = require('*/cartridge/scripts/services/CCVPaymentHelpers');
    var { addAddressDetails } = require('*/cartridge/scripts/helpers/CCVOrderHelpers');
    var Order = require('dw/order/Order');

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

    // update ideal fast checkout order shipping, billing, customer email
    if (paymentInstrument.custom.ccv_fast_checkout) {
        var consumerDataApplied = addAddressDetails({ transactionStatusResponse, order });

        if (!consumerDataApplied) {
            /**
             * CCV has not put the consumer details on the transaction yet. Queue the order so
             * CCVPayment-ProcessWebhookTransactions can pick them up shortly, rather than holding
             * up the order (and the shopper waiting on the redirect page) here.
             */
            var ccvWebhookTransactions = require('*/cartridge/scripts/helpers/ccvWebhookTransactions');
            ccvWebhookTransactions.enqueue(order);
            ccvLogger.info(`CCV: consumer data not available yet for order ${order.orderNo}, queued for enrichment.`);
        }
    }


    OrderMgr.placeOrder(order);

    if (transactionStatusResponse.type === CCV_CONSTANTS.TRANSACTION_TYPE.SALE) {
        order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
    }

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
 * @param {Object} obj.authResult authorization result
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
    applyTransactionDetails,
    handleFailed,
    handleManualIntervention,
    handlePriceOrCurrencyMismatch,
    handleSuccess,
    failOrderWithHook
};
