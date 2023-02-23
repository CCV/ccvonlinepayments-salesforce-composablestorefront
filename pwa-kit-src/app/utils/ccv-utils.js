import React, {useMemo} from 'react'
import PropTypes from 'prop-types'
import {useCheckout} from '../pages/checkout/util/checkout-context'
import {AmexIcon, DiscoverIcon, MastercardIcon, VisaIcon, PaypalIcon} from '../components/icons'
import {Box, Stack} from '@chakra-ui/react'

/**
 * Returns a map of applicable payment methods keyed by payment method ID
 * @returns {Object} map of applicable payment methods
 */
export const useCCVPaymentMethodsMap = () => {
    const {paymentMethods} = useCheckout()

    return useMemo(() => {
        if (!paymentMethods) return {}

        return paymentMethods.applicablePaymentMethods.reduce((result, current) => {
            result[current.id] = current
            return result
        }, {})
    }, [paymentMethods])
}

export const PaymentSummaryCCV = ({selectedPayment}) => {
    const paymentMethodsMap = useCCVPaymentMethodsMap()
    let optionDescription
    const selectedPaymentData =
        (selectedPayment && paymentMethodsMap[selectedPayment.paymentMethodId]) || {}
    const selectedMethodName = selectedPaymentData.name

    if (selectedPaymentData && selectedPaymentData.c_ccvOptions) {
        const options = JSON.parse(selectedPaymentData?.c_ccvOptions || null)
        const option =
            options && options.find((option) => option.issuerid === selectedPayment.c_ccv_option)
        optionDescription = (option && option.issuerdescription) || selectedPayment.c_ccv_option
    }
    // const selectedMethodOptionDescription = selectedPaymentData?.
    return (
        <Stack>
            {selectedMethodName && <Box>{selectedMethodName}</Box>}
            {optionDescription && <Box>{optionDescription}</Box>}
            <PaymentMethodIcons ccvMethodId={selectedPaymentData.c_ccvMethodId} />
        </Stack>
    )
}
PaymentSummaryCCV.propTypes = {
    selectedPayment: PropTypes.object
}

export const CreditCardIcons = () => {
    return (
        <Stack direction="row" spacing={1}>
            <VisaIcon layerStyle="ccIcon" />
            <MastercardIcon layerStyle="ccIcon" />
            <AmexIcon layerStyle="ccIcon" />
            <DiscoverIcon layerStyle="ccIcon" />
        </Stack>
    )
}
/**
 * Icons to be displayed for each payment method
 */
const paymentIconsMap = {
    paypal: <PaypalIcon width="auto" height="20px" />,
    card: <CreditCardIcons />
}

export const PaymentMethodIcons = ({ccvMethodId}) => {
    if (!ccvMethodId || !paymentIconsMap[ccvMethodId]) return null
    return paymentIconsMap[ccvMethodId]
}
