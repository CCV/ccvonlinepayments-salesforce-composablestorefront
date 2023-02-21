'use strict';

exports.get = function () {
    var BasketMgr = require('dw/order/BasketMgr');
    var { checkCCVTransaction } = require('~/cartridge/scripts/services/CCVPaymentHelpers');

    var currentBasket = BasketMgr.getCurrentBasket();
    var reference = currentBasket.custom.ccvTransactionReference;

    if (!reference) {
        throw new Error('No transaction reference found.');
    }

    var transactionStatus = checkCCVTransaction(reference);

    return { transactionStatus };
};
