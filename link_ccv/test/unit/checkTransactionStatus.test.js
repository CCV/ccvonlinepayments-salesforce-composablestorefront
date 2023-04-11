/* eslint-disable no-unused-expressions */
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const { expect } = require('chai');

const stubs = require('./helpers/mocks/stubs');

const checkTransactionStatus = proxyquire('../../cartridges/int_ccv/cartridge/scripts/apis/checkTransactionStatus', {
    'dw/order/OrderMgr': stubs.dw.OrderMgrMock,
    'dw/order/Order': stubs.dw.OrderMock,
    'dw/system/Site': stubs.dw.SiteMock,
    '*/cartridge/scripts/services/ocapiService.js': stubs.ocapiServiceMock
});
const Order = require('./helpers/mocks/dw/order/Order');

describe('Check Transaction Status custom endpoint', function () {
    this.timeout(0); // todo: remove after done
    let order;
    let orderPaymentInstrument;
    let createPaymentResponse;
    let ocapiParams;

    before(() => stubs.init());
    afterEach(() => stubs.reset());
    after(() => stubs.restore());

    beforeEach(() => {
        global.request = {
            httpParameters: {
                ref: ['testCCVTransactionRef'],
                token: ['testOrderToken']
            },
            httpHost: 'sandbox-test.salesforce.com'
        };
        global.customer = { registered: true, ID: 'test_customer_id' };

        order = {
            allProductLineItems: { toArray: () => [{
                productName: 'Line Item 1', quantity: 1
            }] },
            paymentInstruments: [{ custom: { ccv_method_id: 'card', paymentMethod: 'CCV_CREDIT_CARD_HPP' }, UUID: 'd3132131dsas' }],
            totalGrossPrice: { value: 25.75 },
            currencyCode: 'EUR',
            orderNo: '00001',
            orderToken: 'orderToken',
            custom: {},
            customer: { ID: 'test_customer_id' },
            status: { value: Order.ORDER_STATUS_CREATED }
        };
        orderPaymentInstrument = order.paymentInstruments[0];
        ocapiParams = null;

        stubs.ocapiServiceMock.createOcapiService.returns({
            call: (args) => {
                ocapiParams = args;
                orderPaymentInstrument.custom.ccv_transaction_status = 'success';
                return {
                    ok: true,
                    object: {}
                };
            } });

        stubs.dw.OrderMgrMock.getOrder.returns(order);
        stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvCardsAutoCaptureEnabled').returns(false);

        stubs.CCVPaymentHelpersMock.createCCVPayment.returns(createPaymentResponse);
    });

    context('Success flow', function () {
        it('should add payment method id to ocapi request path', () => {
            checkTransactionStatus.get();
            expect(ocapiParams.requestPath).to.include(orderPaymentInstrument.UUID);
        });
        it('should include payment_method_id in the ocapi request body', () => {
            checkTransactionStatus.get();
            expect(ocapiParams.requestBody.payment_method_id).to.equal(orderPaymentInstrument.paymentMethod);
        });
        it('should include payment_card data in the ocapi request body if credit card details are provided', () => {
            orderPaymentInstrument.creditCardNumber = '4111111111111111';
            orderPaymentInstrument.creditCardType = 'visa';
            orderPaymentInstrument.creditCardExpirationMonth = '2';
            orderPaymentInstrument.creditCardExpirationYear = '26';
            checkTransactionStatus.get();
            expect(ocapiParams.requestBody.payment_method_id).to.eql(orderPaymentInstrument.paymentMethod);
            expect(ocapiParams.requestBody.payment_card.number).to.eql(orderPaymentInstrument.creditCardNumber);
            expect(ocapiParams.requestBody.payment_card.card_type).to.eql(orderPaymentInstrument.creditCardType);
            expect(ocapiParams.requestBody.payment_card.expiration_month).to.eql(orderPaymentInstrument.creditCardExpirationMonth);
            expect(ocapiParams.requestBody.payment_card.expiration_year).to.eql(orderPaymentInstrument.creditCardExpirationYear);
        });
        it('should not include payment_card data in the ocapi request body if credit card details are NOT provided', () => {
            checkTransactionStatus.get();
            expect(ocapiParams.requestBody.payment_method_id).to.eql(orderPaymentInstrument.paymentMethod);
            expect(ocapiParams.requestBody.payment_card).to.be.undefined;
        });
        it('should return the CCV transaction status', () => {
            const result = checkTransactionStatus.get();
            expect(result.status).to.eql('success');
        });
        it('should return errorMsg if a ccv_failure_code was saved in the payment instrument', () => {
            orderPaymentInstrument.custom.ccv_failure_code = 'error_code';
            const result = checkTransactionStatus.get();

            expect(result.errorMsg).to.eql('error_code');
        });
        it('should return customPaymentError if there is price or currency mismatch', () => {
            order.custom.ccvPriceOrCurrencyMismatch = true;
            const result = checkTransactionStatus.get();

            expect(result.customPaymentError).to.eql('price_or_currency_mismatch');
        });
    });

    context('Error handling', function () {
        it('should return errorMsg if a ccv_failure_code was saved in the payment instrument', () => {
            orderPaymentInstrument.custom.ccv_failure_code = 'error_code';
            const result = checkTransactionStatus.get();

            expect(result.errorMsg).to.eql('error_code');
        });
        it('should return customPaymentError if there is price or currency mismatch', () => {
            order.custom.ccvPriceOrCurrencyMismatch = true;
            const result = checkTransactionStatus.get();

            expect(result.customPaymentError).to.eql('price_or_currency_mismatch');
        });
        it('should throw if order reference is missing from request', () => {
            global.request = {
                httpParameters: {
                    token: ['testOrderToken']
                }
            };
            expect(checkTransactionStatus.get).to.throw('CCV: OrderNo or token missing from request: OrderNo: undefined token: testOrderToken');
        });
        it('should throw if order token is missing from request', () => {
            global.request = {
                httpParameters: {
                    ref: ['testCCVTransactionRef']
                }
            };
            expect(checkTransactionStatus.get).to.throw('CCV: OrderNo or token missing from request: OrderNo: testCCVTransactionRef token: undefined');
        });
        it('should throw if no order was found', () => {
            stubs.dw.OrderMgrMock.getOrder.returns(null);

            expect(checkTransactionStatus.get).to.throw('CCV: Order not found.');
        });
        it('should throw if session customer is different than order customer', () => {
            order.customer.ID = 'differentCustomerID';
            expect(checkTransactionStatus.get).to.throw('CCV: Order reference belongs to a different customer.');
        });
        it('should throw if the order status isn\'t CREATED', () => {
            order.status.value = Order.ORDER_STATUS_FAILED;
            expect(checkTransactionStatus.get).to.throw('CCV: Trying to update an order that is not in "Created" status.');
        });
        it('should throw if the ocapi call update the order payment instrument isn\'t ok', () => {
            const errorMsg = 'some error msg';
            stubs.ocapiServiceMock.createOcapiService.returns({
                call: () => {
                    return {
                        ok: false,
                        object: {},
                        errorMessage: errorMsg
                    };
                } });
            expect(checkTransactionStatus.get).to.throw(`CCV: error authorizing payment: ${errorMsg}`);
        });
    });
});
