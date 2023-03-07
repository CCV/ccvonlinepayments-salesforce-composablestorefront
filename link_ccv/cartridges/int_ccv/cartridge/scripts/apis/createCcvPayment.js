'use strict';
/* eslint-disable camelcase */ // custom properties can't be camelcase due to PWA implementation of ocapi calls
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
    var { createCCVPayment } = require('~/cartridge/scripts/services/CCVPaymentHelpers');
    var currentBasket = BasketMgr.getCurrentBasket();
    var basketId = currentBasket.UUID;

    var selectedPaymentMethod = httpParams.c_type && httpParams.c_type.pop();
    var returnUrl = httpParams.c_returnUrl && httpParams.c_returnUrl.pop();
    var requestLanguage = request.locale.split('_')[0];
    var orderDescription = currentBasket.allProductLineItems.toArray().map(pli => pli.quantity + ' ' + pli.productName).join(', ');
    // for vault: enabled allow storing in vault - otherwise we get a config error
    var { ccv_option, ccv_save_for_later } = currentBasket.paymentInstruments[0].custom;

    var paymentInstrument = currentBasket.paymentInstruments[0];

    var requestBody = {
        amount: currentBasket.totalGrossPrice.value,
        currency: currentBasket.currencyCode.toLowerCase(),
        method: selectedPaymentMethod,
        returnUrl: returnUrl,
        merchantOrderReference: basketId, // we use basket id as reference since order is not placed yet
        description: orderDescription,
        storeInVault: ccv_save_for_later ? 'yes' : 'no',
        language: languageMap[requestLanguage]
    };

    if ((selectedPaymentMethod === 'ideal' || selectedPaymentMethod === 'giropay') && ccv_option) {
        requestBody.issuer = ccv_option;
    }


    if (selectedPaymentMethod === 'card' && paymentInstrument.creditCardNumber) {
        var [firstName, lastName] = paymentInstrument.creditCardHolder.split(' ');
        requestBody.details = {
            pan: paymentInstrument.creditCardNumber,
            expiryDate: `${paymentInstrument.creditCardExpirationMonth}${paymentInstrument.creditCardExpirationYear}`,
            cardholderFirstName: firstName,
            cardholderLastName: lastName || firstName
            // cvc: "123"
        };

        if (paymentInstrument.creditCardType) {
            requestBody.brand = paymentInstrument.creditCardType;
        }
    }

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
