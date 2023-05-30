import React, {useMemo} from 'react'
import PropTypes from 'prop-types'
import {useCheckout} from '../../../../app/pages/checkout/util/checkout-context'

import {
    AmexIcon,
    MastercardIcon,
    VisaIcon,
    PaypalIcon,
    IdealIcon,
    BanContactIcon,
    GiropayIcon,
    SofortIcon,
    EPSIcon,
    PayconiqIcon,
    MaestroIcon,
    KlarnaIcon,
    ApplePayIcon
} from '../../../../app/components/icons'
import {Button} from '@chakra-ui/react'
import {FormattedMessage} from 'react-intl'
import {useIntl} from 'react-intl'

import {Box, Stack, Text} from '@chakra-ui/react'
import {getCreditCardIcon} from '../../../../app/utils/cc-utils'
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
    if (selectedPayment.paymentCard) {
        return <CreditCardSummary selectedPayment={selectedPayment} />
    }
    return <DefaultPaymentSummary selectedPayment={selectedPayment} />
}
PaymentSummaryCCV.propTypes = {
    selectedPayment: PropTypes.object
}

const CreditCardSummary = ({selectedPayment}) => {
    if (!selectedPayment.paymentCard) return null
    const CardIcon = getCreditCardIcon(selectedPayment?.paymentCard?.cardType)
    return (
        <Box>
            {CardIcon && <CardIcon layerStyle="ccIcon" />}

            <Stack direction="row">
                <Text>{selectedPayment.paymentCard.cardType}</Text>
                <Text>&bull;&bull;&bull;&bull; {selectedPayment.paymentCard.numberLastDigits}</Text>
                <Text>
                    {selectedPayment.paymentCard.expirationMonth}/
                    {selectedPayment.paymentCard.expirationYear}
                </Text>
            </Stack>
        </Box>
    )
}
CreditCardSummary.propTypes = {
    selectedPayment: PropTypes.object
}

const DefaultPaymentSummary = ({selectedPayment}) => {
    const paymentMethodsMap = useCCVPaymentMethodsMap()
    let optionDescription

    const selectedPaymentData =
        (selectedPayment && paymentMethodsMap[selectedPayment.paymentMethodId]) || {}
    const selectedMethodName = selectedPaymentData.name

    if (selectedPaymentData && selectedPaymentData.c_ccvOptions) {
        const options = selectedPaymentData?.c_ccvOptions
        const option =
            options && options.find((option) => option.issuerid === selectedPayment.c_ccv_issuer_id)
        optionDescription = (option && option.issuerdescription) || selectedPayment.c_ccv_option
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
DefaultPaymentSummary.propTypes = {
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
        CCV_CREDIT_CARD_INLINE: (
            <>
                <VisaIcon width="auto" height={iconHeight} />
                <MastercardIcon width="auto" height={iconHeight} />
                <AmexIcon width="auto" height={iconHeight} />
            </>
        ),
        CCV_CREDIT_CARD: (
            <>
                <VisaIcon width="auto" height={iconHeight} />
                <MastercardIcon width="auto" height={iconHeight} />
                <AmexIcon width="auto" height={iconHeight} />
                <MaestroIcon width="auto" height={iconHeight} />
                <BanContactIcon width="auto" height={iconHeight} />
            </>
        ),
        CCV_SOFORT: <SofortIcon width="auto" height={iconHeight} />,
        CCV_EPS: <EPSIcon width="auto" height={iconHeight} />,
        CCV_PAYCONIQ: <PayconiqIcon width="auto" height={iconHeight} />,
        CCV_KLARNA: <KlarnaIcon width="auto" height={iconHeight} />,
        CCV_APPLE_PAY: <ApplePayIcon width="auto" height={iconHeight} />
    }
    return iconMap[paymentMethodId] || null
}

export const PaymentMethodIcons = ({paymentMethodId, iconHeight}) => {
    if (!paymentMethodId) return null
    return getPaymentIcons(paymentMethodId, iconHeight)
}

export const PlaceOrderButton = (props) => {
    return props.isApplePay ? (
        <ApplePayPlaceOrderButton {...props} />
    ) : (
        <DefaultPlaceOrderButton {...props} />
    )
}
PlaceOrderButton.propTypes = {
    isApplePay: PropTypes.bool
}

const DefaultPlaceOrderButton = (props) => {
    return (
        <Button
            w="full"
            onClick={props.submitOrderHandler}
            isLoading={props.isLoading}
            data-testid={props.dataTestid || ''}
        >
            <FormattedMessage defaultMessage="Place Order" id="checkout.button.place_order" />
        </Button>
    )
}
DefaultPlaceOrderButton.propTypes = {
    submitOrderHandler: PropTypes.func,
    dataTestid: PropTypes.string,
    isLoading: PropTypes.bool
}

export const ApplePayPlaceOrderButton = (props) => {
    const {locale} = useIntl()

    console.log(locale)
    return (
        <Box
            onClickCapture={() => props.submitApplePayOrderHandler(props.basket)}
            data-testid={props.dataTestid || ''}
        >
            <apple-pay-button
                buttonstyle="black"
                type="order"
                locale={locale}
                lang={locale}
                style={{
                    '--apple-pay-button-width': '100%',
                    '--apple-pay-button-padding': '8px 0px'
                }}
            />
        </Box>
    )
}
ApplePayPlaceOrderButton.propTypes = {
    submitApplePayOrderHandler: PropTypes.func,
    dataTestid: PropTypes.string,
    basket: PropTypes.object
}
