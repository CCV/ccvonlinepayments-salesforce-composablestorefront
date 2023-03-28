var Status = require('dw/system/Status');
var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv');
var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var Site = require('dw/system/Site');
var Transaction = require('dw/system/Transaction');
var { CCV_CONSTANTS, checkCCVTransaction, refundCCVPayment } = require('~/cartridge/scripts/services/CCVPaymentHelpers');
var PaymentMgr = require('dw/order/PaymentMgr');

var jobStatus = new Status(Status.OK);

exports.execute = function () {
    OrderMgr.processOrders(checkOrderStatus, `status=${Order.ORDER_STATUS_CREATED}`);

    return jobStatus;
};

/**
 * Checks the CCV transaction status for each order and updates the order status if needed
 * @param {dw.order.Order} order order
 */
function checkOrderStatus(order) {
    try {
        var ccvTransactionReference = order.custom.ccvTransactionReference;

        if (!ccvTransactionReference) {
            ccvLogger.warn(`No ccv transaction reference found for order ${order.orderNo}`);
            return;
        }

        var transactionStatusResponse = checkCCVTransaction(ccvTransactionReference);
        var status = transactionStatusResponse.status;
        var paymentInstrument = order.paymentInstruments[0];

        Transaction.wrap(() => {
            paymentInstrument.custom.ccv_transaction_status = status;
            paymentInstrument.custom.ccv_failure_code = transactionStatusResponse.failureCode || null;

            // if the customer didn't return to returnUrl
            if (!paymentInstrument.paymentTransaction.transactionID) {
                var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor();

                paymentInstrument.paymentTransaction.setTransactionID(ccvTransactionReference);
                paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
            }
            if (!paymentInstrument.paymentTransaction.type.value) {
                paymentInstrument.paymentTransaction.type = transactionStatusResponse.type === CCV_CONSTANTS.TRANSACTION_TYPE.AUTHORISE // eslint-disable-line no-param-reassign
                    ? dw.order.PaymentTransaction.TYPE_AUTH
                    : dw.order.PaymentTransaction.TYPE_CAPTURE;
            }
        });

        if (status === CCV_CONSTANTS.STATUS.FAILED) {
            handleFailed(order);
            return;
        }

        if (status === CCV_CONSTANTS.STATUS.MANUAL_INTERVENTION) {
            handleManualIntervention(order, ccvTransactionReference);
            return;
        }

        // payment amount or currency mismatch
        if (status === CCV_CONSTANTS.STATUS.SUCCESS &&
            (transactionStatusResponse.amount !== order.totalGrossPrice.value || transactionStatusResponse.currency !== order.currencyCode.toLowerCase())) {
            handlePriceOrCurrencyMismatch(order, transactionStatusResponse);
            return;
        }

        if (status === CCV_CONSTANTS.STATUS.SUCCESS) {
            handleSuccess(order, paymentInstrument, transactionStatusResponse);
            return;
        }
    } catch (error) {
        ccvLogger.error(`Error updating status for order ${order.orderNo}: \n ${error.message}\n${error.stack}`);
        jobStatus = new Status(Status.ERROR);
    }
}

/**
 * Handler for orders with CCV payment status = failed
 * @param {dw.order.Order} order order being processed
 */
function handleFailed(order) {
    ccvLogger.info(`Failed transaction in order ${order.orderNo}. Failing order.`);

    Transaction.wrap(() => {
        OrderMgr.failOrder(order);
        order.addNote('Order failed by updateTransactionStatuses job', 'transaction status: failed');
    });
}

/**
 * Handler for orders with CCV payment status = manualintervention
 * @param {dw.order.Order} order order being processed
 * @param {string} ccvTransactionReference ccv transaction reference
 */
function handleManualIntervention(order, ccvTransactionReference) {
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
        refundCCVPayment({
            order: order,
            description: 'Price or currency mismatch - refund/reversal by updateTransactionStatuses job'
        });
        Transaction.wrap(() => {
            order.addNote('Refund initiated', 'Refund initiated by updateTransactionStatuses job');
        });
    }

    Transaction.wrap(() => {
        OrderMgr.failOrder(order);
        order.addNote('Order failed by updateTransactionStatuses job', msg);
    });
    ccvLogger.fatal(`${msg} Failing order ${order.orderNo}`);
}
/**
 * Handler for orders with CCV payment status = success
 * @param {dw.order.Order} order order being processed
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument order payment instrument
 * @param {Object} transactionStatusResponse response from ccv checkTransactionInfo call
 */
function handleSuccess(order, paymentInstrument) {
    Transaction.wrap(() => {
        var orderTotal = order.totalGrossPrice;

        if (paymentInstrument.paymentTransaction.amount.valueOrNull === 0 || paymentInstrument.paymentTransaction.amount.valueOrNull === null) {
            // customer didn't return to returnUrl
            paymentInstrument.paymentTransaction.setAmount(orderTotal);
        }

        ccvLogger.info(`Successful transaction. Placing order. ${order.orderNo}`);
        OrderMgr.placeOrder(order);

        order.addNote('Order placed by updateTransactionStatuses job', 'transaction status: success');
    });
}
