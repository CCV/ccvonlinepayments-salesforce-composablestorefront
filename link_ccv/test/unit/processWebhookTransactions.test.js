/* eslint-disable no-unused-expressions */
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const { expect } = require('chai');
const stubs = require('./helpers/mocks/stubs');

const { execute } = proxyquire('../../cartridges/int_ccv/cartridge/scripts/jobs/processWebhookTransactions', {
    'dw/system/Status': stubs.dw.Status,
    'dw/system/Transaction': stubs.dw.TransactionMock,
    'dw/order/OrderMgr': stubs.dw.OrderMgrMock,
    'dw/system/Logger': stubs.dw.loggerMock,
    '*/cartridge/scripts/helpers/ccvWebhookTransactions': stubs.ccvWebhookTransactionsMock,
    '*/cartridge/scripts/helpers/CCVOrderHelpers': stubs.CCVOrderHelpersMock,
    '*/cartridge/scripts/services/CCVPaymentHelpers': stubs.CCVPaymentHelpersMock
});

/**
 * Builds the SeekableIterator queryCustomObjects returns.
 * @param {Array} items items to iterate
 * @returns {Object} iterator
 */
function iteratorOf(items) {
    let index = 0;
    return {
        hasNext: () => index < items.length,
        next: () => items[index++],
        close: stubs.sandbox.stub()
    };
}

describe('processWebhookTransactions', function () {
    let enrichment;
    let order;

    before(() => stubs.init());
    afterEach(() => stubs.reset());
    after(() => stubs.restore());

    beforeEach(() => {
        enrichment = {
            custom: { orderNo: '00001234', transactionReference: 'testTransactionRef', attempts: 0 }
        };

        order = new stubs.dw.OrderMock();
        order.orderNo = '00001234';

        stubs.ccvWebhookTransactionsMock.getPending.returns(iteratorOf([enrichment]));
        stubs.dw.OrderMgrMock.getOrder.returns(order);
        stubs.CCVPaymentHelpersMock.checkCCVTransaction.returns({ consumer: { emailAddress: 'a@b.com' } });
        stubs.CCVOrderHelpersMock.addAddressDetails.returns(true);
    });

    it('should apply the consumer details and remove the record', () => {
        const result = execute();

        expect(stubs.CCVOrderHelpersMock.addAddressDetails).to.have.been.calledOnce;
        expect(stubs.ccvWebhookTransactionsMock.remove).to.have.been.calledOnceWith(enrichment);
        expect(result.status).to.eql(stubs.dw.Status.OK);
    });

    it('should read the CCV transaction outside of the order transaction', () => {
        execute();

        expect(stubs.CCVPaymentHelpersMock.checkCCVTransaction)
            .to.have.been.calledBefore(stubs.dw.TransactionMock.wrap);
    });

    it('should keep the record queued when CCV still has no consumer data', () => {
        stubs.CCVOrderHelpersMock.addAddressDetails.returns(false);

        execute();

        expect(stubs.ccvWebhookTransactionsMock.remove).to.not.have.been.called;
        expect(enrichment.custom.attempts).to.eql(1);
    });

    it('should keep the record queued when the CCV service call fails', () => {
        stubs.CCVPaymentHelpersMock.checkCCVTransaction.throws(new Error('timeout'));

        execute();

        expect(stubs.CCVOrderHelpersMock.addAddressDetails).to.not.have.been.called;
        expect(stubs.ccvWebhookTransactionsMock.remove).to.not.have.been.called;
        expect(enrichment.custom.attempts).to.eql(1);
    });

    it('should give up once the maximum number of attempts is reached', () => {
        enrichment.custom.attempts = stubs.ccvWebhookTransactionsMock.MAX_ATTEMPTS - 1;
        stubs.CCVOrderHelpersMock.addAddressDetails.returns(false);

        execute();

        expect(stubs.ccvWebhookTransactionsMock.remove).to.have.been.calledOnceWith(enrichment);
    });

    it('should not call CCV when the order cannot be found', () => {
        stubs.dw.OrderMgrMock.getOrder.returns(null);

        execute();

        expect(stubs.CCVPaymentHelpersMock.checkCCVTransaction).to.not.have.been.called;
        expect(enrichment.custom.attempts).to.eql(1);
    });

    it('should close the query iterator', () => {
        const iterator = iteratorOf([enrichment]);
        stubs.ccvWebhookTransactionsMock.getPending.returns(iterator);

        execute();

        expect(iterator.close).to.have.been.calledOnce;
    });
});
