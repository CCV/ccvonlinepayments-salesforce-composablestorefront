import React, {useMemo} from 'react'
import PropTypes from 'prop-types'
import {useCheckout} from '../pages/checkout/util/checkout-context'
import {
    AmexIcon,
    MastercardIcon,
    VisaIcon,
    PaypalIcon,
    IdealIcon,
    BanContactIcon,
    GiropayIcon
} from '../components/icons'
import {Box, Stack, Text} from '@chakra-ui/react'
import {getCreditCardIcon} from './cc-utils'

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
    switch (selectedPayment.paymentMethodId) {
        case 'CCV_CREDIT_CARD': {
            const CardIcon = getCreditCardIcon(selectedPayment?.paymentCard?.cardType)
            return (
                <Box>
                    {CardIcon && <CardIcon layerStyle="ccIcon" />}

                    <Stack direction="row">
                        <Text>{selectedPayment.paymentCard.cardType}</Text>
                        <Text>
                            &bull;&bull;&bull;&bull; {selectedPayment.paymentCard.numberLastDigits}
                        </Text>
                        <Text>
                            {selectedPayment.paymentCard.expirationMonth}/
                            {selectedPayment.paymentCard.expirationYear}
                        </Text>
                    </Stack>
                </Box>
            )
        }

        default: {
            const paymentMethodsMap = useCCVPaymentMethodsMap()
            let optionDescription
            const selectedPaymentData =
                (selectedPayment && paymentMethodsMap[selectedPayment.paymentMethodId]) || {}
            const selectedMethodName = selectedPaymentData.name

            if (selectedPaymentData && selectedPaymentData.c_ccvOptions) {
                const options = JSON.parse(selectedPaymentData?.c_ccvOptions || null)
                const option =
                    options &&
                    options.find((option) => option.issuerid === selectedPayment.c_ccv_issuer_id)
                optionDescription =
                    (option && option.issuerdescription) || selectedPayment.c_ccv_option
            }
            return (
                <Stack>
                    <Stack direction="row" spacing={1} align="center">
                        {selectedMethodName && <Text>{selectedMethodName}</Text>}
                        <PaymentMethodIcons
                            paymentMethodId={selectedPayment.paymentMethodId}
                            iconHeight="30px"
                        />
                    </Stack>
                    {optionDescription && <Box>{optionDescription}</Box>}
                </Stack>
            )
        }
    }
}
PaymentSummaryCCV.propTypes = {
    selectedPayment: PropTypes.object
}

/**
 * Icons to be displayed for each payment method
 */
function getPaymentIcons(paymentMethodId, iconHeight = '25px') {
    const iconMap = {
        CCV_PAYPAL: <PaypalIcon width="auto" height={iconHeight} />,
        CCV_IDEAL: <IdealIcon width="auto" height={iconHeight} />,
        CCV_BANCONTACT: <BanContactIcon width="auto" height={iconHeight} />,
        CCV_GIROPAY: <GiropayIcon width="auto" height={iconHeight} />,
        CCV_CREDIT_CARD: (
            <>
                <VisaIcon width="auto" height={iconHeight} />
                <MastercardIcon width="auto" height={iconHeight} />
                <AmexIcon width="auto" height={iconHeight} />
            </>
        ),
        CCV_CREDIT_CARD_HPP: (
            <>
                <VisaIcon width="auto" height={iconHeight} />
                <MastercardIcon width="auto" height={iconHeight} />
                <AmexIcon width="auto" height={iconHeight} />
                <BanContactIcon width="auto" height={iconHeight} />
            </>
        )
    }
    return iconMap[paymentMethodId] || null
}

export const PaymentMethodIcons = ({paymentMethodId, iconHeight}) => {
    if (!paymentMethodId) return null
    return getPaymentIcons(paymentMethodId, iconHeight)
}
