/* eslint-disable no-unused-expressions */
/* eslint-disable new-cap */
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const { expect } = require('chai');

const stubs = require('./helpers/mocks/stubs');

const { Start, Refund, Cancel } = proxyquire('../../cartridges/bm_ccv/cartridge/controllers/CSCOrderPaymentRefund', {
    'dw/template/ISML': stubs.dw.ISMLMock,
    'dw/order/Order': stubs.dw.OrderMock,
    'dw/order/OrderMgr': stubs.dw.OrderMgrMock,
    'dw/order/PaymentTransaction': stubs.dw.PaymentTransaction,
    'dw/system/Transaction': stubs.dw.TransactionMock,
    'dw/system/Status': stubs.dw.Status,
    'dw/system/Logger': stubs.dw.loggerMock,
    '*/cartridge/scripts/services/CCVPaymentHelpers': stubs.CCVPaymentHelpersMock,
    '*/cartridge/scripts/helpers/CCVOrderHelpers': stubs.CCVOrderHelpersMock,
    'dw/value/Money': stubs.dw.Money
});
const Order = require('./helpers/mocks/dw/order/Order');

describe('CSCOrderPaymentRefund', function () {
    let order;
    let paymentInstrument;

    before(() => stubs.init());
    afterEach(() => stubs.reset());
    after(() => stubs.restore());

    beforeEach(() => {
        order = new stubs.dw.OrderMock();
        order.currencyCode = 'EUR';
        order.totalGrossPrice = { value: 50.00 };
        order.status = { value: Order.ORDER_STATUS_NEW };

        global.request = {
            httpParameterMap: {
                get: (prop) => {
                    switch (prop) {
                        case 'refundAmount':
                            return { stringValue: '34.12', doubleValue: 34.12 };
                        case 'reversal':
                            return { stringValue: 'true' };
                        default:
                            return {};
                    }
                }
            }
        };
        paymentInstrument = new stubs.dw.OrderPaymentInstrumentMock();
        order.custom.ccvTransactionReference = 'testTransactionRef';
        order.paymentInstruments = [paymentInstrument];
        paymentInstrument.paymentTransaction = new stubs.dw.PaymentTransactionMock();
        paymentInstrument.paymentTransaction.amount = new stubs.dw.MoneyMock();
        order.paymentTransaction = { type: { value: 'AUTH' } };

        stubs.dw.OrderMgrMock.getOrder.returns(order);
    });
    context('Start', function () {
        it('should render "order_payment_cancel" if the order status is CREATED', () => {
            order.status = { value: Order.ORDER_STATUS_CREATED };

            Start();
            expect(stubs.dw.ISMLMock.renderTemplate).calledWith('order/payment/refund/order_payment_cancel');
        });
        it('should render "order_payment_refund_not_available" if the order status is CANCELLED', () => {
            order.status = { value: Order.ORDER_STATUS_CANCELLED };

            Start();
            expect(stubs.dw.ISMLMock.renderTemplate).calledWith('order/payment/refund/order_payment_refund_not_available.isml');
        });
        it('should render "order_payment_refund_not_available" if the order status is FAILED', () => {
            order.status = { value: Order.ORDER_STATUS_FAILED };

            Start();
            expect(stubs.dw.ISMLMock.renderTemplate).calledWith('order/payment/refund/order_payment_refund_not_available.isml');
        });
        it('should render "order_payment_refund_not_available" if ccvTransactionReference is missing', () => {
            order.custom.ccvTransactionReference = null;
            Start();
            expect(stubs.dw.ISMLMock.renderTemplate).calledWith('order/payment/refund/order_payment_refund_not_available.isml');
        });
        it('should render "order_payment_refund" if the order status is NEW', () => {
            order.status = { value: Order.ORDER_STATUS_NEW };
            stubs.CCVOrderHelpersMock.getRefundAmountRemaining.returns({});

            Start();
            expect(stubs.dw.ISMLMock.renderTemplate).calledWith('order/payment/refund/order_payment_refund.isml');
        });
    });
    context('Refund', function () {
        it('should return return { success:true } if the refund request succeeds', () => {
            const refundAmountRemaining = new stubs.dw.Money(50, 'EUR');
            stubs.CCVPaymentHelpersMock.refundCCVPayment.returns([]);
            stubs.CCVOrderHelpersMock.getRefundAmountRemaining.returns(refundAmountRemaining);

            Refund();
            expect(stubs.dw.ISMLMock.renderTemplate.firstCall.args[1].success).to.be.true;
            expect(stubs.dw.ISMLMock.renderTemplate.firstCall.args[1].order).to.eql(order);
            expect(stubs.dw.ISMLMock.renderTemplate.firstCall.args[1].refundAmountRemaining).to.eql(refundAmountRemaining);
        });

        it('should return return { success:false, errorMsg } if the refund request fails', () => {
            const refundAmountRemaining = new stubs.dw.Money(50, 'EUR');
            const errorMsg = 'Test error';
            stubs.CCVPaymentHelpersMock.refundCCVPayment.throws(new Error(errorMsg));
            stubs.CCVOrderHelpersMock.getRefundAmountRemaining.returns(refundAmountRemaining);

            Refund();
            expect(stubs.dw.ISMLMock.renderTemplate.firstCall.args[1].success).to.be.false;
            expect(stubs.dw.ISMLMock.renderTemplate.firstCall.args[1].errorMessage).to.eql(errorMsg);
        });

        it('should return return { success:false } if the refund request is bigger than the maximum refundable amount', () => {
            const refundAmountRemaining = new stubs.dw.Money(15, 'EUR');
            stubs.CCVPaymentHelpersMock.refundCCVPayment.returns([]);
            stubs.CCVOrderHelpersMock.getRefundAmountRemaining.returns(refundAmountRemaining);

            Refund();
            expect(stubs.CCVPaymentHelpersMock.refundCCVPayment).not.to.have.been.called;
            expect(stubs.dw.ISMLMock.renderTemplate.firstCall.args[1].success).to.be.false;
            expect(stubs.dw.ISMLMock.renderTemplate.firstCall.args[1].errorMessage).to.eql('Refund amount exceeds order total amount!');
        });
        it('should not include an amount in the reversal request if the type is "reversal"', () => {
            const refundAmountRemaining = new stubs.dw.Money(50, 'EUR');
            stubs.CCVPaymentHelpersMock.refundCCVPayment.returns([]);
            stubs.CCVOrderHelpersMock.getRefundAmountRemaining.returns(refundAmountRemaining);

            Refund();
            expect(stubs.CCVPaymentHelpersMock.refundCCVPayment.firstCall.args[0].amount).to.be.null;
        });
        it('should include an amount in the refund request if the type is "refund"', () => {
            const refundAmount = '34.51';

            global.request = {
                httpParameterMap: {
                    get: (prop) => {
                        switch (prop) {
                            case 'refundAmount':
                                return { stringValue: '' + refundAmount, doubleValue: refundAmount };
                            case 'reversal':
                                return { stringValue: null };
                            default:
                                return {};
                        }
                    }
                }
            };
            const refundAmountRemaining = new stubs.dw.Money(50, 'EUR');
            stubs.CCVPaymentHelpersMock.refundCCVPayment.returns([]);
            stubs.CCVOrderHelpersMock.getRefundAmountRemaining.returns(refundAmountRemaining);

            Refund();
            expect(stubs.CCVPaymentHelpersMock.refundCCVPayment.firstCall.args[0].amount).to.eql(refundAmount);
        });
    });
    context('Cancel', function () {
        it('should return return { success:true } if the cancel request succeeds', () => {
            stubs.CCVPaymentHelpersMock.cancelCCVPayment.returns({});

            Cancel();
            expect(stubs.dw.ISMLMock.renderTemplate.firstCall.args[1].success).to.be.true;
        });
        it('should return return { success:false } if the cancel request succeeds', () => {
            stubs.CCVPaymentHelpersMock.cancelCCVPayment.throws({});

            Cancel();
            expect(stubs.dw.ISMLMock.renderTemplate.firstCall.args[1].success).to.be.false;
        });
    });
});
