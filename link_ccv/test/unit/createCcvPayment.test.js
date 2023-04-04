/* eslint-disable new-cap */
/* eslint-disable no-unused-expressions */
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const { expect } = require('chai');

const stubs = require('./helpers/mocks/stubs');

const createCcvPayment = proxyquire('../../cartridges/int_ccv/cartridge/scripts/apis/createCcvPayment', {
    'dw/order/OrderMgr': stubs.dw.OrderMgrMock,
    'dw/system/Site': stubs.dw.SiteMock,
    'dw/order/BasketMgr': stubs.dw.BasketMgrMock,
    'dw/system/Logger': stubs.dw.loggerMock,
    '~/cartridge/scripts/services/CCVPaymentHelpers': stubs.CCVPaymentHelpersMock,
    '*/cartridge/scripts/services/ocapiService.js': stubs.ocapiServiceMock
});

describe('', function () {
    this.timeout(0); // todo: remove after done
    const httpParams = { c_returnUrl: ['pwa-test.com'] };
    let order;
    let createPaymentResponse;

    before(() => stubs.init());
    afterEach(() => stubs.reset());
    after(() => stubs.restore());

    beforeEach(() => {
        order = {
            allProductLineItems: { toArray: () => [{
                productName: 'Line Item 1', quantity: 1
            }] },
            paymentInstruments: [{ custom: { ccv_method_id: 'card', paymentMethod: 'CCV_CREDIT_CARD_HPP' }, UUID: 'd3132131dsas' }],
            totalGrossPrice: { value: 25.75 },
            currencyCode: 'EUR',
            orderNo: '00001',
            orderToken: 'orderToken',
            custom: {}
        };

        createPaymentResponse = {
            amount: 25.75,
            currency: 'eur',
            method: 'card',
            type: 'sale',
            status: 'pending',
            payUrl: 'examplepayurl.com?ref=123123123123',
            reference: '123123123123'
        };

        global.request = { httpHost: 'sandbox.test', locale: 'en_UK' };
        global.dw = { system: { Site: { current: { ID: 'test-site' } } } };
        global.customer = { registered: false };
        stubs.ocapiServiceMock.createOcapiService
        .onFirstCall().returns({ call: () => {
            return {
                ok: true,
                object: {
                    order_no: '00001'
                }
            };
        } })
        .onSecondCall().returns({ call: (args) => {
            order.custom.ccvTransactionReference = args.requestBody.c_ccvTransactionReference;
            return {
                ok: true,
                object: {}
            };
        } });

        stubs.dw.BasketMgrMock.getCurrentBasket.returns({ UUID: '12345678abcd' });
        stubs.dw.OrderMgrMock.getOrder.returns(order);
        stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvCardsAutoCaptureEnabled').returns(false);

        stubs.CCVPaymentHelpersMock.createCCVPayment.returns(createPaymentResponse);
    });

    context('createCcvPayment', function () {
        it('should return {payUrl} if all calls are successful', () => {
            const result = createCcvPayment.get(httpParams);
            expect(result.payUrl).to.equal(createPaymentResponse.payUrl);
        });

        it('should return {order} if all calls are successful', () => {
            const result = createCcvPayment.get(httpParams);
            expect(result.order.order_no).to.equal(order.orderNo);
        });

        it('returnUrl should contain orderNo and orderToken', () => {
            createCcvPayment.get(httpParams);
            const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
            expect(paymentRequest.requestBody.returnUrl).to.have.string(order.orderNo)
            .and.to.have.string(order.orderToken);
        });

        it('should map to the correct language code in request', () => {
            createCcvPayment.get(httpParams);
            const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
            expect(paymentRequest.requestBody.language).to.eql('eng');
        });
    });

    context('createCcvPayment -  payment methods', function () {
        context('Card', function () {
            it('if credit card token is provided, request should include it as vaultAccessToken and no other card data', () => {
                order.paymentInstruments[0].creditCardToken = 'testToken';
                createCcvPayment.get(httpParams);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.details.vaultAccessToken).to.eql(order.paymentInstruments[0].creditCardToken);
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

                createCcvPayment.get(httpParams);

                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.details.vaultAccessToken).to.be.undefined;
                expect(paymentRequest.requestBody.details.pan).to.eql('1234123412341234');
                expect(paymentRequest.requestBody.details.expiryDate).to.eql('0225');
                expect(paymentRequest.requestBody.details.cardholderFirstName).to.eql('John');
                expect(paymentRequest.requestBody.details.cardholderLastName).to.eql('Doe');
            });

            it('the request\'s transactionType should be set to "authorise" if credit card auto capture is disabled', () => {
                stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvCardsAutoCaptureEnabled').returns(false);

                createCcvPayment.get(httpParams);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.transactionType).to.eql(stubs.CCVPaymentHelpersMock.CCV_CONSTANTS.TRANSACTION_TYPE.AUTHORISE);
            });
            it('the request\'s transactionType should be set not be set if credit card auto capture is enabled', () => {
                stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvCardsAutoCaptureEnabled').returns(true);

                createCcvPayment.get(httpParams);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.transactionType).to.be.undefined;
            });
        });
        context('iDEAL', function () {
            it('request should include issuer id', () => {
                order.paymentInstruments[0].custom = { ccv_method_id: 'ideal', ccv_issuer_id: 'issuer_id_test' };
                createCcvPayment.get(httpParams);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.issuer).to.eql('issuer_id_test');
            });

            it('the request\'s transactionType should never be set to "authorise" for non-card payment methods', () => {
                stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvCardsAutoCaptureEnabled').returns(false);
                order.paymentInstruments[0].custom = { ccv_method_id: 'ideal', ccv_issuer_id: 'issuer_id_test' };

                createCcvPayment.get(httpParams);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.transactionType).to.be.undefined;
            });
        });

        context('Giropay', function () {
            it('request should include bic', () => {
                order.paymentInstruments[0].custom = { ccv_method_id: 'giropay', ccv_issuer_id: 'issuer_id_test' };
                createCcvPayment.get(httpParams);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.details.bic).to.eql('issuer_id_test');
            });
        });

        context('Bancontact', function () {
            it('request should include brand=bcmc', () => {
                order.paymentInstruments[0].custom = { ccv_method_id: 'card' };
                order.paymentInstruments[0].paymentMethod = 'CCV_BANCONTACT';
                createCcvPayment.get(httpParams);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.brand).to.eql('bcmc');
            });
        });
    });

    context('createCcvPayment - error handling for the 3 service calls: \n\t1. ocapi POST /orders\n\t2: CCV-create payment \n\t3: ocapi PATCH/orders/*/payment_instrument', function () {
        before('3 calls are made', () => {});
        it('should throw if call 1 fails', () => {
            stubs.ocapiServiceMock.createOcapiService
            .onFirstCall().throws(new Error('timeout'));

            expect(createCcvPayment.get.bind(httpParams)).to.throw();
        });

        it('should throw if call 1 is not OK', () => {
            stubs.ocapiServiceMock.createOcapiService
            .onFirstCall().returns({ call: () => {
                return {
                    ok: false
                };
            } });

            expect(createCcvPayment.get.bind(httpParams)).to.throw();
        });


        it('if call 2 fails, we should still call 3', () => {
            stubs.CCVPaymentHelpersMock.createCCVPayment.throws(new Error('timeout'));
            createCcvPayment.get(httpParams);

            expect(stubs.ocapiServiceMock.createOcapiService).to.have.been.calledTwice;
        });

        it('if call 2 failed, but call 3 succeeded, we should not throw but return an error msg ', () => {
            stubs.CCVPaymentHelpersMock.createCCVPayment.throws(new Error('timeout'));
            const result = createCcvPayment.get(httpParams);

            expect(result.errorMsg).to.eql('missing_reference');
        });

        it('should throw if call 3 is not OK', () => {
            stubs.ocapiServiceMock.createOcapiService
            .onSecondCall().returns({ call: (args) => {
                order.custom.ccvTransactionReference = args.requestBody.c_ccvTransactionReference;
                return {
                    ok: false,
                    object: {}
                };
            } });

            expect(createCcvPayment.get.bind(httpParams)).to.throw();
        });
    });
});
