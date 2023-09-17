import ccvConfig from '../../../../ccvConfig'

export const createApplePayRequest = (basket, formatMessage, locale) => {
    // Product line items
    const lineItems = basket.productItems.map((item) => {
        return {
            label: item.itemText,
            type: 'final',
            amount: item.priceAfterItemDiscount
        }
    })

    // order discounts
    if (basket.orderPriceAdjustments) {
        basket.orderPriceAdjustments.forEach((priceAdjustment) => {
            lineItems.push({
                label: priceAdjustment.itemText,
                type: 'final',
                amount: priceAdjustment.price
            })
        })
    }

    // Shipping
    lineItems.push({
        label: formatMessage({
            defaultMessage: 'Shipping',
            id: 'order_summary.label.shipping'
        }),
        type: 'final',
        amount: basket.shippingTotal
    })

    // Tax
    if (basket.taxation === 'net') {
        lineItems.push({
            label: formatMessage({
                defaultMessage: 'Tax.',
                id: 'order_summary.label.tax'
            }),
            type: 'final',
            amount: basket.taxTotal
        })
    }

    const total = {
        label: ccvConfig.applePayMerchantLabel,
        type: 'final',
        amount: basket?.orderTotal
    }

    const request = {
        countryCode: locale.split('-')[1],
        currencyCode: basket?.currency,
        merchantCapabilities: ['supports3DS'],
        supportedNetworks: ccvConfig.applePaySupportedNetworks,
        total,
        lineItems
    }

    return request
}
