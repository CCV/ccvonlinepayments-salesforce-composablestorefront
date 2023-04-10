/* eslint-disable no-unused-expressions */
const { expect } = require('chai');
const stubs = require('./helpers/mocks/stubs');

const {
    getRefundAmountRemaining,
    updateOrderRefunds
} = stubs.CCVOrderHelpers;

const Money = require('./helpers/mocks/dw/value/Money');
const { CCV_CONSTANTS } = stubs.CCVPaymentHelpersMock;
const { SUCCESS, FAILED, PENDING, MANUAL_INTERVENTION } = CCV_CONSTANTS.STATUS;

describe('CCVOrderHelpers', function () {
    this.timeout(0); // todo: remove after done

    let order;

    before(() => stubs.init());
    afterEach(() => {
        stubs.reset();
    });
    after(() => stubs.restore());

    beforeEach(() => {
        order = {
            paymentInstruments: [{
                paymentTransaction: { type: { value: 'AUTH' } }
            }],
            custom: {
                ccvTransactionReference: '12345',
                ccvRefunds: `[
                    {"reference":"P230410143730929CB8A4868.9","amount":10,"status":"pending","currency":"eur","date":1681130250931,"type":"refund"},
                    {"reference":"P230410143740426CB8A4B97.9","amount":11,"status":"pending","currency":"eur","date":1681130260428,"type":"refund"},
                    {"reference":"P230410143846026CB8A5C6E.A","amount":8,"status":"pending","currency":"eur","date":1681130326030,"type":"refund"},
                    {"reference":"P230410143846026CB8A5C6E.D","amount":8,"status":"pending","currency":"eur","date":1681130326030,"type":"refund"}
                ]`,
                ccvHasPendingRefunds: true,
                ccvManualInterventionRefund: null
            },
            addNote: () => null,
            currencyCode: 'EUR',
            totalGrossPrice: new Money(45, 'EUR')
        };

        stubs.dw.LocalServiceRegistryMock.createService.returns({ call(params) {
            return {
                isOk: () => true,
                object: {
                    reference: 'R.123',
                    amount: params.requestBody.amount || order.totalGrossPrice.value,
                    status: 'pending',
                    currency: 'eur',
                    failureCode: null,
                    date: '1680776577052'
                }
            };
        } });
    });

    context('#getRefundAmountRemaining:', function () {
        it('should return the full order value if there are no prior refunds', () => {
            order.custom.ccvRefunds = null;
            const remainingRefund = getRefundAmountRemaining(order);
            expect(remainingRefund.value).to.equal(order.totalGrossPrice.value);
        });
        it('should return an instance of Money', () => {
            const remainingRefund = getRefundAmountRemaining(order);
            expect(remainingRefund).to.be.an.instanceof(Money);
        });
        it('should return the same currency as the order', () => {
            const remainingRefund = getRefundAmountRemaining(order);
            expect(remainingRefund.currencyCode).to.equal(order.currencyCode);
        });
        it('should return the correct amount if there are pending refunds', () => {
            order.custom.ccvRefunds = '[{ "amount": 10, "status": "pending" }]';
            const remainingRefund1 = getRefundAmountRemaining(order);
            expect(remainingRefund1.value).to.equal(order.totalGrossPrice.value - 10);

            order.custom.ccvRefunds = '[{ "amount": 10, "status": "pending"}, {"amount": 15.15, "status": "pending" }]';
            const remainingRefund2 = getRefundAmountRemaining(order);
            expect(remainingRefund2.value).to.equal(order.totalGrossPrice.value - 25.15);
        });
        it('should not add failed refunds to the calculation', () => {
            order.custom.ccvRefunds = '[{ "amount": 10, "status": "pending"}, {"amount": 15.15, "status": "failed" }]';
            const remainingRefund2 = getRefundAmountRemaining(order);
            expect(remainingRefund2.value).to.equal(order.totalGrossPrice.value - 10);
        });
    });

    context('#updateOrderRefunds:', function () {
        it('should update the order refunds', () => {
            const newRefunds = [
                { reference: 'P230410143730929CB8A4868.9', amount: 10, status: 'success', currency: 'eur', date: 1681130250931, type: 'refund' },
                { reference: 'P230410143740426CB8A4B97.9', amount: 11, status: 'failed', currency: 'eur', date: 1681130260428, type: 'refund' },
                { reference: 'P230410143846026CB8A5C6E.A', amount: 8, status: 'pending', currency: 'eur', date: 1681130326030, type: 'refund' },
                { reference: 'P230410143846026CB8A5C6E.D', amount: 8, status: 'manualintervention', currency: 'eur', date: 1681130326030, type: 'refund' }
            ];
            updateOrderRefunds(order, newRefunds);

            const parsedRefunds = JSON.parse(order.custom.ccvRefunds);

            expect(parsedRefunds[0].status).to.eql(SUCCESS);
            expect(parsedRefunds[1].status).to.eql(FAILED);
            expect(parsedRefunds[2].status).to.eql(PENDING);
            expect(parsedRefunds[3].status).to.eql(MANUAL_INTERVENTION);
        });

        it('should set ccvHasPendingRefunds to false if no refunds are still pending', () => {
            const newRefunds = [
                { reference: 'P230410143730929CB8A4868.9', amount: 10, status: 'success', currency: 'eur', date: 1681130250931, type: 'refund' },
                { reference: 'P230410143740426CB8A4B97.9', amount: 11, status: 'failed', currency: 'eur', date: 1681130260428, type: 'refund' },
                { reference: 'P230410143846026CB8A5C6E.A', amount: 8, status: 'success', currency: 'eur', date: 1681130326030, type: 'refund' },
                { reference: 'P230410143846026CB8A5C6E.D', amount: 8, status: 'manualintervention', currency: 'eur', date: 1681130326030, type: 'refund' }
            ];

            updateOrderRefunds(order, newRefunds);
            expect(order.custom.ccvHasPendingRefunds).to.be.false;
        });

        it('should set ccvHasPendingRefunds to true if some refunds are still pending', () => {
            const newRefunds = [
                { reference: 'P230410143730929CB8A4868.9', amount: 10, status: 'success', currency: 'eur', date: 1681130250931, type: 'refund' },
                { reference: 'P230410143740426CB8A4B97.9', amount: 11, status: 'pending', currency: 'eur', date: 1681130260428, type: 'refund' },
                { reference: 'P230410143846026CB8A5C6E.A', amount: 8, status: 'success', currency: 'eur', date: 1681130326030, type: 'refund' },
                { reference: 'P230410143846026CB8A5C6E.D', amount: 8, status: 'failed', currency: 'eur', date: 1681130326030, type: 'refund' }
            ];

            updateOrderRefunds(order, newRefunds);
            expect(order.custom.ccvHasPendingRefunds).to.be.true;
        });

        it('should work for a single refund', () => {
            order.custom.ccvRefunds = JSON.stringify(JSON.parse(order.custom.ccvRefunds)[0]);
            let newRefunds = [
                { reference: 'P230410143730929CB8A4868.9', amount: 10, status: 'pending', currency: 'eur', date: 1681130250931, type: 'refund' }
            ];

            updateOrderRefunds(order, newRefunds);
            expect(order.custom.ccvHasPendingRefunds).to.be.true;

            newRefunds = [
                { reference: 'P230410143730929CB8A4868.9', amount: 10, status: 'success', currency: 'eur', date: 1681130250931, type: 'refund' }
            ];

            updateOrderRefunds(order, newRefunds);
            expect(order.custom.ccvHasPendingRefunds).to.be.false;
        });

        it('should set manualintervention to true if some refund requires manual intervention', () => {
            const newRefunds = [
                { reference: 'P230410143730929CB8A4868.9', amount: 10, status: 'success', currency: 'eur', date: 1681130250931, type: 'refund' },
                { reference: 'P230410143740426CB8A4B97.9', amount: 11, status: 'success', currency: 'eur', date: 1681130260428, type: 'refund' },
                { reference: 'P230410143846026CB8A5C6E.A', amount: 8, status: 'success', currency: 'eur', date: 1681130326030, type: 'refund' },
                { reference: 'P230410143846026CB8A5C6E.D', amount: 8, status: 'manualintervention', currency: 'eur', date: 1681130326030, type: 'refund' }
            ];

            updateOrderRefunds(order, newRefunds);
            expect(order.custom.ccvHasPendingRefunds).to.be.false;
            expect(order.custom.ccvManualInterventionRefund).to.be.true;
        });
    });
});

