/* eslint-disable no-unused-expressions */
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const { expect } = require('chai');

const stubs = require('./helpers/mocks/stubs');
const Status = require('./helpers/mocks/dw/system/Status');

const orderHooksCCV = proxyquire('../../cartridges/int_ccv/cartridge/scripts/hooks/orderHooksCCV', {
    'dw/order/OrderMgr': stubs.dw.OrderMgrMock,
    'dw/system/Site': stubs.dw.SiteMock,
    'dw/system/Logger': stubs.dw.loggerMock,
    '*/cartridge/scripts/services/CCVPaymentHelpers': stubs.CCVPaymentHelpersMock,
    '*/cartridge/scripts/helpers/CCVOrderHelpers': stubs.CCVOrderHelpersMock,
    'dw/system/Status': stubs.dw.Status,
    'dw/order/PaymentMgr': stubs.dw.PaymentMgrMock,
    'dw/order/PaymentTransaction': stubs.dw.PaymentTransaction,
    'dw/web/URLUtils': stubs.dw.URLUtilsMock

});

describe('orderHooksCCV', function () {
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
            custom: {},
            customerEmail: 'tester_email@test.com',
            billingAddress: {
                address1: 'Test Address 1',
                city: 'CityTest',
                stateCode: '',
                postalCode: '1245',
                countryCode: { value: 'BE' },
                address2: '',
                phone: '1234-1234-522',
                custom: { phone_country: '024' }
            },
            shipments: [{
                shippingAddress: {
                    address1: 'Test Address 1',
                    city: 'CityTest',
                    stateCode: '',
                    postalCode: '1245',
                    countryCode: { value: 'BE' },
                    address2: '',
                    phone: '1234-1234-522',
                    custom: { phone_country: '024' }
                }
            }]
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
        stubs.dw.URLUtilsMock.abs.returns({ toString: () => 'webhook-url' });
    });

    context('afterPOST', function () {
        it('should save payUrl to the order', () => {
            orderHooksCCV.afterPOST(order);
            expect(order.custom.ccvPayUrl).to.equal(createPaymentResponse.payUrl);
        });

        it('should return Status.ERROR if createCCVPayment call fails', () => {
            stubs.CCVPaymentHelpersMock.createCCVPayment.throws();

            const result = orderHooksCCV.afterPOST(order);
            expect(result).to.be.an.instanceof(Status);
            expect(result.status).to.equal(1);
        });

        it('returnUrl should contain orderNo', () => {
            orderHooksCCV.afterPOST(order);
            const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
            expect(paymentRequest.requestBody.returnUrl).to.have.string(order.orderNo);
        });

        it('should map to the correct language code in request', () => {
            orderHooksCCV.afterPOST(order);
            const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
            expect(paymentRequest.requestBody.language).to.eql('eng');
        });


        it('should update the orderPaymentInstrument\'s paymenTransaction.transactionID', () => {
            orderHooksCCV.afterPOST(order);

            expect(paymentInstrument.paymentTransaction.setTransactionID).to.have.been.calledOnceWith(createPaymentResponse.reference);
        });

        it('should update the orderPaymentInstrument\'s paymenTransaction.paymentProcessor', () => {
            orderHooksCCV.afterPOST(order);

            expect(paymentInstrument.paymentTransaction.setPaymentProcessor).to.have.been.calledOnceWith(CCV_PAYMENT_PROCESSOR);
        });

        it('should update the orderPaymentInstrument\'s paymenTransaction.type = AUTH for "authorise" payment type', () => {
            stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvCardsAuthoriseEnabled').returns(true);

            orderHooksCCV.afterPOST(order);

            expect(paymentInstrument.paymentTransaction.setType).to.have.been.calledOnceWith('AUTH');
        });

        it('should update the orderPaymentInstrument\'s paymenTransaction.type = CAPTURE for "sale" payment type', () => {
            stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvCardsAuthoriseEnabled').returns(false);

            orderHooksCCV.afterPOST(order);

            expect(paymentInstrument.paymentTransaction.setType).to.have.been.calledOnceWith('CAPTURE');
        });
    });

    context('createCcvPayment request', function () {
        context('Card', function () {
            it('if credit card token is provided, request should include it as vaultAccessToken and no other card data', () => {
                order.paymentInstruments[0].custom.ccvVaultAccessToken = 'testToken';
                orderHooksCCV.afterPOST(order);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.details.vaultAccessToken).to.be.string;
                expect(paymentRequest.requestBody.details.pan).to.be.undefined;
                expect(paymentRequest.requestBody.details.expiryDate).to.be.undefined;
                expect(paymentRequest.requestBody.details.cardholderFirstName).to.be.undefined;
                expect(paymentRequest.requestBody.details.cardholderLastName).to.be.undefined;
            });

            it('the request\'s transactionType should be set to "authorise" if authorise cards site pref is enabled', () => {
                stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvCardsAuthoriseEnabled').returns(true);

                orderHooksCCV.afterPOST(order);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.transactionType).to.eql(stubs.CCVPaymentHelpersMock.CCV_CONSTANTS.TRANSACTION_TYPE.AUTHORISE);
            });
            it('the request\'s transactionType should be set not be set if authorise cards site pref is disabled', () => {
                stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvCardsAuthoriseEnabled').returns(false);

                orderHooksCCV.afterPOST(order);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.transactionType).to.be.undefined;
            });
        });

        context('iDEAL', function () {
            it('request should include issuer id', () => {
                order.paymentInstruments[0].custom = { ccv_method_id: 'ideal', ccv_issuer_id: 'issuer_id_test' };
                orderHooksCCV.afterPOST(order);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.issuer).to.eql('issuer_id_test');
            });

            it('the request\'s transactionType should never be set to "authorise" for non-card payment methods', () => {
                stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvCardsAuthoriseEnabled').returns(false);
                order.paymentInstruments[0].custom = { ccv_method_id: 'ideal', ccv_issuer_id: 'issuer_id_test' };

                orderHooksCCV.afterPOST(order);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.transactionType).to.be.undefined;
            });
        });

        context('Giropay', function () {
            it('request should include bic', () => {
                order.paymentInstruments[0].custom = { ccv_method_id: 'giropay', ccv_issuer_id: 'issuer_id_test' };
                orderHooksCCV.afterPOST(order);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.details.bic).to.eql('issuer_id_test');
            });
        });

        context('Bancontact', function () {
            it('request should include brand=bcmc', () => {
                order.paymentInstruments[0].custom = { ccv_method_id: 'card' };
                order.paymentInstruments[0].paymentMethod = 'CCV_BANCONTACT';
                orderHooksCCV.afterPOST(order);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.brand).to.eql('bcmc');
            });
        });

        context('Klarna', function () {
            it('should add orderLines to the request body', () => {
                order.paymentInstruments[0].custom = { ccv_method_id: 'klarna' };
                order.paymentInstruments[0].paymentMethod = 'CCV_KLARNA';
                var testOrderLines = [{
                    type: 'PHYSICAL',
                    name: 'Green and Gold Necklace',
                    code: '013742003307M',
                    quantity: 1,
                    unit: 'pc',
                    unitPrice: '25.92',
                    totalPrice: 29.29,
                    vatRate: 13,
                    vat: 3.37
                }];
                stubs.CCVOrderHelpersMock.getKlarnaOrderLines.returns(testOrderLines);
                orderHooksCCV.afterPOST(order);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.method).to.eql('klarna');
                expect(paymentRequest.requestBody.orderLines).to.eql(testOrderLines);
            });
        });
    });
});
