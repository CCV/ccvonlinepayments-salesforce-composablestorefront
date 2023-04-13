'use strict';
var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var Site = require('dw/system/Site');

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

    if (order.status.value !== Order.ORDER_STATUS_CREATED) {
        throw new Error('CCV: Trying to update an order that is not in "Created" status.');
    }

    var ocapiService = require('*/cartridge/scripts/services/ocapiService.js');

    var orderPaymentInstrument = order.paymentInstruments[0];

    var paymentInstrumentPatchBody = {
        payment_method_id: orderPaymentInstrument.paymentMethod,
        payment_card: orderPaymentInstrument.creditCardNumber ?
        { card_type: orderPaymentInstrument.creditCardType,
            number: orderPaymentInstrument.creditCardNumber,
            expiration_month: orderPaymentInstrument.creditCardExpirationMonth,
            expiration_year: orderPaymentInstrument.creditCardExpirationYear
        } : undefined
    };

    var patchOrderPaymentInstrumentResponse = ocapiService.createOcapiService().call({
        requestPath: `https://${request.httpHost}/s/${Site.current.ID}/dw/shop/v23_1/orders/${order.orderNo}/payment_instruments/${orderPaymentInstrument.UUID}`,
        requestMethod: 'PATCH',
        requestBody: paymentInstrumentPatchBody
    });

    if (!patchOrderPaymentInstrumentResponse.ok) {
        throw new Error(`CCV: error authorizing payment: ${patchOrderPaymentInstrumentResponse.errorMessage}`);
    }
    var ccvStatus = orderPaymentInstrument.paymentTransaction && orderPaymentInstrument.paymentTransaction.custom.ccv_transaction_status;
    var ccvFailureCode = orderPaymentInstrument.paymentTransaction && orderPaymentInstrument.paymentTransaction.custom.ccv_failure_code;
    var result = {
        status: ccvStatus,
        errorMsg: ccvFailureCode,
        customPaymentError: order.custom.ccvPriceOrCurrencyMismatch && 'price_or_currency_mismatch'
    };

    return result;
};
