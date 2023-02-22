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

// TODO: Check if order is authenticated through service
var isCaptureAllowed = function (order) {
    if (!order) return false;

    var orderStatus = order.status.value;
    return orderStatus === Order.ORDER_STATUS_OPEN ||
        orderStatus === Order.ORDER_STATUS_NEW ||
        orderStatus === Order.ORDER_STATUS_COMPLETED;
};

exports.Start = function () {
    var orderNo = request.httpParameterMap.get('order_no').stringValue;
    var order = OrderMgr.getOrder(orderNo);

    if (!isCaptureAllowed(order)) {
        renderTemplate('order/payment/capture/order_payment_capture_not_available.isml');
    } else {
        renderTemplate('order/payment/capture/order_payment_capture.isml', {
            order: order
        });
    }
};

exports.Capture = function () {
    var orderNo = request.httpParameterMap.get('orderId').stringValue;
    var paymentMethodID = request.httpParameterMap.get('paymentMethodID').stringValue;
    var order = OrderMgr.getOrder(orderNo);

    var viewParams = {
        success: true,
        orderId: orderNo
    };

    try {
        // var paymentInstrument = order.getPaymentInstruments(paymentMethodID).toArray()[0];
        // var paymentMethod = paymentInstrument.getPaymentMethod();

        // var paymentToken = orderHelper.getTransactionPaymentToken(order, paymentMethod);
        // var confirmationType = orderHelper.getTransactionConfirmationType(order, paymentMethod);

        // paymentService.processPayment(order, paymentToken, confirmationType, true);
    } catch (e) {
        Logger.error('PAYMENT :: ERROR :: Error while processing payment for order ' + orderNo + '. ' + e.message);
        viewParams.success = false;
        viewParams.errorMessage = e.message;
    }

    renderTemplate('order/payment/capture/order_payment_capture_confirmation.isml', viewParams);
};

exports.Start.public = true;
exports.Capture.public = true;
