/* eslint-disable no-unused-expressions */
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const { expect } = require('chai');

const stubs = require('./helpers/mocks/stubs');

const checkTransactionStatus = proxyquire('../../cartridges/int_ccv/cartridge/scripts/apis/checkTransactionStatus', {
    'dw/order/OrderMgr': stubs.dw.OrderMgrMock,
    'dw/order/Order': stubs.dw.OrderMock
});
const Order = require('./helpers/mocks/dw/order/Order');

describe('Check Transaction Status custom endpoint', function () {
    let order;

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
            paymentInstruments: [{
                paymentMethod: 'CCV_CREDIT_CARD',
                custom: {
                    ccv_method_id: 'card'
                },
                UUID: 'd3132131dsas',
                paymentTransaction: {
                    custom: {
                        ccv_transaction_status: 'success',
                        ccv_failure_code: null
                    }
                }
            }],
            totalGrossPrice: { value: 25.75 },
            currencyCode: 'EUR',
            orderNo: '00001',
            orderToken: 'orderToken',
            custom: {},
            customer: { ID: 'test_customer_id' },
            status: { value: Order.ORDER_STATUS_CREATED }
        };

        stubs.dw.OrderMgrMock.getOrder.returns(order);
    });

    context('Success flow', function () {
        it('should return the CCV transaction status', () => {
            const result = checkTransactionStatus.get();
            expect(result.status).to.eql('success');
        });
        it('should return errorMsg if a ccv_failure_code was saved in the payment instrument\'s transaction', () => {
            const errorCode = 'error_code';
            order.paymentInstruments[0].paymentTransaction.custom.ccv_failure_code = errorCode;
            const result = checkTransactionStatus.get();

            expect(result.errorMsg).to.eql(errorCode);
        });
    });

    context('Error handling', function () {
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
    });
});
