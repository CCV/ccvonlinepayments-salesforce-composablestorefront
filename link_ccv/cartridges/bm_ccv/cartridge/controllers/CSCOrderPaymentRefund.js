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
    return orderStatus !== Order.ORDER_STATUS_CANCELLED &&
        orderStatus !== Order.ORDER_STATUS_FAILED &&
        orderStatus !== Order.ORDER_STATUS_CREATED;
};

exports.Start = function () {
    var orderNo = request.httpParameterMap.get('order_no').stringValue;
    var order = OrderMgr.getOrder(orderNo);

    if (!isRefundAllowed(order)) {
        renderTemplate('order/payment/refund/order_payment_refund_not_available.isml');
    } else {
        renderTemplate('order/payment/refund/order_payment_refund.isml', {
            order: order
        });
    }
};

exports.Refund = function () {
    var orderNo = request.httpParameterMap.get('orderId').stringValue;
    var refundAmount = request.httpParameterMap.get('refundAmount').stringValue;
    var currencyCode = request.httpParameterMap.get('currencyCode').stringValue;
    var paymentMethodID = request.httpParameterMap.get('paymentMethodID').stringValue;
    var order = OrderMgr.getOrder(orderNo);

    var viewParams = {
        success: true,
        orderId: orderNo,
        refundAmount: refundAmount,
        currencyCode: currencyCode
    };

    try {
        var paymentInstrument = order.getPaymentInstruments(paymentMethodID).toArray()[0];
        // paymentService.refundPayment(order, paymentInstrument, Number(refundAmount));
    } catch (e) {
        Logger.error('PAYMENT :: ERROR :: Error while refunding payment for order ' + orderNo + '. ' + e.message);
        viewParams.success = false;
        viewParams.errorMessage = e.message;
    }

    renderTemplate('order/payment/refund/order_payment_refund_confirmation.isml', viewParams);
};

exports.Start.public = true;
exports.Refund.public = true;
