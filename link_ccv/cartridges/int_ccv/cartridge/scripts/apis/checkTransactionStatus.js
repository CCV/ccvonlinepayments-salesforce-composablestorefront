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

    // if 'storeInVault' was passed in the createCCVPayment call, this response will include a
    // vaultAccessToken, which we will save as a token to the customer's payment instrument later (when placing the order)
    if (transactionStatus.status === 'success'
        && transactionStatus.details
        && transactionStatus.details.vaultAccessToken) {
        var ocapiService = require('*/cartridge/scripts/services/ocapiService.js');
        try {
            // save card token to basket so we can save it to customer's payment instrument when placing the order
            ocapiService.createOcapiService().call({
                requestPath: `https://${request.httpHost}/s/${dw.system.Site.current.ID}/dw/shop/v23_1/baskets/${currentBasket.getUUID()}`,
                requestMethod: 'PATCH',
                requestBody: {
                    c_ccvVaultAccessToken: transactionStatus.details.vaultAccessToken
                }
            });
        } catch (error) {
            var Logger = require('dw/system/Logger');
            Logger.error('Failed saving CCV vaultAccessToken to customer\'s basket');
        }
    }
    var result = {
        status: transactionStatus.status,
        errorMsg: transactionStatus.failureCode
    };

    return result;
};
