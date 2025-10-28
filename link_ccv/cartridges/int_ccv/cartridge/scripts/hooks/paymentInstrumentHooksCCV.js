'use strict';

/**
 * Hook that is executed before a payment instrument is deleted from the basket.
 * @param {dw.order.Basket} basket basket
 * @param {dw.order.PaymentInstrument} paymentInstrument payment instrument
 */
exports.beforeDELETE = function (basket, paymentInstrument) {
    if (paymentInstrument.paymentMethod === 'CCV_IDEAL' && paymentInstrument.custom.ccv_fast_checkout) {
        basket.createBillingAddress();
        basket.defaultShipment.createShippingAddress();
    }
};
