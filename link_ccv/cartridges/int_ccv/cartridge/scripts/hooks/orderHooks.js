'use strict';
/**
 *  Custom Object Modify Get Hook
 * @param {Object} basket - the database object
 * @param {Object} paymentInstrument - the document
 */
exports.beforePOST = function (basket) {
    if (basket.custom.ccvVaultAccessToken) {
        var customerPaymentInstruments = basket.customer.profile.wallet.paymentInstruments;
        var orderPaymentInstrument = basket.paymentInstruments[0];

        for (var i = 0; i < customerPaymentInstruments.length; i++) {
            var customerPaymentInstrument = customerPaymentInstruments[i];

            if (orderPaymentInstrument.creditCardNumberLastDigits
                && orderPaymentInstrument.creditCardNumberLastDigits === customerPaymentInstrument.creditCardNumberLastDigits
                && !customerPaymentInstrument.creditCardToken) {
                var Transaction = require('dw/system/Transaction');

                Transaction.wrap(() => { // eslint-disable-line no-loop-func
                    customerPaymentInstrument.setCreditCardToken(basket.custom.ccvVaultAccessToken);
                });

                break;
            }
        }
    }
};
