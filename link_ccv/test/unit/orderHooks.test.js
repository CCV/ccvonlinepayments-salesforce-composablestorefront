/* eslint-disable no-unused-expressions */
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const { expect } = require('chai');

const stubs = require('./helpers/mocks/stubs');
const Status = require('./helpers/mocks/dw/system/Status');

const orderHooks = proxyquire('../../cartridges/int_ccv/cartridge/scripts/hooks/orderHooks', {
    'dw/order/OrderMgr': stubs.dw.OrderMgrMock,
    'dw/system/Site': stubs.dw.SiteMock,
    'dw/system/Logger': stubs.dw.loggerMock,
    '*/cartridge/scripts/services/CCVPaymentHelpers': stubs.CCVPaymentHelpersMock,
    'dw/system/Status': stubs.dw.Status,
    'dw/order/PaymentMgr': stubs.dw.PaymentMgrMock,
    'dw/order/PaymentTransaction': stubs.dw.PaymentTransaction

});

describe('orderHooks', function () {
    let order;
    let createPaymentResponse;
    let paymentInstrument;
    const CCV_PAYMENT_PROCESSOR = 'CCV_DEFAULT';
    before(() => stubs.init());
    afterEach(() => stubs.reset());
    after(() => stubs.restore());

    beforeEach(() => {
        order = {
            allProductLineItems: { toArray: () => [{
                productName: 'Line Item 1', quantity: 1
            }] },
            paymentInstruments: [
                {
                    custom: { ccv_method_id: 'card' },
                    paymentMethod: 'CCV_CREDIT_CARD',
                    UUID: 'd3132131dsas',
                    getPaymentMethod: () => null,
                    paymentTransaction: new stubs.dw.PaymentTransactionMock()
                }
            ],
            totalGrossPrice: { value: 25.75 },
            currencyCode: 'EUR',
            orderNo: '00001',
            orderToken: 'orderToken',
            custom: {}
        };

        paymentInstrument = order.paymentInstruments[0];

        createPaymentResponse = {
            amount: 25.75,
            currency: 'eur',
            method: 'card',
            type: 'sale',
            status: 'pending',
            payUrl: 'examplepayurl.com?ref=123123123123',
            reference: 'CCVTransactionReference'
        };

        global.request = {
            httpHost: 'sandbox.test',
            locale: 'en_UK',
            httpParameters: { ccvReturnUrl: ['pwa-test.com'] }
        };
        global.dw = { system: { Site: { current: { ID: 'test-site' } } } };
        global.customer = { registered: false };

        stubs.dw.BasketMgrMock.getCurrentBasket.returns({ UUID: '12345678abcd' });
        stubs.dw.OrderMgrMock.getOrder.returns(order);
        stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvCardsAuthoriseEnabled').returns(false);
        stubs.dw.PaymentMgrMock.getPaymentMethod.returns({ getPaymentProcessor: () => CCV_PAYMENT_PROCESSOR });
        stubs.CCVPaymentHelpersMock.createCCVPayment.returns(createPaymentResponse);
    });

    context('afterPOST', function () {
        it('should save payUrl to the order', () => {
            orderHooks.afterPOST(order);
            expect(order.custom.ccvPayUrl).to.equal(createPaymentResponse.payUrl);
        });

        it('should return Status.OK if createCCVPayment call is successful', () => {
            const result = orderHooks.afterPOST(order);
            expect(result).to.be.an.instanceof(Status);
            expect(result.status).to.equal(0);
        });

        it('should return Status.ERROR if createCCVPayment call fails', () => {
            stubs.CCVPaymentHelpersMock.createCCVPayment.throws();

            const result = orderHooks.afterPOST(order);
            expect(result).to.be.an.instanceof(Status);
            expect(result.status).to.equal(1);
        });

        it('returnUrl should contain orderNo and orderToken', () => {
            orderHooks.afterPOST(order);
            const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
            expect(paymentRequest.requestBody.returnUrl).to.have.string(order.orderNo)
            .and.to.have.string(order.orderToken);
        });

        it('should map to the correct language code in request', () => {
            orderHooks.afterPOST(order);
            const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
            expect(paymentRequest.requestBody.language).to.eql('eng');
        });


        it('should update the orderPaymentInstrument\'s paymenTransaction.transactionID', () => {
            orderHooks.afterPOST(order);

            expect(paymentInstrument.paymentTransaction.setTransactionID).to.have.been.calledOnceWith(createPaymentResponse.reference);
        });

        it('should update the orderPaymentInstrument\'s paymenTransaction.paymentProcessor', () => {
            orderHooks.afterPOST(order);

            expect(paymentInstrument.paymentTransaction.setPaymentProcessor).to.have.been.calledOnceWith(CCV_PAYMENT_PROCESSOR);
        });

        it('should update the orderPaymentInstrument\'s paymenTransaction.type = AUTH for "authorise" payment type', () => {
            stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvCardsAuthoriseEnabled').returns(true);

            orderHooks.afterPOST(order);

            expect(paymentInstrument.paymentTransaction.setType).to.have.been.calledOnceWith('AUTH');
        });

        it('should update the orderPaymentInstrument\'s paymenTransaction.type = CAPTURE for "sale" payment type', () => {
            stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvCardsAuthoriseEnabled').returns(false);

            orderHooks.afterPOST(order);

            expect(paymentInstrument.paymentTransaction.setType).to.have.been.calledOnceWith('CAPTURE');
        });
    });

    context('createCcvPayment request', function () {
        context('Card', function () {
            it('if credit card token is provided, request should include it as vaultAccessToken and no other card data', () => {
                order.paymentInstruments[0].custom.ccvVaultAccessToken = 'testToken';
                orderHooks.afterPOST(order);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.details.vaultAccessToken).to.be.string;
                expect(paymentRequest.requestBody.details.pan).to.be.undefined;
                expect(paymentRequest.requestBody.details.expiryDate).to.be.undefined;
                expect(paymentRequest.requestBody.details.cardholderFirstName).to.be.undefined;
                expect(paymentRequest.requestBody.details.cardholderLastName).to.be.undefined;
            });

            it('request should include card data if card data is provided and there is no token', () => {
                order.paymentInstruments[0].creditCardNumber = '1234123412341234';
                order.paymentInstruments[0].creditCardExpirationMonth = 2;
                order.paymentInstruments[0].creditCardExpirationYear = 25;
                order.paymentInstruments[0].creditCardHolder = 'John Doe';

                orderHooks.afterPOST(order);

                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.details.vaultAccessToken).to.be.undefined;
                expect(paymentRequest.requestBody.details.pan).to.eql('1234123412341234');
                expect(paymentRequest.requestBody.details.expiryDate).to.eql('0225');
                expect(paymentRequest.requestBody.details.cardholderFirstName).to.eql('John');
                expect(paymentRequest.requestBody.details.cardholderLastName).to.eql('Doe');
            });

            it('the request\'s transactionType should be set to "authorise" if authorise cards site pref is enabled', () => {
                stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvCardsAuthoriseEnabled').returns(true);

                orderHooks.afterPOST(order);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.transactionType).to.eql(stubs.CCVPaymentHelpersMock.CCV_CONSTANTS.TRANSACTION_TYPE.AUTHORISE);
            });
            it('the request\'s transactionType should be set not be set if authorise cards site pref is disabled', () => {
                stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvCardsAuthoriseEnabled').returns(false);

                orderHooks.afterPOST(order);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.transactionType).to.be.undefined;
            });
        });

        context('iDEAL', function () {
            it('request should include issuer id', () => {
                order.paymentInstruments[0].custom = { ccv_method_id: 'ideal', ccv_issuer_id: 'issuer_id_test' };
                orderHooks.afterPOST(order);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.issuer).to.eql('issuer_id_test');
            });

            it('the request\'s transactionType should never be set to "authorise" for non-card payment methods', () => {
                stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvCardsAuthoriseEnabled').returns(false);
                order.paymentInstruments[0].custom = { ccv_method_id: 'ideal', ccv_issuer_id: 'issuer_id_test' };

                orderHooks.afterPOST(order);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.transactionType).to.be.undefined;
            });
        });

        context('Giropay', function () {
            it('request should include bic', () => {
                order.paymentInstruments[0].custom = { ccv_method_id: 'giropay', ccv_issuer_id: 'issuer_id_test' };
                orderHooks.afterPOST(order);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.details.bic).to.eql('issuer_id_test');
            });
        });

        context('Bancontact', function () {
            it('request should include brand=bcmc', () => {
                order.paymentInstruments[0].custom = { ccv_method_id: 'card' };
                order.paymentInstruments[0].paymentMethod = 'CCV_BANCONTACT';
                orderHooks.afterPOST(order);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.brand).to.eql('bcmc');
            });
        });
    });
});
