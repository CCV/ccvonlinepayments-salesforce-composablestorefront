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
    '*/cartridge/scripts/helpers/CCVOrderHelpers': stubs.CCVOrderHelpers,
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
        const mockPaymenInstrument = {
            custom: { ccv_method_id: 'card' },
            paymentMethod: 'CCV_CREDIT_CARD',
            UUID: 'd3132131dsas',
            getPaymentMethod: () => null,
            paymentTransaction: new stubs.dw.PaymentTransactionMock()
        }
        ;

        order = {
            allProductLineItems: { toArray: () => [{
                productName: 'Line Item 1',
                quantity: { value: 1 },
                basePrice: { value: 5, currency: 'EUR' },
                adjustedGrossPrice: { value: 5, currency: 'EUR' }
            }] },
            paymentInstruments: [Object.assign({}, mockPaymenInstrument)],
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
                custom: { phone_country: '024' },
                setCountryCode: function (country) {
                    this.countryCode = { value: country };
                }
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
                    custom: { phone_country: '024' },
                    setCountryCode: function (country) {
                        this.countryCode = { value: country };
                    }
                }
            }],
            get allLineItems() {
                return this.allProductLineItems;
            },
            get defaultShipment() {
                return this.shipments[0];
            },
            createPaymentInstrument: function (instrumentID) {
                const newPi = Object.assign(mockPaymenInstrument, { paymentMethod: instrumentID });

                this.paymentInstruments.push(newPi);
                return newPi;
            },
            get paymentInstrument() {
                return this.paymentInstruments[0];
            }
        };

        paymentInstrument = order.paymentInstruments[0];

        createPaymentResponse = {
            amount: 25.75,
            currency: 'eur',
            method: 'card',
            type: 'sale',
            status: 'pending',
            payUrl: 'examplepayurl.com?ref=123123123123',
            details: {
                qrCode: 'https://shop-vpos.ccvlab.eu/bep/authenticate.html?secureTransferId=5f188b28-6f46-4955-9bfe-c9987fdc2cca&trm=50',
                urlIntent: 'https://shop-vpos.ccvlab.eu/bep/authenticate.html?secureTransferId=5f188b28-6f46-4955-9bfe-c9987fdc2cca&trm=51'
            },
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
        stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccv3DSExemption').returns({ value: null });
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

            it('should add 3DS exemption to request if the site preference is enabled', () => {
                const exemption = 'LOW_VALUE';
                stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccv3DSExemption').returns({ value: exemption });
                orderHooksCCV.afterPOST(order);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.details.authExemption).to.eql(exemption);
            });
            it('should not add 3DS exemption to request if the site preference is disabled', () => {
                stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccv3DSExemption').returns({ value: null });
                orderHooksCCV.afterPOST(order);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.details.authExemption).to.be.undefined;
            });
        });

        context('iDEAL', function () {
            it('the request\'s transactionType should never be set to "authorise" for non-card payment methods', () => {
                stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvCardsAuthoriseEnabled').returns(false);
                order.paymentInstruments[0].custom = { ccv_method_id: 'ideal', ccv_issuer_id: 'issuer_id_test' };

                orderHooksCCV.afterPOST(order);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.transactionType).to.be.undefined;
            });
            it('should not call ideal fastCheckout logic for non-fast-checkout calls', () => {
                orderHooksCCV.beforePOST(order);
                expect(stubs.CCVOrderHelpersMock.createIdealFastCheckoutPayment).not.to.have.been.called;
                expect(stubs.CCVOrderHelpersMock.addPlaceholderDataToBasket).not.to.have.been.called;
            });

            describe('Ideal Fast Checkout', function () {
                beforeEach(() => {
                    global.request.httpParameters.paymentMethodId = ['idealFastCheckout'];
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
                    const getCCVOrderLinesMock = stubs.sandbox.stub();
                    const originalFunc = stubs.CCVOrderHelpers.getCCVOrderLines;
                    stubs.CCVOrderHelpers.getCCVOrderLines = getCCVOrderLinesMock;
                    getCCVOrderLinesMock.returns(testOrderLines);

                    order.paymentInstruments = [];
                    orderHooksCCV.beforePOST(order);
                    orderHooksCCV.afterPOST(order);
                    stubs.CCVOrderHelpers.getCCVOrderLines = originalFunc;
                });

                it('should create a new payment instrument with payment method = CCV_IDEAL', () => {
                    expect(order.paymentInstruments).to.have.lengthOf(1);
                    expect(order.paymentInstruments[0].paymentMethod).to.eql('CCV_IDEAL');
                });

                it('should add orderLines to the request body', () => {
                    const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                    expect(paymentRequest.requestBody.orderLines[0]).to.exist;
                });

                it('should add requestCheckoutDetails to the request body', () => {
                    const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                    expect(paymentRequest.requestBody.requestCheckoutDetails).to.exist;
                    expect(paymentRequest.requestBody.requestCheckoutDetails).to.include('first_name');
                    expect(paymentRequest.requestBody.requestCheckoutDetails).to.include('last_name');
                    expect(paymentRequest.requestBody.requestCheckoutDetails).to.include('billing');
                    expect(paymentRequest.requestBody.requestCheckoutDetails).to.include('shipping');
                    expect(paymentRequest.requestBody.requestCheckoutDetails).to.include('email');
                });
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
            it('should save the qr code and the urlIntent to order', () => {
                order.paymentInstruments[0].custom = { ccv_method_id: 'card' };
                order.paymentInstruments[0].paymentMethod = 'CCV_BANCONTACT';
                orderHooksCCV.afterPOST(order);
                expect(order.custom.ccvUrlIntent).to.eql(createPaymentResponse.details.urlIntent);
                expect(order.custom.ccvQrCode).to.eql(createPaymentResponse.details.qrCode);
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
                const getCCVOrderLinesMock = stubs.sandbox.stub();
                const originalFunc = stubs.CCVOrderHelpers.getCCVOrderLines;
                stubs.CCVOrderHelpers.getCCVOrderLines = getCCVOrderLinesMock;
                getCCVOrderLinesMock.returns(testOrderLines);
                orderHooksCCV.afterPOST(order);
                const paymentRequest = stubs.CCVPaymentHelpersMock.createCCVPayment.getCall(0).args[0];
                expect(paymentRequest.requestBody.method).to.eql('klarna');
                expect(paymentRequest.requestBody.orderLines).to.eql(testOrderLines);
                stubs.CCVOrderHelpers.getCCVOrderLines = originalFunc;
            });
        });
    });
});
