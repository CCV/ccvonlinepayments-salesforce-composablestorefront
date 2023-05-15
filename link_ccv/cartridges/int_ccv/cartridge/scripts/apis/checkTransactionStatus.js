'use strict';
var OrderMgr = require('dw/order/OrderMgr');

exports.get = function () {
    var orderRef = request.httpParameters.ref && request.httpParameters.ref[0];
    var orderToken = request.httpParameters.token && request.httpParameters.token[0];

    if (!orderRef || !orderToken) {
        throw new Error(`CCV: OrderNo or token missing from request: OrderNo: ${orderRef} token: ${orderToken}`);
    }

    var order = OrderMgr.getOrder(orderRef, orderToken);

    if (!order) {
        throw new Error('CCV: Order not found.');
    }

    if (order.customer.ID !== customer.ID) {
        throw new Error('CCV: Order reference belongs to a different customer.');
    }

    var orderPaymentInstrument = order.paymentInstruments[0];
    var ccvStatus = orderPaymentInstrument.paymentTransaction && orderPaymentInstrument.paymentTransaction.custom.ccv_transaction_status;
    var ccvFailureCode = orderPaymentInstrument.paymentTransaction && orderPaymentInstrument.paymentTransaction.custom.ccv_failure_code;
    var result = {
        status: ccvStatus,
        errorMsg: ccvFailureCode,
        customPaymentError: order.custom.ccvPriceOrCurrencyMismatch && 'price_or_currency_mismatch'
    };

    return result;
};
