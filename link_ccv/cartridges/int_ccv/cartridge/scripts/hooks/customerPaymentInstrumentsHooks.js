'use strict';
/**
 *  Custom Object Modify Get Hook
 * @param {Object} customer - the database object
 * @param {Object} paymentInstrument - the document
 */
exports.afterPOST = function (customer, paymentInstrument) {
    if (paymentInstrument.paymentMethodId === 'CCV_CREDIT_CARD'
    && paymentInstrument.paymentCard) {
        var Transaction = require('dw/system/Transaction');
        var customerPaymentInstruments = customer.profile.wallet.getPaymentInstruments();
        var savedPaymentInstrument = customerPaymentInstruments[customerPaymentInstruments.length - 1];
        Transaction.wrap(() => {
            savedPaymentInstrument.setCreditCardToken(paymentInstrument.c_ccv_card_token);
        });
    }
};
