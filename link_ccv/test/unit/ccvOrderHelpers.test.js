/* eslint-disable no-unused-expressions */
const { expect } = require('chai');
const stubs = require('./helpers/mocks/stubs');

const {
    getRefundAmountRemaining,
    updateOrderRefunds,
    getSCAFields,
    getKlarnaOrderLines
} = stubs.CCVOrderHelpers;

const Money = require('./helpers/mocks/dw/value/Money');
const { CCV_CONSTANTS } = stubs.CCVPaymentHelpersMock;
const { SUCCESS, FAILED, PENDING, MANUAL_INTERVENTION } = CCV_CONSTANTS.STATUS;

describe('CCVOrderHelpers', function () {
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
            totalGrossPrice: new Money(45, 'EUR'),
            customerEmail: 'tester_email@test.com',

            billingAddress: {
                address1: 'Test Address 1',
                city: 'CityTest',
                stateCode: '',
                postalCode: '1245',
                countryCode: { value: 'BE' },
                address2: '',
                phone: '1234-1234-522',
                custom: { phone_country: '024' }
            },
            shipments: [{
                shippingAddress: {
                    address1: 'Shipping Test Address 1',
                    city: 'Shipping CityTest',
                    stateCode: '',
                    postalCode: '3333',
                    countryCode: { value: 'NL' },
                    address2: '',
                    phone: '1234-313131',
                    custom: { phone_country: '024' }
                }
            }]
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

    context('#getSCAFields:', function () {
        it('return all billing and shipping fields', () => {
            const fields = getSCAFields(order);

            const billingAddress = order.billingAddress;
            const shippingAddress = order.shipments[0].shippingAddress;
            expect(fields.billingAddress).to.eql(billingAddress.address1);
            expect(fields.billingCity).to.eql(billingAddress.city);
            expect(fields.billingState).to.eql(billingAddress.stateCode);
            expect(fields.billingPostalCode).to.eql(billingAddress.postalCode);
            expect(fields.billingCountry).to.eql(billingAddress.countryCode.value);
            expect(fields.billingHouseExtension).to.eql(billingAddress.address2 || '');
            expect(fields.billingPhoneNumber).to.eql(billingAddress.phone.replace(/\D/g, ''));
            expect(fields.billingPhoneCountry).to.eql(billingAddress.custom.phone_country);
            expect(fields.billingEmail).to.eql(order.customerEmail);
            expect(fields.shippingAddress).to.eql(shippingAddress.address1);
            expect(fields.shippingCity).to.eql(shippingAddress.city);
            expect(fields.shippingState).to.eql(shippingAddress.stateCode);
            expect(fields.shippingPostalCode).to.eql(shippingAddress.postalCode);
            expect(fields.shippingCountry).to.eql(shippingAddress.countryCode.value);
            expect(fields.shippingPhoneCountry).to.eql(shippingAddress.custom.phone_country);
            expect(fields.shippingPhoneNumber).to.eql(shippingAddress.phone.replace(/\D/g, ''));
            expect(fields.shippingHouseExtension).to.eql(shippingAddress.address2 || '');
            expect(fields.shippingEmail).to.eql(order.customerEmail);
        });

        it('should set scaReady to "yes" if ccvScaReadyEnabled site preference is enabled', () => {
            stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvScaReadyEnabled').returns(true);

            const fields = getSCAFields(order);
            expect(fields.scaReady).to.eql('yes');
        });
        it('should set scaReady to "no" if ccvScaReadyEnabled site preference is enabled', () => {
            stubs.dw.SiteMock.current.getCustomPreferenceValue.withArgs('ccvScaReadyEnabled').returns(false);

            const fields = getSCAFields(order);
            expect(fields.scaReady).to.eql('no');
        });
        it('should set phone_country to "00" if it is not provided in the order', () => {
            order.billingAddress.custom.phone_country = null;
            order.shipments[0].shippingAddress.custom.phone_country = null;
            const fields = getSCAFields(order);
            expect(fields.billingPhoneCountry).to.eql('00');
            expect(fields.shippingPhoneCountry).to.eql('00');
        });
    });

    context('#getKlarnaOrderLines:', function () {
        it('should return order line objects', () => {
            order.adjustedMerchandizeTotalGrossPrice = new Money(78.17, 'EUR');
            const item1 = Object.assign(new stubs.dw.ProductLineItem(), {
                lineItemText: 'Checked Silk Tie',
                productID: '682875540326M',
                quantity: {
                    value: 2,
                    unit: 'piece'
                },
                basePrice: new Money(21.59, 'EUR'),
                adjustedGrossPrice: new Money(37.49, 'EUR'),
                taxRate: 0.13,
                tax: new Money(5.61, 'EUR')
            });
            const item2 = Object.assign(new stubs.dw.ProductLineItem(), {
                lineItemText: 'Light Hematite Button Clip-on Earrings',
                productID: '013742335484M',
                quantity: {
                    value: 1,
                    unit: 'piece'
                },
                basePrice: new Money(12.96, 'EUR'),
                adjustedGrossPrice: new Money(14.64, 'EUR'),
                taxRate: 0.13,
                tax: new Money(1.68, 'EUR')
            });
            const item3 = Object.assign(new stubs.dw.ShippingLineItem(), {
                // ShippingLineItem
                lineItemText: 'STANDARD_SHIPPING',
                adjustedGrossPrice: new Money(6.77, 'EUR'),
                taxRate: 0.13,
                tax: new Money(3.74, 'EUR')
            });
            const item4 = Object.assign(new stubs.dw.ProductShippingLineItem(), {
                // ProductShippingLineItem
                lineItemText: 'Item Shipping Cost (Surcharge)',
                adjustedGrossPrice: new Money(11.3, 'EUR'),
                taxRate: 0.13,
                tax: new Money(1.3, 'EUR')
            });
            const item5 = Object.assign(new stubs.dw.PriceAdjustment(), {
                // PriceAdjustment
                lineItemText: '5 Off Ties Promotion',
                adjustedGrossPrice: new Money(-10.00, 'EUR'),
                grossPrice: new Money(-10.00, 'EUR'),
                priceValue: -10,
                quantity: 1
            });
            order.allLineItems = [item1, item2, item3, item4, item5];

            const orderLines = getKlarnaOrderLines(order);
            expect(orderLines.length).to.eql(5);
            expect(orderLines[0].type).to.eql('PHYSICAL');
            expect(orderLines[0].name).to.eql(item1.lineItemText);
            expect(orderLines[0].code).to.eql(item1.productID);
            expect(orderLines[0].quantity).to.eql(item1.quantity.value);
            expect(orderLines[0].unit).to.eql(item1.quantity.unit);

            expect(orderLines[1].type).to.eql('PHYSICAL');

            expect(orderLines[2].type).to.eql('SHIPPING_FEE');
            expect(orderLines[2].name).to.eql(item3.lineItemText);
            expect(orderLines[2].quantity).to.eql(1);
            expect(orderLines[2].vatRate).to.eql(item3.taxRate * 100);
            expect(orderLines[2].vat).to.eql(item3.tax.value);
            expect(orderLines[2].totalPrice).to.eql(item3.adjustedGrossPrice.value);
            expect(orderLines[2].unitPrice).to.eql(item3.adjustedGrossPrice.value);

            expect(orderLines[3].type).to.eql('SHIPPING_FEE');
            expect(orderLines[3].name).to.eql(item4.lineItemText);
            expect(orderLines[3].quantity).to.eql(1);
            expect(orderLines[3].vatRate).to.eql(item4.taxRate * 100);
            expect(orderLines[3].vat).to.eql(item4.tax.value);
            expect(orderLines[3].totalPrice).to.eql(item4.adjustedGrossPrice.value);
            expect(orderLines[3].unitPrice).to.eql(item4.adjustedGrossPrice.value);

            expect(orderLines[4].type).to.eql('DISCOUNT');
            expect(orderLines[4].name).to.eql(item5.lineItemText);
            expect(orderLines[4].quantity).to.eql(item5.quantity);
            expect(orderLines[4].totalPrice).to.eql(item5.adjustedGrossPrice.value);
            expect(orderLines[4].unitPrice).to.eql(item5.adjustedGrossPrice.value);
        });

        it('should set SURCHARGE type on price adjustments with price > 0', () => {
            order.adjustedMerchandizeTotalGrossPrice = new Money(78.17, 'EUR');

            const item1 = Object.assign(new stubs.dw.PriceAdjustment(), {
                // PriceAdjustment
                lineItemText: '10 Ties Surcharge',
                adjustedGrossPrice: new Money(10.00, 'EUR'),
                grossPrice: new Money(10.00, 'EUR'),
                priceValue: 10,
                quantity: 1
            });
            order.allLineItems = [item1];

            const orderLines = getKlarnaOrderLines(order);

            expect(orderLines[0].type).to.eql('SURCHARGE');
        });

        it('should set unit as "pc" if quantity.unit is undefined', () => {
            order.adjustedMerchandizeTotalGrossPrice = new Money(78.17, 'EUR');

            const item1 = Object.assign(new stubs.dw.ProductLineItem(), {
                lineItemText: 'Checked Silk Tie',
                productID: '682875540326M',
                quantity: {
                    value: 2
                },
                basePrice: new Money(21.59, 'EUR'),
                adjustedGrossPrice: new Money(37.49, 'EUR'),
                taxRate: 0.13,
                tax: new Money(5.61, 'EUR')
            });
            order.allLineItems = [item1];

            const orderLines = getKlarnaOrderLines(order);

            expect(orderLines[0].unit).to.eql('pc');
        });
    });
});

