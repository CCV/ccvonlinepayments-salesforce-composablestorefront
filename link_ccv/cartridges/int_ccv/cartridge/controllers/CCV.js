'use strict';

var server = require('server');
var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var Transaction = require('dw/system/Transaction');
var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv');

server.post('WebhookStatus', function (req, res, next) { // eslint-disable-line consistent-return
    var orderRef = request.httpParameters.ref && request.httpParameters.ref[0];
    var orderToken = request.httpParameters.token && request.httpParameters.token[0];
    var reqBody = JSON.parse(request.httpParameterMap.requestBodyAsString);

    if (!orderRef || !orderToken) {
        throw new Error(`CCV: OrderNo or token missing from request: OrderNo: ${orderRef} token: ${orderToken}`);
    }

    var order = OrderMgr.getOrder(orderRef, orderToken);

    if (!order) {
        throw new Error('CCV: Order not found.');
    }

    if (order.status.value !== Order.ORDER_STATUS_CREATED) {
        throw new Error('CCV: Trying to update an order that is not in "Created" status.');
    }

    if (reqBody.id !== order.custom.ccvTransactionReference) {
        throw new Error(`CCV: Webhook called with different transaction reference ( ${reqBody.id} ) than the one found in the order ( ${order.custom.ccvTransactionReference} ).`);
    }

    var { authorizeCCV, handleAuthorizationResult } = require('*/cartridge/scripts/authorizeCCV');

    try {
        Transaction.wrap(function () {
            var authResult = authorizeCCV(order, null, 'webhook');
            handleAuthorizationResult(authResult, order);
        });
    } catch (error) {
        ccvLogger.error(`Error authorizing payment: ${error}`);
    }

    res.json({ success: true });

    next();
});

module.exports = server.exports();
