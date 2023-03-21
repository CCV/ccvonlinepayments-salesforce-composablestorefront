'use strict';
/* eslint-disable camelcase */ // custom properties can't be camelcase due to PWA implementation of ocapi calls
var BasketMgr = require('dw/order/BasketMgr');
var Site = require('dw/system/Site');

var languageMap = {
    nl: 'nld',
    en: 'eng',
    fr: 'fra',
    de: 'deu',
    dk: 'dan',
    es: 'spa'
};


exports.get = function (httpParams) {
    var { createCCVPayment, CCV_CONSTANTS } = require('~/cartridge/scripts/services/CCVPaymentHelpers');
    var currentBasket = BasketMgr.getCurrentBasket();
    var basketId = currentBasket.UUID;

    var selectedPaymentMethod = httpParams.c_type && httpParams.c_type.pop();
    var returnUrl = httpParams.c_returnUrl && httpParams.c_returnUrl.pop();
    var requestLanguage = request.locale.split('_')[0];
    var orderDescription = currentBasket.allProductLineItems.toArray()
        .map(pli => pli.quantity + ' ' + pli.productName)
        .join(', ')
        .substring(0, 255);

    var { ccv_issuer_id } = currentBasket.paymentInstruments[0].custom;

    var paymentInstrument = currentBasket.paymentInstruments[0];

    // DEFAULT
    var requestBody = {
        amount: currentBasket.totalGrossPrice.value,
        currency: currentBasket.currencyCode.toLowerCase(),
        method: selectedPaymentMethod,
        returnUrl: returnUrl,
        merchantOrderReference: basketId, // we use basket id as reference since order is not placed yet
        description: orderDescription,
        language: languageMap[requestLanguage],
        details: {}
    };


    if ((selectedPaymentMethod === 'ideal') && ccv_issuer_id) {
        requestBody.issuer = ccv_issuer_id;
    }

    if (selectedPaymentMethod === 'giropay' && ccv_issuer_id) {
        requestBody.details.bic = ccv_issuer_id;
    }

    // CREDIT CARD
    if (selectedPaymentMethod === 'card') {
        if (paymentInstrument.creditCardToken) {
            // vault payment
            requestBody.details = {
                vaultAccessToken: paymentInstrument.creditCardToken
            };
        } else if (paymentInstrument.creditCardNumber) {
            // new inline credit card payment
            var [firstName, lastName] = paymentInstrument.creditCardHolder.split(' ');
            requestBody.details = {
                pan: paymentInstrument.creditCardNumber,
                expiryDate: `${paymentInstrument.creditCardExpirationMonth}${paymentInstrument.creditCardExpirationYear}`.padStart(4, '0'),
                cardholderFirstName: firstName,
                cardholderLastName: lastName || firstName
            };
            // a vaultAccessToken will be returned in the checkTransactionInfo response
            // we will add itto the customer's payment instrument in the UpdateStatuses job
            // todo: feature switch?
            requestBody.storeInVault = 'yes';
        }

        if (!Site.current.getCustomPreferenceValue('ccvCardsAutoCaptureEnabled')) {
            // if we don't specify a transactionType in the request, 'sale' wil be used by default
            requestBody.transactionType = CCV_CONSTANTS.TRANSACTION_TYPE.AUTHORISE;
        }
    }

    // BANCONTACT
    if (paymentInstrument.paymentMethod === 'CCV_BANCONTACT') {
        requestBody.brand = 'bcmc';
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
