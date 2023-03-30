'use strict';
/* eslint-disable camelcase */ // custom properties can't be camelcase due to PWA implementation of ocapi calls
var BasketMgr = require('dw/order/BasketMgr');
var Site = require('dw/system/Site');
var OrderMgr = require('dw/order/OrderMgr');

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
    var ocapiService = require('*/cartridge/scripts/services/ocapiService.js');
    var currentBasket = BasketMgr.getCurrentBasket();
    var basketId = currentBasket.UUID;

    // ============= 1. CREATE ORDER =============
    var orderResponse = ocapiService.createOcapiService().call({
        requestPath: `https://${request.httpHost}/s/${dw.system.Site.current.ID}/dw/shop/v23_1/orders`,
        requestMethod: 'POST',
        requestBody: {
            basket_id: basketId
        }
    });

    // throw new Error(123);

    if (!orderResponse.ok) {
        throw new Error(orderResponse.errorMessage);
    }

    var order = OrderMgr.getOrder(orderResponse.object.order_no);

    // ============= 2. CREATE CCV PAYMENT REQUEST =============
    var returnUrl = httpParams.c_returnUrl && httpParams.c_returnUrl.pop();
    var requestLanguage = request.locale.split('_')[0];
    var orderDescription = order.allProductLineItems.toArray()
        .map(pli => pli.quantity + ' ' + pli.productName)
        .join(', ')
        .substring(0, 255);

    var { ccv_issuer_id } = order.paymentInstruments[0].custom;
    var paymentInstrument = order.paymentInstruments[0];

    var selectedMethodCCVId = paymentInstrument.custom.ccv_method_id;

    // DEFAULT
    var requestBody = {
        amount: order.totalGrossPrice.value,
        // amount: 8.01,
        // amount: 50,
        currency: order.currencyCode.toLowerCase(),
        method: selectedMethodCCVId,
        returnUrl: `${returnUrl}?ref=${order.orderNo}&token=${order.orderToken}`,
        merchantOrderReference: order.orderNo,
        description: orderDescription,
        language: languageMap[requestLanguage],
        details: {}
    };


    if ((selectedMethodCCVId === 'ideal') && ccv_issuer_id) {
        requestBody.issuer = ccv_issuer_id;
    }

    if (selectedMethodCCVId === 'giropay' && ccv_issuer_id) {
        requestBody.details.bic = ccv_issuer_id;
    }

    // CREDIT CARD
    if (selectedMethodCCVId === 'card') {
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
            if (customer.registered && customer.authenticated && Site.current.getCustomPreferenceValue('ccvStoreCardsInVaultEnabled')) {
                // a vaultAccessToken will be returned in the checkTransactionInfo response
                // we will add it to the customer's payment instrument in the UpdateStatuses job
                // requestBody.storeInVault = 'yes';
            }
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

    // ============= 3. SAVE CCV DATA TO ORDER PAYMENT INSTRUMENT =============

    var updatePaymentInstrumentResponse = ocapiService.createOcapiService().call({
        requestPath: `https://${request.httpHost}/s/${dw.system.Site.current.ID}/dw/shop/v23_1/orders/${order.orderNo}/payment_instruments/${paymentInstrument.UUID}?skip_authorization=true`,
        requestMethod: 'PATCH',
        requestBody: {
            payment_method_id: paymentInstrument.paymentMethod,
            c_ccvTransactionReference: paymentResponse.reference,
            payment_card: paymentInstrument.creditCardNumber ?
            { card_type: paymentInstrument.creditCardType,
                number: paymentInstrument.creditCardNumber,
                expiration_month: paymentInstrument.creditCardExpirationMonth,
                expiration_year: paymentInstrument.creditCardExpirationYear
            } : undefined
        }
    });

    if (!updatePaymentInstrumentResponse.ok) {
        throw new Error('Transaction reference could not be saved to basket.');
    }

    if (!order.custom.ccvTransactionReference) {
        throw new Error('No CCV transaction reference in basket - order failed');
    }

    return {
        payUrl: paymentResponse.payUrl,
        order: orderResponse.object
    };
};
