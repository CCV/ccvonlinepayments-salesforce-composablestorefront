/* eslint-disable no-unused-expressions */
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const { expect } = require('chai');
const stubs = require('./helpers/mocks/stubs');

const { execute } = proxyquire('../../cartridges/int_ccv/cartridge/scripts/jobs/processRefunds', {
    'dw/system/Status': stubs.dw.Status,
    'dw/order/OrderMgr': stubs.dw.OrderMgrMock,
    '*/cartridge/scripts/services/CCVPaymentHelpers': stubs.CCVPaymentHelpersMock,
    'dw/system/Logger': stubs.dw.loggerMock,
    'dw/system/Transaction': stubs.dw.TransactionMock,
    '*/cartridge/scripts/helpers/CCVOrderHelpers': stubs.CCVOrderHelpers
});

const { CCV_CONSTANTS } = stubs.CCVPaymentHelpersMock;
const { SUCCESS, FAILED, PENDING, MANUAL_INTERVENTION } = CCV_CONSTANTS.STATUS;

describe('processRefunds', function () {
    let orders;

    before(() => stubs.init());
    afterEach(() => {
        stubs.reset();
    });
    after(() => stubs.restore());

    beforeEach(() => {
        stubs.dw.OrderMgrMock.processOrders.callsFake(function (cb) {
            orders
                .filter(order => order.custom.ccvHasPendingRefunds === true)
                .forEach(cb);
        });
    });

    context('#checkRefundStatus', function () {
        let refunds;
        let order;

        beforeEach(() => {
            orders = [
                {
                    custom: {
                        ccvTransactionReference: '12345'
                    }
                },
                {
                    custom: {
                        ccvHasPendingRefunds: true,
                        ccvTransactionReference: '12345',
                        ccvRefunds: `
                        [
                            {"reference":"P230330204252715CB8E557E.A","amount":28.02,"status":"pending","currency":"eur","date":1680201772720,"type":"refund"},
                            {"reference":"P230330204252715CB8E557E.B","amount":28.02,"status":"pending","currency":"eur","date":1680201772720,"type":"refund"},
                            {"reference":"P230330204252715CB8E557E.C","amount":28.02,"status":"pending","currency":"eur","date":1680201772720,"type":"refund"},
                            {"reference":"P230330204252715CB8E557E.D","amount":28.02,"status":"pending","currency":"eur","date":1680201772720,"type":"refund"}
                        ]`
                    }
                }
            ];
            order = orders[1];
        });

        it('should update refunds with correct status', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransactions.returns({
                toArray: () => [
                    { reference: 'P230330204252715CB8E557E.B', status: 'success' },
                    { reference: 'P230330204252715CB8E557E.C', status: 'pending' },
                    { reference: 'P230330204252715CB8E557E.D', status: 'manualintervention' },
                    { reference: 'P230330204252715CB8E557E.A', status: 'failed' }
                ]
            });
            execute();

            refunds = JSON.parse(order.custom.ccvRefunds);
            expect(refunds[0].status).to.equal(FAILED);
            expect(refunds[1].status).to.equal(SUCCESS);
            expect(refunds[2].status).to.equal(PENDING);
            expect(refunds[3].status).to.equal(MANUAL_INTERVENTION);
        });

        it('should not update refund status if the service returns an error', () => {
            stubs.CCVPaymentHelpersMock.checkCCVTransactions.throws(new Error('test error'));
            const initialRefunds = order.custom.ccvRefunds;
            execute();
            expect(initialRefunds).to.eql(order.custom.ccvRefunds);
            expect(order.custom.ccvHasPendingRefunds).to.be.true;
        });

        it('should add failure_code to the refund object if present in service response', () => {
            const failureReason = 'failure_reason';
            stubs.CCVPaymentHelpersMock.checkCCVTransactions.returns({
                toArray: () => [
                    { reference: 'P230330204252715CB8E557E.B', status: 'success' },
                    { reference: 'P230330204252715CB8E557E.C', status: 'success' },
                    { reference: 'P230330204252715CB8E557E.A', status: 'failed', failureCode: failureReason },
                    { reference: 'P230330204252715CB8E557E.D', status: 'success' }
                ]
            });
            execute();
            refunds = JSON.parse(order.custom.ccvRefunds);

            expect(refunds[0].failureCode).to.equal(failureReason);
            expect(refunds[1].failureCode).to.be.undefined;
            expect(refunds[2].failureCode).to.be.undefined;
            expect(refunds[3].failureCode).to.be.undefined;
        });

        it('should set ccvHasPendingRefunds to false if no refunds are found in the order (null)', () => {
            order.custom.ccvRefunds = undefined;

            stubs.CCVPaymentHelpersMock.checkCCVTransactions.throws(new Error('test error'));
            execute();

            expect(order.custom.ccvHasPendingRefunds).to.be.false;
            expect(stubs.CCVPaymentHelpersMock.checkCCVTransactions).not.to.have.been.called;
        });

        it('should set ccvHasPendingRefunds to false if no refunds are found in the order (empty array)', () => {
            order.custom.ccvRefunds = '[]';

            stubs.CCVPaymentHelpersMock.checkCCVTransactions.throws(new Error('test error'));
            execute();

            expect(order.custom.ccvHasPendingRefunds).to.be.false;
            expect(stubs.CCVPaymentHelpersMock.checkCCVTransactions).not.to.have.been.called;
        });
    });
});
