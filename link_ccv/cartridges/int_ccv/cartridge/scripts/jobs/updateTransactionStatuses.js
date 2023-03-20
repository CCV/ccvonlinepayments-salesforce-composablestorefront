var Status = require('dw/system/Status');
var Logger = require('dw/system/Logger');
var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var Transaction = require('dw/system/Transaction');
var { CCV_CONSTANTS, checkCCVTransaction, refundCCVPayment } = require('~/cartridge/scripts/services/CCVPaymentHelpers');
var PaymentMgr = require('dw/order/PaymentMgr');

exports.execute = function () {
    OrderMgr.processOrders(checkOrderStatus, `status=${Order.ORDER_STATUS_CREATED}`);

    return new Status(Status.OK);
};

/**
 * Checks the CCV transaction status for each order and updates the order status if needed
 * @param {dw.order.Order} order order
 */
function checkOrderStatus(order) {
    try {
        var ccvTransactionReference = order.custom.ccvTransactionReference;

        if (!ccvTransactionReference) {
            Logger.error(`No ccv transaction reference found for order ${order.orderNo}`);
            return;
        }

        var transactionStatusResponse = checkCCVTransaction(ccvTransactionReference);
        var status = transactionStatusResponse.status;

        if (status === CCV_CONSTANTS.STATUS.FAILED) {
            // if transaction.status = failed => fail order
            Logger.info(`Failed transaction in order ${order.orderNo}. Failing order.`);

            Transaction.wrap(() => {
                OrderMgr.failOrder(order);
                order.addNote('Order failed by updateTransactionStatuses job', 'transaction status: failed');
            });
            return;
        }

        // payment amount or currency mismatch
        if (status === CCV_CONSTANTS.STATUS.SUCCESS &&
            (transactionStatusResponse.amount !== order.totalGrossPrice.value || transactionStatusResponse.currency !== order.currencyCode.toLowerCase())) {
            var msg = `Payment amount or currency mismatch: (${transactionStatusResponse.amount} | ${order.totalGrossPrice}) (${transactionStatusResponse.currency}|${order.currencyCode.toLowerCase()}).`;
            Logger.warn(`${msg} Failing order ${order.orderNo}`);

            refundCCVPayment({
                order: order,
                description: 'Price or currency mismatch - refund by updateTransactionStatuses job'
            });

            Transaction.wrap(() => {
                OrderMgr.failOrder(order);
                order.addNote('Order failed by updateTransactionStatuses job', msg);
            });
            return;
        }

        // if transaction.status = success => place order and update paymentTransaction object
        if (status === CCV_CONSTANTS.STATUS.SUCCESS) {
            Logger.info(`Successful transaction. Placing order. ${order.orderNo}`);

            Transaction.wrap(() => {
                OrderMgr.placeOrder(order);

                var paymentInstrument = order.paymentInstruments[0];
                var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor();
                var orderTotal = order.totalGrossPrice;

                paymentInstrument.paymentTransaction.transactionID = ccvTransactionReference;
                paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
                paymentInstrument.paymentTransaction.setAmount(orderTotal);

                paymentInstrument.paymentTransaction.type = transactionStatusResponse.type === CCV_CONSTANTS.TRANSACTION_TYPE.AUTHORISE
                    ? dw.order.PaymentTransaction.TYPE_AUTH
                    : dw.order.PaymentTransaction.TYPE_CAPTURE;

                order.addNote('Order placed by updateTransactionStatuses job', 'transaction status: success');
            });
            return;
        }
    } catch (error) {
        Logger.error(`Error updating status for order ${order.orderNo}: \n ${error.message}\n${error.stack}`);
    }
}

