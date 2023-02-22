var ISML = require('dw/template/ISML');
var OrderMgr = require('dw/order/OrderMgr');
var Transaction = require('dw/system/Transaction');
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

var isCancelAllowed = function (order) {
    if (!order) return false;

    var orderStatus = order.status.value;
    return orderStatus === Order.ORDER_STATUS_OPEN ||
        orderStatus === Order.ORDER_STATUS_NEW ||
        orderStatus === Order.ORDER_STATUS_COMPLETED;
};

exports.Start = function () {
    var orderNo = request.httpParameterMap.get('order_no').stringValue;
    var order = OrderMgr.getOrder(orderNo);

    if (!isCancelAllowed(order)) {
        renderTemplate('order/payment/cancel/order_payment_cancel_not_available.isml');
    } else {
        renderTemplate('order/payment/cancel/order_payment_cancel.isml', {
            order: order
        });
    }
};

exports.Cancel = function () {
    var orderNo = request.httpParameterMap.get('orderId').stringValue;
    var order = OrderMgr.getOrder(orderNo);

    var viewParams = {
        success: true,
        orderId: orderNo
    };

    try {
        Transaction.wrap(function () {
            //     add order note (order, 'CCV CancelTransactionResult: ' + cancelTransactionResult.raw);
            //     cancel order
            // } else {
                    // cancel order
            // }
        });
    } catch (e) {
        Logger.error('PAYMENT :: ERROR :: Error while processing payment for order ' + orderNo + '. ' + e.message);
        viewParams.success = false;
        viewParams.errorMessage = e.message;
    }

    renderTemplate('order/payment/cancel/order_payment_cancel_confirmation.isml', viewParams);
};

exports.Start.public = true;
exports.Cancel.public = true;
