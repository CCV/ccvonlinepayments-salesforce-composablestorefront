'use strict';
var Order = require('dw/order/Order');
var OrderMgr = require('dw/order/OrderMgr');
var RESTResponseMgr = require('dw/system/RESTResponseMgr');
var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv');

// eslint-disable-next-line consistent-return
exports.cancelPayment = function () {
    var requestBody = request.httpParameterMap.requestBodyAsString;
    var { orderNo, orderToken } = JSON.parse(requestBody);
    ccvLogger.info(`ccv/cancel-payment custom api called for order ${orderNo}`);

    // get order
    var { cancelCCVPayment } = require('*/cartridge/scripts/services/CCVPaymentHelpers');

    var order = OrderMgr.getOrder(orderNo, orderToken);

    if (!order || order.status.value !== Order.ORDER_STATUS_CREATED) {
        return RESTResponseMgr.createError(400, 'order_not_in_created_status').render();
    }

    if (order.customer.ID !== customer.ID) {
        return RESTResponseMgr.createError(401, 'unauthorized').render();
    }

    try {
        var cancelResult = cancelCCVPayment({ order });
        if (cancelResult.ok) {
            order.addNote('Cancel CCV payment: SUCCESS', 'via ccv/cancel-order');
        } else {
            order.addNote('Cancel CCV payment: FAIL', 'via ccv/cancel-order');
        }
    } catch (error) {
        ccvLogger.error(`Error canceling order via ccv/cancel-order:\n${error}`);
        order.addNote('Cancel CCV payment: ERROR', 'via ccv/cancel-order');
        return RESTResponseMgr.createError(401, 'cancelation_failed').render();
    }
};

exports.cancelPayment.public = true;
