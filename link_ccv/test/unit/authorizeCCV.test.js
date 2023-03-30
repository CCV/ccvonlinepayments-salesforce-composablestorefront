/* eslint-disable new-cap */
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const { expect } = require('chai');

const stubs = require('./helpers/mocks/stubs');

const { authorizeCCV } = proxyquire('../../cartridges/int_ccv/cartridge/scripts/authorizeCCV', {
    'dw/order/Order': stubs.dw.OrderMock,
    'dw/order/OrderMgr': stubs.dw.OrderMgrMock,
    'dw/system/Transaction': stubs.dw.TransactionMock,
    'dw/order/PaymentTransaction': stubs.dw.PaymentTransaction,
    'dw/system/Status': stubs.dw.Status,
    'dw/system/Logger': stubs.dw.loggerMock,
    'dw/order/PaymentMgr': stubs.dw.PaymentMgrMock,
    'dw/system/Site': stubs.dw.Site,
    '~/cartridge/scripts/services/CCVPaymentHelpers': stubs.CCVPaymentHelpers
});

const Status = require('./helpers/mocks/dw/system/Status');
const OrderPaymentInstrument = require('./helpers/mocks/dw/order/OrderPaymentInstrument');

// var { CCV_CONSTANTS, checkCCVTransaction, refundCCVPayment } = require('~/cartridge/scripts/services/CCVPaymentHelpers');

describe('authorizeCCV', function () {
    this.timeout(0); // todo: remove after done

    var order;
    var paymentInstrument;

    before(() => stubs.init());
    afterEach(() => stubs.reset());
    after(() => stubs.restore());

    beforeEach(function () {
        order = new stubs.dw.OrderMock();
        order.custom.ccvTransactionReference = '12356789';
        paymentInstrument = new OrderPaymentInstrument();
        order.paymentInstruments = [paymentInstrument];
    });

    it('should return status.ERROR when transactionReference is missing', () => {
        order.custom.ccvTransactionReference = null;

        var result = authorizeCCV((order, paymentInstrument));
        expect(result).to.be.an.instanceof(Status);
        expect(result.status).to.equal(1);
    });

    it('should fail the order on status=failed', () => {
        order.custom.ccvTransactionReference = 'ccvRefFailed';

        var result = authorizeCCV(order, paymentInstrument);
        expect(result).to.be.an.instanceof(Status);
        expect(result.status).to.equal(1);
        expect(stubs.dw.OrderMgrMock.failOrder).to.have.been.calledOnceWith(order);
    });
    it('should fail the order on status=failed', () => {
        order.custom.ccvTransactionReference = 'ccvRefFailed';

        var result = authorizeCCV(order, paymentInstrument);
        expect(result).to.be.an.instanceof(Status);
        expect(result.status).to.equal(1);
        expect(stubs.dw.OrderMgrMock.failOrder).to.have.been.calledOnceWith(order);
    });
});

