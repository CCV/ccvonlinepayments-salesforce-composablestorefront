'use strict';

var BasketMgr = require('dw/order/BasketMgr');

var languageMap = {
    nl: 'nld',
    en: 'eng',
    fr: 'fra',
    de: 'deu',
    dk: 'dan',
    es: 'spa'
};


exports.get = function (httpParams) {
    var currentBasket = BasketMgr.getCurrentBasket();
    var basketId = currentBasket.UUID;

    var selectedPaymentMethod = httpParams.c_type && httpParams.c_type.pop();
    var selectedOption = httpParams.c_ccv_option && httpParams.c_ccv_option.pop();
    var returnUrl = httpParams.c_returnUrl && httpParams.c_returnUrl.pop();
    var requestLanguage = request.locale.split('_')[0];

    var requestBody = {
        amount: currentBasket.totalGrossPrice.value,
        currency: currentBasket.currencyCode.toLowerCase(),
        method: selectedPaymentMethod,
        // "brand": "visa",
        returnUrl: returnUrl,
        merchantOrderReference: basketId, // we use basket id as reference since order is not placed yet
        description: 'PWA Order',
        language: languageMap[requestLanguage]
    };

    if ((selectedPaymentMethod === 'ideal' || selectedPaymentMethod === 'giropay') && selectedOption && selectedOption !== 'undefined') {
        requestBody.issuer = selectedOption;
    }

    var {
        createCCVPayment
    } = require('~/cartridge/scripts/services/CCVPaymentHelpers');

    var paymentResponse = createCCVPayment({
        requestBody: requestBody
    });

    if (!paymentResponse.reference) {
        throw new Error('No reference returned in CCV create payment call.');
    }
    var ocapiService = require('*/cartridge/scripts/services/ocapiService.js');

    // save the reference to the user's basket
    var saveTransactionToBasketResponse = ocapiService.createOcapiService().call({
        requestPath: `https://${request.httpHost}/s/${dw.system.Site.current.ID}/dw/shop/v23_1/baskets/${basketId}`,
        requestMethod: 'PATCH',
        requestBody: {
            c_ccvTransactionReference: paymentResponse.reference,
            c_basketReferenceId: basketId
        }
    });

    if (!saveTransactionToBasketResponse.ok) {
        throw new Error('Transaction reference could not be saved to basket.');
    }

    return paymentResponse;
};
