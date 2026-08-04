/* eslint-disable no-unused-expressions */
const { expect } = require('chai');
const stubs = require('./helpers/mocks/stubs');

const ccvWebhookTransactions = stubs.ccvWebhookTransactions;

describe('ccvWebhookTransactions.js', function () {
    let order;

    before(() => stubs.init());
    afterEach(() => stubs.reset());
    after(() => stubs.restore());

    beforeEach(() => {
        order = {
            orderNo: '00001234',
            custom: { ccvTransactionReference: 'testTransactionRef' }
        };
    });

    it('should create a record for an order that is not queued yet', () => {
        const created = { custom: {} };
        stubs.dw.CustomObjectMgrMock.getCustomObject.returns(null);
        stubs.dw.CustomObjectMgrMock.createCustomObject.returns(created);

        ccvWebhookTransactions.enqueue(order);

        expect(stubs.dw.CustomObjectMgrMock.createCustomObject)
            .to.have.been.calledOnceWith('CCVWebhookTransactions', '00001234');
        expect(created.custom.transactionReference).to.eql('testTransactionRef');
    });

    it('should reuse the existing record instead of creating a second one', () => {
        stubs.dw.CustomObjectMgrMock.getCustomObject.returns({ custom: {} });

        ccvWebhookTransactions.enqueue(order);

        expect(stubs.dw.CustomObjectMgrMock.createCustomObject).to.not.have.been.called;
    });
});
