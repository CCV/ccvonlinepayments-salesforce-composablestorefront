'use strict';

var server = require('server');
var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var Transaction = require('dw/system/Transaction');
var ccvLogger = require('dw/system/Logger').getLogger('CCV', 'ccv');
var Site = require('dw/system/Site');

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
        ccvLogger.warn(`CCV: Trying to update an order (${order.orderNo}) that is not in "Created" status via CCV-WebhookStatus.`);
        res.json({});
        return next();
    }

    if (reqBody.id !== order.custom.ccvTransactionReference) {
        throw new Error(`CCV: Webhook called with different transaction reference ( ${reqBody.id} ) than the one found in the order ( ${order.custom.ccvTransactionReference} ).`);
    }

    var { authorizeCCV, handleAuthorizationResult } = require('*/cartridge/scripts/authorizeCCV');

    try {
        Transaction.wrap(function () {
            var authResult = authorizeCCV(order, 'webhook');
            handleAuthorizationResult(authResult, order);
        });
    } catch (error) {
        ccvLogger.error(`Error authorizing payment: ${error}`);
    }

    res.json({ success: true });

    next();
});

server.post('SubmitApplePayToken', function (req, res, next) { // eslint-disable-line consistent-return
    var reqBody = JSON.parse(request.httpParameterMap.requestBodyAsString);

    var orderNo = reqBody.orderNo;
    var orderToken = reqBody.orderToken;

    if (!orderNo || !orderToken) {
        throw new Error(`CCV: OrderNo or token missing from request: OrderNo: ${orderNo} token: ${orderToken}`);
    }

    // we use this service call as an authorization check - it reuses the slas auth token from the pwa request
    // if the user tries to access another user's order this call will return 404
    var ocapiService = require('*/cartridge/scripts/services/ocapiService.js');
    var getOrderResponse = ocapiService.createOcapiService().call({
        requestPath: `https://${request.httpHost}/s/${Site.current.ID}/dw/shop/v23_1/orders/${orderNo}`,
        requestMethod: 'GET'
    });

    if (!getOrderResponse.ok) {
        ccvLogger.error(`Order (${orderNo}) not accessoble in request.`);
        res.setStatusCode(401);
        res.json({});
        return next();
    }

    var order = OrderMgr.getOrder(orderNo, orderToken);

    if (!order) {
        throw new Error('CCV: Order not found.');
    }

    if (order.status.value !== Order.ORDER_STATUS_CREATED) {
        throw new Error('CCV: Trying to update an order that is not in "Created" status.');
    }

    if (order.paymentInstrument.paymentMethod !== 'CCV_APPLE_PAY') {
        throw new Error('CCV: SubmitApplePayToken called with on non-apple pay order.');
    }

    var paymentProcessorId = order.paymentTransaction.paymentProcessor.ID;


    // ============ CANCEL PAYMENT ================
    // if the user clicked Cancel on the apple payment sheet we fail the order and cancel the CCV payment
    if (reqBody.isCancelled) {
        Transaction.wrap(() => {
            OrderMgr.failOrder(order, true);
            order.addNote('Order cancelled', 'Apple pay payment cancelled by customner via CCV-SubmitApplePayToken');
        });
        var { cancelCCVPaymentViaCardUrl } = require('*/cartridge/scripts/services/CCVPaymentHelpers');
        try {
            cancelCCVPaymentViaCardUrl({
                absPath: order.custom.ccvCancelUrl,
                paymentProcessorId
            });
        } catch (error) {
            ccvLogger.error(`CCV: cancel apple pay payment request failed, ${error}`);
        }
        res.json({});
        return next();
    }

    // ============= SUBMIT APPLE PAY TOKEN ================
    var { postApplePayToken, checkCCVTransaction } = require('*/cartridge/scripts/services/CCVPaymentHelpers');
    postApplePayToken({
        absPath: order.custom.ccvCardDataUrl,
        requestBody: { encryptedToken: reqBody.encryptedToken },
        paymentProcessorId: paymentProcessorId
    });

    var transactionStatus = checkCCVTransaction(order.custom.ccvTransactionReference, paymentProcessorId);

    res.json({
        status: transactionStatus.status
    });
    next();
});

module.exports = server.exports();
