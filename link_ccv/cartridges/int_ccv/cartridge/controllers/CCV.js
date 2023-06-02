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
        ccvLogger.error(`CCV: OrderNo or token missing from request: OrderNo: ${orderRef}`);
        throw new Error(`CCV: OrderNo or token missing from request: OrderNo: ${orderRef}`);
    }
    ccvLogger.info(`CCV: Payment webhook called for order ${orderRef}.`);

    var order = OrderMgr.getOrder(orderRef, orderToken);

    if (!order) {
        throw new Error(`CCV: Order not found. Order ref: ${orderRef}`);
    }

    if (order.status.value !== Order.ORDER_STATUS_CREATED) {
        if (order.status.value === Order.ORDER_STATUS_FAILED) {
            // in case of apple pay cancellation, we fail the order directly in CCV-SubmitApplePayToken
            // because we want to reopen the basket asap
            ccvLogger.info(`CCV: order (${order.orderNo}) is already in status Failed. Skipping webhook update.`);
        } else {
            ccvLogger.warn(`CCV: Trying to update an order (${order.orderNo}) that is not in "Created" status via CCV-WebhookStatus.`);
        }
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
        ccvLogger.error(`CCV-WebhookStatus: Error authorizing payment: ${error}`);
        res.setStatusCode(500);
    }

    res.json({});
    next();
});

server.post('WebhookRefund', function (req, res, next) { // eslint-disable-line consistent-return
    var orderNo = request.httpParameters.orderNo && request.httpParameters.orderNo[0];
    var orderToken = request.httpParameters.orderToken && request.httpParameters.orderToken[0];
    var reqBody = JSON.parse(request.httpParameterMap.requestBodyAsString);
    var refundTransactionId = reqBody.id;

    if (!orderNo || !orderToken || !refundTransactionId) {
        ccvLogger.error(`CCV: OrderNo, token or transactionId missing from WebhookRefund request: OrderNo: ${orderNo} transactionId: ${refundTransactionId}`);
        throw new Error(`CCV: OrderNo, token or transactionId missing from WebhookRefund request: OrderNo: ${orderNo} transactionId: ${refundTransactionId}`);
    }
    ccvLogger.info(`CCV: Refund Webhook called for order ${orderNo}.`);

    var order = OrderMgr.getOrder(orderNo, orderToken);

    if (!order) {
        throw new Error(`CCV: Order not found. Order ref: ${orderNo}`);
    }

    if (!order.custom.ccvRefunds ||
        !JSON.parse(order.custom.ccvRefunds).some(refund => {
            return refund.reference === refundTransactionId;
        })) {
        throw new Error(`CCV: refund with given reference ID not found among order's refund: orderNo: ${order.orderNo} refundId: ${refundTransactionId}`);
    }

    var { checkRefundStatus } = require('*/cartridge/scripts/helpers/CCVOrderHelpers');
    checkRefundStatus(order);

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

    // ============ CANCEL PAYMENT ================
    // if the user clicked Cancel on the apple payment sheet we fail the order and cancel the CCV payment
    if (reqBody.isCancelled) {
        Transaction.wrap(() => {
            OrderMgr.failOrder(order, true);
            order.addNote('Order cancelled', 'Apple pay payment cancelled by customer via CCV-SubmitApplePayToken');
        });
        var { cancelCCVPaymentViaCardUrl } = require('*/cartridge/scripts/services/CCVPaymentHelpers');
        try {
            cancelCCVPaymentViaCardUrl({
                absPath: order.custom.ccvCancelUrl
            });
        } catch (error) {
            ccvLogger.error(`CCV: cancel apple pay payment request failed, ${error}`);
        }
        res.json({});
        return next();
    }

    // ============= SUBMIT APPLE PAY TOKEN ================
    var { postApplePayToken } = require('*/cartridge/scripts/services/CCVPaymentHelpers');

    try {
        postApplePayToken({
            absPath: order.custom.ccvCardDataUrl,
            requestBody: { encryptedToken: reqBody.encryptedToken }
        });
    } catch (error) {
        ccvLogger.error(`Failed submitting apple pay token for order ${order.orderNo}: ${error}`);

        Transaction.wrap(() => {
            OrderMgr.failOrder(order, true);
            order.addNote('Order failed', 'postApplePayToken call to CCV failed');
        });

        throw new Error(`Submitting apple token to ccv failed: ${error}`);
    }

    res.json({ status: 'success' });
    next();
});

module.exports = server.exports();
