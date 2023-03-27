'use strict';
var OrderMgr = require('dw/order/OrderMgr');
exports.get = function () {
    var orderRef = request.httpParameters.ref && request.httpParameters.ref[0];
    var orderToken = request.httpParameters.token && request.httpParameters.token[0];

    if (!orderRef || !orderToken) {
        throw new Error(`CCV: Order reference or token missing from request: OrderNo: ${orderRef} token: ${orderToken}`);
    }

    var order = OrderMgr.getOrder(orderRef, orderToken);

    if (!order) {
        throw new Error('CCV: Order not found.');
    }

    if (order.customer.ID !== customer.ID) {
        throw new Error('CCV: Order reference belongs to a different customer.');
    }

    var ocapiService = require('*/cartridge/scripts/services/ocapiService.js');

    var orderPaymentInstrument = order.paymentInstruments[0];

    var paymentInstrumentPatchBody = {
        payment_method_id: orderPaymentInstrument.paymentMethod,
        payment_card: orderPaymentInstrument.creditCardType ?
    { card_type: orderPaymentInstrument.creditCardType } : undefined
    };

    var patchOrderPaymentInstrumentResponse = ocapiService.createOcapiService().call({
        requestPath: `https://${request.httpHost}/s/${dw.system.Site.current.ID}/dw/shop/v23_1/orders/${order.orderNo}/payment_instruments/${orderPaymentInstrument.UUID}`,
        requestMethod: 'PATCH',
        requestBody: paymentInstrumentPatchBody
    });

    if (!patchOrderPaymentInstrumentResponse.ok) {
        throw new Error(`CCV: could not authorize payment: ${patchOrderPaymentInstrumentResponse.errorMessage}`);
    }

    var result = {
        status: orderPaymentInstrument.custom.ccv_transaction_status,
        errorMsg: orderPaymentInstrument.custom.ccv_failure_code
    };

    return result;
};
