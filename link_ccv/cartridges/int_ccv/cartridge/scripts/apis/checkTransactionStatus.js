'use strict';
var Logger = require('dw/system/Logger');

exports.get = function () {
    var BasketMgr = require('dw/order/BasketMgr');
    var { checkCCVTransaction } = require('~/cartridge/scripts/services/CCVPaymentHelpers');

    var currentBasket = BasketMgr.getCurrentBasket();
    var reference = currentBasket.custom.ccvTransactionReference;

    if (!reference) {
        throw new Error('No transaction reference found.');
    }

    var transactionStatus = checkCCVTransaction(reference);

    // // if customer selected "save card" during checkout CCV returns a credit card token,
    // // which we save to the customer's saved payment instruments
    if (transactionStatus.details && transactionStatus.details.vaultAccessToken) {
        try {
            // todo: how to avoid duplication?
            // create new customer payment instrument
            // POST https://hostname:port/dw/shop/v23_1/customers/{customer_id}/payment_instruments
            var ocapiService = require('*/cartridge/scripts/services/ocapiService.js');
            var details = transactionStatus.details;

            // save the reference to the user's basket
            var saveCustomerPaymentInstrumentResponse = ocapiService.createOcapiService().call({
                requestPath: `https://${request.httpHost}/s/${dw.system.Site.current.ID}/dw/shop/v23_1/customers/${customer.ID}/payment_instruments`,
                requestMethod: 'POST',
                requestBody: {
                    payment_card: {
                        card_type: details.brand,
                        number: details.maskedPan,
                        expiration_month: details.expiryDate && parseInt(details.expiryDate.substring(0, 2), 10),
                        expiration_year: details.expiryDate && parseInt(`20${details.expiryDate.substring(2, 4)}`, 10),
                        issue_number: '',
                        holder: [details.cardholderFirstName, details.cardholderLastName].filter(x => x).join(' '),
                        valid_from_month: 1,
                        valid_from_year: 2020
                    },
                    payment_method_id: 'CCV_CREDIT_CARD',
                    c_ccv_card_token: details.vaultAccessToken
                }
            });
        } catch (error) {
            Logger.error('Failed saving payment instrument to customer\'s account/')
        }
    }

/**
 * store in vault + create payment response
 * {
    "lastUpdate": 1677838914588,
    "created": 1677838872200,
    "cancelUrl": "https://redirect.jforce.be/card/cancel/merchant?reference=C230303112112196CB8D84B0.3",
    "notificationRequests": [],
    "details": {
        "cardholderFirstName": "czc",
        "initialTransactionId": "bSNeiyJQzM4v300",
        "qrCode": "https://shop-vpos.ccvlab.eu/bep/authenticate.html?secureTransferId=4bb7420c-f379-4c44-9867-4b24ffdc674e&trm=50",
        "maskedPan": "4111XXXXXXXX1111",
        "acquirerResponseCode": "00",
        "urlIntent": "https://shop-vpos.ccvlab.eu/bep/authenticate.html?secureTransferId=4bb7420c-f379-4c44-9867-4b24ffdc674e&trm=51",
        "authorisedAmount": 28.2,
        "acquirer": "Valitor",
        "cardholderLastName": "Sparrow",
        "authenticationProtocol": "3DS1",
        "authenticationStatus": "Y",
        "acquirerResponseCodeDescription": "ApprovedOrCompletedSuccessfully"
    },
    "payUrl": "https://onlinepayments.ccv.eu/card/payment.html?reference=C230303112112196CB8D84B0.3",
    "brand": "visa",
    "amount": 28.2,
    "methodTransactionId": "w3Av1i",
    "entryMode": "ecom",
    "merchantOrderReference": "dd9b34ce6843df2bc22911a338",
    "status": "success",
    "description": "PWA Order",
    "reference": "C230303112112196CB8D84B0.3",
    "currency": "eur",
    "returnUrl": "http://localhost:3000/en-US/checkout/handleShopperRedirect",
    "method": "card",
    "language": "eng",
    "type": "sale"
}


{
    "lastUpdate": 1677843760818,
    "created": 1677843749937,
    "cancelUrl": "https://redirect.jforce.be/card/cancel/merchant?reference=C230303124229934CB8D66F4.3",
    "notificationRequests": [],
    "details": {
        "scaToken": true,
        "maskedPan": "4111XXXXXXXX1111",
        "acquirerResponseCode": "00",
        "vaultAccessToken": "E77468AF579FFE48F793AFED",
        "dataType": "card",
        "expirationTimestamp": 1680435760602,
        "authorisedAmount": 135.4,
        "acquirer": "Valitor",
        "cardholderLastName": "Sparrow",
        "authenticationProtocol": "3DS1",
        "acquirerResponseCodeDescription": "ApprovedOrCompletedSuccessfully",
        "expiryDate": "0330",
        "cardholderFirstName": "czc",
        "initialTransactionId": "cByZmuYQJke5L00",
        "expirationDuration": "P0Y0M30DT0H0M0.000S",
        "brand": "visa",
        "authenticationStatus": "Y"
    },
    "payUrl": "https://onlinepayments.ccv.eu/card/payment.html?reference=C230303124229934CB8D66F4.3",
    "brand": "visa",
    "amount": 135.4,
    "methodTransactionId": "SQb1ka",
    "entryMode": "ecom",
    "merchantOrderReference": "ea8344c5b98769e3a66fa9b6ea",
    "status": "success",
    "description": "1 Ruffle Front Wrap A-Line Dress",
    "reference": "C230303124229934CB8D66F4.3",
    "currency": "eur",
    "returnUrl": "http://localhost:3000/en-US/checkout/handleShopperRedirect",
    "method": "card",
    "language": "eng",
    "type": "sale"
}
 */

    var result = {
        status: transactionStatus.status
    };

    return result;
};
