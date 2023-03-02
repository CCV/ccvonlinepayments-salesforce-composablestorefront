import React, {useMemo} from 'react'
import PropTypes from 'prop-types'
import {useCheckout} from '../pages/checkout/util/checkout-context'
import {AmexIcon, MastercardIcon, VisaIcon, PaypalIcon, IdealIcon} from '../components/icons'
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
            <Stack direction="row" spacing={1}>
                <PaymentMethodIcons
                    ccvMethodId={selectedPaymentData.c_ccvMethodId}
                    iconHeight="30px"
                />
            </Stack>
        </Stack>
    )
}
PaymentSummaryCCV.propTypes = {
    selectedPayment: PropTypes.object
}

/**
 * Icons to be displayed for each payment method
 */
function getPaymentIcons(ccvMethodId, iconHeight = '25px') {
    const iconMap = {
        paypal: <PaypalIcon width="auto" height={iconHeight} />,
        card: (
            <>
                <VisaIcon width="auto" height={iconHeight} />
                <MastercardIcon width="auto" height={iconHeight} />
                <AmexIcon width="auto" height={iconHeight} />
            </>
        ),
        ideal: <IdealIcon width="auto" height={iconHeight} />
    }
    return iconMap[ccvMethodId] || null
}

export const PaymentMethodIcons = ({ccvMethodId, iconHeight}) => {
    if (!ccvMethodId) return null
    return getPaymentIcons(ccvMethodId, iconHeight)
}
