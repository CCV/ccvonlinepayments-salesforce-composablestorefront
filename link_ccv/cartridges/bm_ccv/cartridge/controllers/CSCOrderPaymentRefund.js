var ISML = require('dw/template/ISML');
var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var Logger = require('dw/system/Logger');
var PaymentTransaction = require('dw/order/PaymentTransaction');

var isRefundAllowed = function (order) {
    if (!order) return false;
    var orderStatus = order.status.value;

    if (!order.custom.ccvTransactionReference) return false;

    return orderStatus !== Order.ORDER_STATUS_CANCELLED &&
        orderStatus !== Order.ORDER_STATUS_FAILED &&
        orderStatus !== Order.ORDER_STATUS_CREATED;
};

var isCancelAllowed = function (order) {
    if (!order) return false;

    if (!order.custom.ccvTransactionReference) return false;

    return order.status.value === Order.ORDER_STATUS_CREATED;
};

exports.Start = function () {
    var orderNo = request.httpParameterMap.get('order_no').stringValue;
    var order = OrderMgr.getOrder(orderNo);

    if (isCancelAllowed(order)) {
        ISML.renderTemplate('order/payment/refund/order_payment_cancel', { order });
    } else if (isRefundAllowed(order)) {
        var { getRefundAmountRemaining } = require('*/cartridge/scripts/helpers/CCVOrderHelpers');

        var refunds = JSON.parse(order.custom.ccvRefunds || '[]');

        var transactionType = order.paymentTransaction.type.value === PaymentTransaction.TYPE_AUTH ? 'auth' : 'capture';

        var refundAmountRemaining = getRefundAmountRemaining(order);
        ISML.renderTemplate('order/payment/refund/order_payment_refund.isml', {
            order,
            refunds,
            refundAmountRemaining,
            transactionType
        });
    } else {
        ISML.renderTemplate('order/payment/refund/order_payment_refund_not_available.isml');
    }
};

exports.Refund = function () {
    var Money = require('dw/value/Money');

    var { getRefundAmountRemaining } = require('*/cartridge/scripts/helpers/CCVOrderHelpers');
    var { refundCCVPayment } = require('*/cartridge/scripts/services/CCVPaymentHelpers');
    var orderNo = request.httpParameterMap.get('orderNo').stringValue;
    var isReversal = request.httpParameterMap.get('reversal').stringValue;
    var order = OrderMgr.getOrder(orderNo);
    var refundAmount;

    if (request.httpParameterMap.get('refundAmount').doubleValue) {
        refundAmount = new Money(request.httpParameterMap.get('refundAmount').doubleValue, order.currencyCode);
    }

    var transactionType = order.paymentTransaction.type.value === PaymentTransaction.TYPE_AUTH ? 'auth' : 'capture';

    var viewParams = {
        success: true,
        orderId: orderNo
    };

    try {
        var refundAmountRemaining = getRefundAmountRemaining(order);

        if (refundAmountRemaining - refundAmount < 0) {
            throw new Error('Refund amount exceeds order total amount!');
        }

        var ccvRefunds = refundCCVPayment({
            order: order,
            amount: isReversal ? null : refundAmount.value,
            description: `CSC ${isReversal ? 'reversal' : 'refund'}`
        });

        if (!ccvRefunds) throw new Error('Error creating the refund request.');

        viewParams.order = order;
        viewParams.refunds = ccvRefunds;
        viewParams.refundAmountRemaining = getRefundAmountRemaining(order);
        viewParams.transactionType = transactionType;
    } catch (e) {
        Logger.error('CSC: Error while refunding payment for order ' + orderNo + '. ' + e.message);
        viewParams.success = false;
        viewParams.errorMessage = e.message;
    }

    ISML.renderTemplate('order/payment/refund/order_payment_refund_confirmation.isml', viewParams);
};

exports.Cancel = function () {
    var Transaction = require('dw/system/Transaction');
    var { cancelCCVPayment } = require('*/cartridge/scripts/services/CCVPaymentHelpers');
    var orderNo = request.httpParameterMap.get('orderNo').stringValue;

    var order = OrderMgr.getOrder(orderNo);
    var viewParams = {
        success: true,
        orderId: orderNo
    };

    try {
        var cancelResult = cancelCCVPayment({ order });
        Transaction.wrap(() => {
            order.addNote('Cancel CCV payment: success', 'initiated from CSC');
        });

        viewParams.order = order;
        viewParams.cancelResult = cancelResult;
    } catch (e) {
        Logger.error('CSC: Error while refunding payment for order ' + orderNo + '. ' + e.message);
        viewParams.success = false;
        viewParams.errorMessage = e.message;
        Transaction.wrap(() => {
            order.addNote('Cancel CCV payment: failed', `initiated from CSC\n${e.message}`);
        });
    }

    ISML.renderTemplate('order/payment/refund/order_payment_cancel_result.isml', viewParams);
};

exports.Start.public = true;
exports.Refund.public = true;
exports.Cancel.public = true;
