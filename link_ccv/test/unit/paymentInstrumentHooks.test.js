/* eslint-disable no-unused-expressions */
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const { expect } = require('chai');

const stubs = require('./helpers/mocks/stubs');
const paymentInstrumentHooks = proxyquire('../../cartridges/int_ccv/cartridge/scripts/hooks/paymentInstrumentHooks', {
    'dw/system/Status': stubs.dw.Status,
    'dw/order/OrderMgr': stubs.dw.OrderMgrMock,
    '*/cartridge/scripts/services/CCVPaymentHelpers': stubs.CCVPaymentHelpersMock,
    'dw/system/Logger': stubs.dw.loggerMock,
    '*/cartridge/scripts/authorizeCCV': stubs.authorizeCCVMock,
    'dw/order/Order': stubs.dw.OrderMock
});
const Status = require('./helpers/mocks/dw/system/Status');

describe('paymentInstrumentHooks', function () {
    let order;
    let orderPaymentInstrument;
    let newPaymentInstrument;

    before(() => stubs.init());
    afterEach(() => stubs.reset());
    after(() => stubs.restore());
    beforeEach(() => {
        order = {
            status: { value: stubs.dw.OrderMock.ORDER_STATUS_CREATED },
            custom: {},
            addNote: () => {}
        };
        newPaymentInstrument = {};
        orderPaymentInstrument = {
            custom: {}
        };

        stubs.authorizeCCVMock.authorizeCCV.returns({});
        stubs.authorizeCCVMock.handleAuthorizationResult.returns(new stubs.dw.Status(Status.ERROR));
    });

    context('#authorize', function () {
        it('should return Status', () => {
            const result = paymentInstrumentHooks.authorize(order, orderPaymentInstrument);

            expect(result).to.be.an.instanceof(Status);
            expect(result.status).to.equal(1);
        });

        it('should still return Status.ERROR if authorizeCCV throws', () => {
            stubs.authorizeCCVMock.authorizeCCV.throws(new Error('timeout'));

            const result = paymentInstrumentHooks.authorize(order, orderPaymentInstrument);

            expect(result).to.be.an.instanceof(Status);
            expect(result.status).to.equal(1);
        });
    });

    context('#authorizeCreditCard', function () {
        it('should return Status', () => {
            const result = paymentInstrumentHooks.authorizeCreditCard(order, orderPaymentInstrument);

            expect(result).to.be.an.instanceof(Status);
            expect(result.status).to.equal(1);
        });

        it('should still return Status.ERROR if authorizeCCV throws', () => {
            stubs.authorizeCCVMock.authorizeCCV.throws(new Error('timeout'));

            const result = paymentInstrumentHooks.authorizeCreditCard(order, orderPaymentInstrument);

            expect(result).to.be.an.instanceof(Status);
            expect(result.status).to.equal(1);
        });
    });

    context('#afterPATCH', function () {
        it('should fail the order if there is no ccv reference neither in the order nor in the newPaymentInstrument', () => {
            paymentInstrumentHooks.afterPATCH(order, orderPaymentInstrument, newPaymentInstrument);

            expect(stubs.dw.OrderMgrMock.failOrder).to.have.been.calledOnce;
        });

        it('should fail the order if the payment instrument\'s ccv_transaction_status is "failed" and the order status is not FAILED', () => {
            const testRef = 'ccvTestTransactionRef';
            newPaymentInstrument = { c_ccvTransactionReference: testRef };
            orderPaymentInstrument.paymentTransaction = { custom: { ccv_transaction_status: 'failed' } };

            paymentInstrumentHooks.afterPATCH(order, orderPaymentInstrument, newPaymentInstrument);

            expect(stubs.dw.OrderMgrMock.failOrder).to.have.been.called;
        });

        it('should not fail the order if the payment instrument\'s ccv_transaction_status is "failed" and the order status is already FAILED', () => {
            const testRef = 'ccvTestTransactionRef';

            order.status = { value: stubs.dw.OrderMock.ORDER_STATUS_FAILED };
            newPaymentInstrument = { c_ccvTransactionReference: testRef };
            orderPaymentInstrument.custom.ccv_transaction_status = 'failed';

            paymentInstrumentHooks.afterPATCH(order, orderPaymentInstrument, newPaymentInstrument);

            expect(stubs.dw.OrderMgrMock.failOrder).to.not.have.been.called;
        });
    });
});

