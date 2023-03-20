var ISML = require('dw/template/ISML');
var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var Logger = require('dw/system/Logger');

var renderTemplate = function (templateName, viewParams) {
    try {
        ISML.renderTemplate(templateName, viewParams);
    } catch (e) {
        Logger.error('Error while rendering template ' + templateName);
        throw e;
    }
};

var isRefundAllowed = function (order) {
    if (!order) return false;
    var orderStatus = order.status.value;

    if (!order.custom.ccvTransactionReference) return false;

    return orderStatus !== Order.ORDER_STATUS_CANCELLED &&
        orderStatus !== Order.ORDER_STATUS_FAILED &&
        orderStatus !== Order.ORDER_STATUS_CREATED;
};

exports.Start = function () {
    var { getRefundAmountRemaining } = require('*/cartridge/scripts/services/CCVPaymentHelpers');
    var orderNo = request.httpParameterMap.get('order_no').stringValue;
    var order = OrderMgr.getOrder(orderNo);
    var refunds = JSON.parse(order.custom.ccvRefunds || '[]');

    var transactionType = order.paymentTransaction.type.value === dw.order.PaymentTransaction.TYPE_AUTH ? 'auth' : 'capture';

    var refundAmountRemaining = getRefundAmountRemaining(order);

    if (!isRefundAllowed(order)) {
        renderTemplate('order/payment/refund/order_payment_refund_not_available.isml');
    } else {
        renderTemplate('order/payment/refund/order_payment_refund.isml', {
            order,
            refunds,
            refundAmountRemaining,
            transactionType
        });
    }
};

exports.Refund = function () {
    var { getRefundAmountRemaining, refundCCVPayment } = require('*/cartridge/scripts/services/CCVPaymentHelpers');
    var orderNo = request.httpParameterMap.get('orderNo').stringValue;
    var refundAmount = request.httpParameterMap.get('refundAmount').stringValue;
    var isReversal = request.httpParameterMap.get('reversal').stringValue;
    var order = OrderMgr.getOrder(orderNo);

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
            amount: refundAmount,
            description: `CSC ${isReversal ? 'reversal' : 'refund'}`
        });

        viewParams.order = order;
        viewParams.refunds = ccvRefunds;
        viewParams.refundAmountRemaining = getRefundAmountRemaining(order);
    } catch (e) {
        Logger.error('CSC: Error while refunding payment for order ' + orderNo + '. ' + e.message);
        viewParams.success = false;
        viewParams.errorMessage = e.message;
    }

    renderTemplate('order/payment/refund/order_payment_refund_confirmation.isml', viewParams);
};

exports.Start.public = true;
exports.Refund.public = true;
